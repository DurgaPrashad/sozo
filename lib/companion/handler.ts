import { z } from "zod";
import { analyseRoute, chatSchema, effectiveStyle } from "./context";
import {
  budgetFrom,
  chatProviders,
  cleanSecret,
  generateReply,
  ProviderError,
  providerHealth,
  streamReply,
  synthesizeSpeech,
  transcribeSpeech,
  type ChatProvider,
  type ChatResult,
} from "./provider";
import { modelCatalog } from "./models";
import { normalizeOrigin, permitsWidget, PUBLISHABLE_KEY, type CompanionStore } from "./security";

type Citation = { id: string; title: string; url: string; abstract: string; doi?: string; provider?: string; year?: string };
type Retrieved = Citation[] | { citations: Citation[]; unavailable?: string[] };
type Identity = { id: string; name?: string; method?: string; keyLabel?: string };
type Dependencies = {
  identity: (request: Request) => Promise<Identity | null>;
  store: CompanionStore;
  key?: string;
  providers?: ChatProvider[];
  retrieve: (message: string, body: string | undefined, options: { timeoutMs: number }) => Promise<Retrieved>;
  model: (request: Request) => Promise<Response>;
  health?: () => Promise<unknown>;
  // Overridable for tests; production uses the defaults below.
  budgetMs?: number;
  retrievalBudgetMs?: number;
};

// Request budget for chat: the whole answer within 50 s (Vercel stops the
// function at 60 s), literature search at most 8 s, the model what remains.
export const CHAT_BUDGET_MS = 50000;
export const RETRIEVAL_BUDGET_MS = 8000;
const QUOTAS = { minute: { limit: 30, windowMs: 60000 }, hour: { limit: 240, windowMs: 3600000 } };
// New sessions a publishable key can buy per minute (chat quotas still apply).
const PUBLISHABLE_SESSIONS_PER_MINUTE = 60;
const MAX_PUBLISHABLE_KEYS = 20;

class RequestError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfterSeconds?: number) {
    super(message);
  }
}
const languages = ["en-IN", "hi-IN", "bn-IN", "gu-IN", "kn-IN", "ml-IN", "mr-IN", "od-IN", "pa-IN", "ta-IN", "te-IN"] as const;

async function boundedBody(request: Request, maximum: number) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > maximum) throw new RequestError(413, "payload_too_large", "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError(400, "invalid_request", "A request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maximum) throw new RequestError(413, "payload_too_large", "Request is too large.");
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel();
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.length;
  }
  return all;
}
async function json(request: Request, maximum = 64 * 1024) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new RequestError(415, "unsupported_media_type", "Use application/json.");
  try {
    return JSON.parse(new TextDecoder().decode(await boundedBody(request, maximum)));
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError(400, "invalid_request", "Invalid JSON.");
  }
}

// The one error shape every companion endpoint and SSE "error" event uses.
export type CompanionErrorBody = {
  code: string;
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
  requestId: string;
  fields?: string[];
};

function errorBody(error: unknown, requestId: string): { status: number; error: CompanionErrorBody } {
  if (error instanceof z.ZodError)
    return {
      status: 400,
      error: { code: "invalid_request", message: "Some companion input is invalid. Check its size, fields and values.", retryable: false, requestId, fields: error.issues.map((issue) => issue.path.join(".")) },
    };
  if (error instanceof ProviderError)
    return {
      status: error.status,
      error: { code: error.code, message: error.message, retryable: error.retryable, ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}), requestId },
    };
  if (error instanceof RequestError)
    return {
      status: error.status,
      error: { code: error.code, message: error.message, retryable: Boolean(error.retryAfterSeconds), ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}), requestId },
    };
  return { status: 500, error: { code: "internal_error", message: "The companion could not complete this request. Please retry.", retryable: true, retryAfterSeconds: 2, requestId } };
}

let cachedHealth: { at: number; value: Promise<unknown> } | null = null;

export function createCompanionHandler(deps: Dependencies) {
  const key = cleanSecret(deps.key).invalid ? undefined : cleanSecret(deps.key).value;
  const providers = deps.providers ?? chatProviders(process.env, deps.key);
  const health = deps.health ?? (() => providerHealth({ ...process.env, SARVAM_API_KEY: deps.key }));
  const chatBudget = deps.budgetMs ?? CHAT_BUDGET_MS;
  const retrievalBudget = deps.retrievalBudgetMs ?? RETRIEVAL_BUDGET_MS;
  return async (request: Request): Promise<Response> => {
    const action = new URL(request.url).pathname.split("/").at(-1);
    const origin = request.headers.get("origin"), ownOrigin = new URL(request.url).origin;
    const requestId = crypto.randomUUID();
    const headers: Record<string, string> = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", Vary: "Origin", "X-Request-ID": requestId };
    const reply = (data: unknown, status = 200) => Response.json(data, { status, headers });
    const fail = (error: unknown) => {
      const { status, error: body } = errorBody(error, requestId);
      if (body.retryAfterSeconds) headers["Retry-After"] = String(body.retryAfterSeconds);
      if (status >= 500) console.error(JSON.stringify({ requestId, code: body.code, action }));
      return reply({ error: body }, status);
    };
    try {
      if (action === "status" && request.method === "GET") {
        headers["Access-Control-Allow-Origin"] = "*";
        const keyed = Boolean(key);
        return reply({
          configured: providers.length > 0,
          visionConfigured: keyed,
          speechConfigured: keyed,
          models: { conversation: providers[0]?.model ?? null, speech: "bulbul:v4-flash", transcription: "saaras:v4", vision: "gemma4" },
          chatProviders: providers.map((provider, index) => ({ provider: provider.label, model: provider.model, role: index === 0 ? "primary" : "fallback" })),
          metaLlama: { configured: providers.some((provider) => provider.id === "meta"), model: providers.find((provider) => provider.id === "meta")?.model ?? null },
          providerAccess: "Configuration is not health: see /api/companion/health.",
        });
      }
      if (action === "health" && request.method === "GET") {
        headers["Access-Control-Allow-Origin"] = "*";
        headers["Cache-Control"] = "public, max-age=30, s-maxage=60";
        if (!cachedHealth || Date.now() - cachedHealth.at > 60000) cachedHealth = { at: Date.now(), value: health() };
        return reply({ ...(await cachedHealth.value as object), requestId });
      }
      if (action === "models" && request.method === "GET") {
        headers["Access-Control-Allow-Origin"] = "*";
        headers["Cache-Control"] = "public, max-age=60";
        const meta = providers.find((provider) => provider.id === "meta");
        return reply({ models: modelCatalog({ sarvam: providers.some((provider) => provider.id === "sarvam"), meta: Boolean(meta), metaModel: meta?.model }), requestId });
      }
      if (action === "model" && request.method === "GET") {
        const asset = await deps.model(request);
        if (!asset.ok) throw new RequestError(502, "model_unavailable", "The companion model is unavailable.", 5);
        // fetch() has already decoded any compression, so the original
        // Content-Encoding and Content-Length no longer describe the body.
        const copy = new Headers({
          "Content-Type": "model/gltf-binary",
          "Cache-Control": "public, max-age=86400",
          "Access-Control-Allow-Origin": "*",
          "X-Content-Type-Options": "nosniff",
          "X-Request-ID": requestId,
        });
        const etag = asset.headers.get("etag");
        if (etag) copy.set("ETag", etag);
        return new Response(asset.body, { status: 200, headers: copy });
      }
      if (request.method === "OPTIONS") {
        if (!origin || !normalizeOrigin(origin)) throw new RequestError(403, "forbidden_origin", "A valid origin is required.");
        headers["Access-Control-Allow-Origin"] = origin;
        headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS";
        headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept";
        headers["Access-Control-Expose-Headers"] = "X-Request-ID, Retry-After";
        headers["Access-Control-Max-Age"] = "600";
        return new Response(null, { status: 204, headers });
      }
      const actions: Record<string, string[]> = { sessions: ["POST", "DELETE"], chat: ["POST"], "text-to-speech": ["POST"], "speech-to-text": ["POST"], whoami: ["GET"], "publishable-keys": ["GET", "POST", "DELETE"] };
      if (!action || !actions[action]) throw new RequestError(404, "not_found", "Not found.");
      if (!actions[action].includes(request.method)) throw new RequestError(405, "method_not_allowed", "Method not allowed.");

      const authorization = request.headers.get("authorization");
      // A website without a backend: its publishable key, sent from a listed
      // origin, buys the same ten-minute session a host backend would issue.
      const publishable = authorization?.match(/^Bearer (sozo_pk_\S*)$/)?.[1];
      if (publishable) {
        if (action !== "sessions" || request.method !== "POST")
          throw new RequestError(401, "unauthorized", "A publishable key only exchanges for a companion session at POST /api/companion/sessions.");
        const allowedOrigin = origin ? normalizeOrigin(origin) : null;
        if (allowedOrigin) {
          headers["Access-Control-Allow-Origin"] = allowedOrigin;
          headers["Access-Control-Expose-Headers"] = "X-Request-ID, Retry-After";
        }
        const record = PUBLISHABLE_KEY.test(publishable) && deps.store.resolvePublishableKey ? await deps.store.resolvePublishableKey(publishable) : null;
        if (!record) throw new RequestError(401, "unauthorized", "This publishable key is unknown or was revoked.");
        if (!allowedOrigin || !record.origins.includes(allowedOrigin))
          throw new RequestError(403, "forbidden_origin", "This publishable key is not enabled for this website. Add its origin to the key in SOZO's developer settings.");
        if (!(await deps.store.rateLimit(record.ownerId, `publishable:${record.id}`, PUBLISHABLE_SESSIONS_PER_MINUTE, 60000)))
          throw new RequestError(429, "rate_limited", "Too many new companion sessions for this website. Please retry shortly.", Math.ceil((60000 - (Date.now() % 60000)) / 1000));
        const session = await deps.store.issue(record.ownerId, allowedOrigin);
        return reply({ id: session.id, token: session.token, allowedOrigin: session.allowedOrigin, expiresAt: session.expiresAt, scopes: ["companion:chat", "companion:voice", "companion:vision"], requestId }, 201);
      }
      const widgetToken = authorization?.match(/^Bearer (sozo_widget_[a-f0-9]{64})$/)?.[1];
      let ownerId: string;
      let identity: Identity | null = null;
      if (widgetToken) {
        const session = await deps.store.resolve(widgetToken);
        if (!permitsWidget(session, origin)) throw new RequestError(401, "session_invalid", "The companion session expired or does not allow this origin.");
        if (action === "sessions" || action === "publishable-keys") throw new RequestError(403, "session_forbidden", "Companion sessions cannot manage sessions or keys.");
        ownerId = session!.ownerId;
        headers["Access-Control-Allow-Origin"] = origin!;
        headers["Access-Control-Expose-Headers"] = "X-Request-ID, Retry-After";
      } else {
        // Workspace cookies and long-lived API keys are intentionally not accepted from foreign browser origins.
        if (origin && origin !== ownOrigin) throw new RequestError(403, "forbidden_origin", "Use a scoped companion session for cross-origin browser access.");
        identity = await deps.identity(request);
        if (!identity) throw new RequestError(401, "unauthorized", "Sign in or provide a valid SOZO API key.");
        ownerId = identity.id;
      }

      if (action === "whoami") {
        const usage = deps.store.usage;
        const remaining = async (kind: keyof typeof QUOTAS) =>
          usage ? Math.max(0, QUOTAS[kind].limit - (await usage.call(deps.store, ownerId, kind, QUOTAS[kind].windowMs))) : null;
        return reply({
          requestId,
          method: widgetToken ? "widget_session" : identity?.method ?? "session",
          workspace: { name: identity?.name ?? "SOZO workspace" },
          ...(identity?.keyLabel ? { key: { label: identity.keyLabel } } : {}),
          quotas: {
            minute: { limit: QUOTAS.minute.limit, remaining: await remaining("minute") },
            hour: { limit: QUOTAS.hour.limit, remaining: await remaining("hour") },
          },
        });
      }

      if (action === "publishable-keys") {
        const store = deps.store;
        if (!store.createPublishableKey || !store.listPublishableKeys || !store.revokePublishableKey)
          throw new ProviderError(503, "storage_unconfigured", "Workspace storage is not configured on this server.");
        if (request.method === "GET") return reply({ keys: await store.listPublishableKeys(ownerId), requestId });
        if (request.method === "DELETE") {
          const data = z.object({ id: z.string().uuid() }).strict().parse(await json(request));
          await store.revokePublishableKey(ownerId, data.id);
          return reply({ ok: true, requestId });
        }
        const data = z.object({ label: z.string().trim().min(1).max(100), origins: z.array(z.string().max(500)).min(1).max(10) }).strict().parse(await json(request));
        const origins = [...new Set(data.origins.map((value) => normalizeOrigin(value.trim())))];
        if (origins.includes(null))
          throw new RequestError(400, "invalid_request", "List each website as an HTTPS origin such as https://planner.example (HTTP only for localhost), without a path.");
        if ((await store.listPublishableKeys(ownerId)).length >= MAX_PUBLISHABLE_KEYS)
          throw new RequestError(400, "invalid_request", `A workspace can have up to ${MAX_PUBLISHABLE_KEYS} publishable keys. Revoke one first.`);
        return reply({ key: await store.createPublishableKey(ownerId, data.label, origins as string[]), requestId }, 201);
      }

      for (const kind of ["minute", "hour"] as const) {
        if (!(await deps.store.rateLimit(ownerId, kind, QUOTAS[kind].limit, QUOTAS[kind].windowMs))) {
          const windowMs = QUOTAS[kind].windowMs;
          throw new RequestError(429, "rate_limited", "Companion usage limit reached. Please retry later.", Math.ceil((windowMs - (Date.now() % windowMs)) / 1000));
        }
      }
      if (action === "sessions") {
        if (request.method === "DELETE") {
          const data = z.object({ id: z.string().uuid() }).strict().parse(await json(request));
          await deps.store.revoke(ownerId, data.id);
          return reply({ ok: true, requestId });
        }
        const data = z.object({ allowedOrigin: z.string().max(500) }).strict().parse(await json(request));
        const allowedOrigin = normalizeOrigin(data.allowedOrigin);
        if (!allowedOrigin) throw new RequestError(400, "invalid_request", "Use an HTTPS origin, or HTTP localhost for development, without a path.");
        const session = await deps.store.issue(ownerId, allowedOrigin);
        return reply({ id: session.id, token: session.token, allowedOrigin: session.allowedOrigin, expiresAt: session.expiresAt, scopes: ["companion:chat", "companion:voice", "companion:vision"], requestId }, 201);
      }

      if (action === "chat") {
        const started = Date.now();
        const budget = budgetFrom(started + chatBudget);
        const input = chatSchema.parse(await json(request, 3 * 1024 * 1024));
        const style = effectiveStyle(input.style, input.message);
        if (input.context?.screenshot) {
          const encoded = input.context.screenshot.split(",")[1];
          if ((encoded.length * 3) / 4 > 2 * 1024 * 1024) throw new RequestError(413, "payload_too_large", "Shared images must be under 2 MB.");
          const bytes = atob(encoded.slice(0, 32));
          if (!(bytes.startsWith("\xff\xd8\xff") || bytes.startsWith("\x89PNG\r\n\x1a\n") || (bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WEBP")))
            throw new RequestError(400, "invalid_request", "The shared image format is invalid.");
        }
        if (!providers.length)
          throw cleanSecret(deps.key).invalid
            ? new ProviderError(502, "provider_key_invalid", "SOZO's conversation model's API key on this server contains invalid characters. Re-enter it without spaces, quotes or line breaks.")
            : new ProviderError(503, "provider_unconfigured", "SOZO's conversation model is not configured on this server.");
        // An explicit provider answers first; the others stay as fallbacks.
        if (input.provider && !providers.some((provider) => provider.id === input.provider))
          throw new ProviderError(503, "provider_unconfigured", input.provider === "meta" ? "Meta Llama is not configured on this server. Set META_LLAMA_API_KEY, or omit provider." : "SOZO's conversation model is not configured on this server.");
        const ordered = input.provider ? [...providers].sort((a, b) => Number(b.id === input.provider) - Number(a.id === input.provider)) : providers;
        const wantsStream = request.headers.get("accept")?.includes("text/event-stream");

        const retrieveLiterature = async () => {
          if (!input.retrieve) return { citations: [] as Citation[], limitations: [] as string[], ms: 0 };
          const t0 = Date.now();
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            const result = await Promise.race([
              deps.retrieve(input.message, input.context?.body, { timeoutMs: Math.max(1000, retrievalBudget - 500) }),
              new Promise<"timeout">((resolve) => { timer = setTimeout(() => resolve("timeout"), retrievalBudget); }),
            ]);
            if (result === "timeout")
              return { citations: [], limitations: [`Literature search took longer than ${Math.round(retrievalBudget / 1000)} s, so this answer was given without retrieved publications.`], ms: Date.now() - t0 };
            const normalized = Array.isArray(result) ? { citations: result } : result;
            const limitations = normalized.unavailable?.length
              ? [`${normalized.unavailable.join(" and ")} did not answer in time, so this answer uses the remaining sources only.`]
              : [];
            return { citations: normalized.citations.slice(0, 6), limitations, ms: Date.now() - t0 };
          } catch {
            return { citations: [], limitations: ["Literature retrieval is temporarily unavailable; no literature citations were supplied."], ms: Date.now() - t0 };
          } finally {
            clearTimeout(timer);
          }
        };
        const baseLimitations = [
          ...(input.context?.route || input.context?.alternatives?.length ? ["Route suggestions require validation against terrain, uncertainty and vehicle constraints."] : []),
          ...(input.context?.metrics || input.context?.facts || input.context?.alternatives?.some((a) => a.metrics) ? ["Shared metrics are user-supplied and have not been independently verified."] : []),
        ];
        const contextUsed = (literature: number) => ({
          screenshot: Boolean(input.context?.screenshot),
          route: Boolean(input.context?.route),
          alternatives: input.context?.alternatives?.length ?? 0,
          facts: Object.keys(input.context?.facts ?? {}).length,
          scan: Boolean(input.context?.scan),
          literature,
        });
        const publicCitations = (citations: Citation[]) => citations.map(({ abstract: _abstract, ...source }) => source);
        const chatInput = { message: input.message, history: input.history, context: input.context, style };

        if (!wantsStream) {
          const literature = await retrieveLiterature();
          const t1 = Date.now();
          const generated = await generateReply(ordered, chatInput, literature.citations, { budget, signal: request.signal });
          return reply({
            reply: generated.reply,
            calculations: generated.calculations,
            model: generated.model,
            provider: generated.provider,
            usage: generated.usage,
            style,
            citations: publicCitations(literature.citations),
            analysis: analyseRoute(input.context),
            limitations: [...baseLimitations, ...literature.limitations, ...generated.checks],
            contextUsed: contextUsed(literature.citations.length),
            timings: { retrievalMs: literature.ms, modelMs: Date.now() - t1, totalMs: Date.now() - started },
            requestId,
          });
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            try {
              if (input.retrieve) send("status", { stage: "retrieving" });
              const literature = await retrieveLiterature();
              send("status", { stage: "reading", literature: literature.citations.length });
              send("citations", publicCitations(literature.citations));
              send("analysis", analyseRoute(input.context));
              send("status", { stage: "answering" });
              const t1 = Date.now();
              let result: ChatResult | null = null;
              for await (const part of streamReply(ordered, chatInput, literature.citations, { budget, signal: request.signal })) {
                if ("delta" in part) send("delta", { text: part.delta });
                else if ("calculations" in part) send("calculations", part.calculations);
                else result = part.done;
              }
              send("limitations", [...baseLimitations, ...literature.limitations, ...(result?.checks ?? [])]);
              send("done", {
                model: result?.model,
                provider: result?.provider,
                usage: result?.usage ?? null,
                style,
                contextUsed: contextUsed(literature.citations.length),
                timings: { retrievalMs: literature.ms, modelMs: Date.now() - t1, totalMs: Date.now() - started },
                requestId,
              });
            } catch (error) {
              const { error: body } = errorBody(error, requestId);
              if (body.code === "internal_error") console.error(JSON.stringify({ requestId, code: body.code, action }));
              send("error", { error: body });
            } finally {
              controller.close();
            }
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { ...headers, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
        });
      }
      if (action === "text-to-speech") {
        const data = z.object({ text: z.string().trim().min(1).max(2500), language: z.enum(languages).default("en-IN") }).strict().parse(await json(request));
        return reply({ ...(await synthesizeSpeech(key, data.text, data.language, request.signal)), requestId });
      }
      if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) throw new RequestError(415, "unsupported_media_type", "Send multipart/form-data with an audio file.");
      const body = await boundedBody(request, 4 * 1024 * 1024);
      const form = await new Response(body, { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
      const file = form.get("file");
      if (!(file instanceof File) || !file.size || file.size > 3 * 1024 * 1024 || !/^(audio\/|video\/(webm|mp4))/.test(file.type))
        throw new RequestError(400, "invalid_request", "Provide an audio recording under 3 MB and 30 seconds.");
      return reply({ ...(await transcribeSpeech(key, file, request.signal)), requestId });
    } catch (error) {
      return fail(error);
    }
  };
}
