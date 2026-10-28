import { z } from "zod";
import { analyseRoute, chatSchema } from "./context";
import { generateReply, ProviderError, synthesizeSpeech, transcribeSpeech } from "./provider";
import { normalizeOrigin, permitsWidget, type CompanionStore } from "./security";

type Citation = { id: string; title: string; url: string; abstract: string; doi?: string; provider?: string; year?: string };
type Dependencies = {
  identity: (request: Request) => Promise<{ id: string } | null>;
  store: CompanionStore;
  key?: string;
  retrieve: (message: string, body?: string) => Promise<Citation[]>;
  model: (request: Request) => Promise<Response>;
};
class RequestError extends Error { constructor(public status: number, message: string) { super(message); } }
const languages = ["en-IN", "hi-IN", "bn-IN", "gu-IN", "kn-IN", "ml-IN", "mr-IN", "od-IN", "pa-IN", "ta-IN", "te-IN"] as const;
async function boundedBody(request: Request, maximum: number) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > maximum) throw new RequestError(413, "Request is too large.");
  const reader = request.body?.getReader(); if (!reader) throw new RequestError(400, "A request body is required.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > maximum) throw new RequestError(413, "Request is too large."); chunks.push(part.value); }
  } finally { await reader.cancel(); }
  const all = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; } return all;
}
async function json(request: Request, maximum = 64 * 1024) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new RequestError(415, "Use application/json.");
  try { return JSON.parse(new TextDecoder().decode(await boundedBody(request, maximum))); }
  catch (error) { if (error instanceof RequestError) throw error; throw new RequestError(400, "Invalid JSON."); }
}

export function createCompanionHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const action = new URL(request.url).pathname.split("/").at(-1);
    const origin = request.headers.get("origin"), ownOrigin = new URL(request.url).origin;
    const headers: Record<string, string> = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Vary": "Origin", "X-Request-ID": crypto.randomUUID() };
    const reply = (data: unknown, status = 200) => Response.json(data, { status, headers });
    try {
      if (action === "status" && request.method === "GET") { headers["Access-Control-Allow-Origin"] = "*"; return reply({ configured: Boolean(deps.key), visionConfigured: Boolean(deps.key), models: { conversation: "sarvam-105b-conversations", speech: "bulbul:v4-flash", transcription: "saaras:v4", vision: "gemma4" }, providerAccess: "Checked when a request is made; configuration does not guarantee available credits or model access." }); }
      if (action === "model" && request.method === "GET") { const asset = await deps.model(request); const copy = new Headers(asset.headers); copy.set("Access-Control-Allow-Origin", "*"); copy.set("Cache-Control", "public, max-age=86400"); copy.set("X-Content-Type-Options", "nosniff"); copy.set("Content-Type", "model/gltf-binary"); return new Response(asset.body, { status: asset.status, headers: copy }); }
      if (request.method === "OPTIONS") {
        if (!origin || !normalizeOrigin(origin)) return reply({ error: { message: "A valid origin is required." } }, 403);
        headers["Access-Control-Allow-Origin"] = origin; headers["Access-Control-Allow-Methods"] = "POST, DELETE, OPTIONS"; headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"; headers["Access-Control-Max-Age"] = "600";
        return new Response(null, { status: 204, headers });
      }
      if (!(["POST", "DELETE"].includes(request.method))) return reply({ error: { message: "Method not allowed." } }, 405);
      if (!["sessions", "chat", "text-to-speech", "speech-to-text"].includes(action || "")) return reply({ error: { message: "Not found." } }, 404);
      const authorization = request.headers.get("authorization");
      const widgetToken = authorization?.match(/^Bearer (sozo_widget_[a-f0-9]{64})$/)?.[1];
      let ownerId: string;
      if (widgetToken) {
        const session = await deps.store.resolve(widgetToken);
        if (!permitsWidget(session, origin)) return reply({ error: { message: "The companion session expired or does not allow this origin." } }, 401);
        if (action === "sessions") return reply({ error: { message: "Companion sessions cannot issue or revoke sessions." } }, 403);
        ownerId = session!.ownerId; headers["Access-Control-Allow-Origin"] = origin!;
      } else {
        // Workspace cookies and long-lived API keys are intentionally not accepted from foreign browser origins.
        if (origin && origin !== ownOrigin) return reply({ error: { message: "Use a scoped companion session for cross-origin browser access." } }, 403);
        const identity = await deps.identity(request);
        if (!identity) return reply({ error: { message: "Sign in or provide a valid SOZO API key." } }, 401);
        ownerId = identity.id;
      }
      if (!await deps.store.rateLimit(ownerId, "minute", 30, 60000) || !await deps.store.rateLimit(ownerId, "hour", 240, 3600000)) return reply({ error: { message: "Companion usage limit reached. Please retry later." } }, 429);
      if (action === "sessions") {
        if (request.method === "DELETE") { const data = z.object({ id: z.string().uuid() }).strict().parse(await json(request)); await deps.store.revoke(ownerId, data.id); return reply({ ok: true }); }
        const data = z.object({ allowedOrigin: z.string().max(500) }).strict().parse(await json(request)); const allowedOrigin = normalizeOrigin(data.allowedOrigin);
        if (!allowedOrigin) throw new RequestError(400, "Use an HTTPS origin, or HTTP localhost for development, without a path.");
        const session = await deps.store.issue(ownerId, allowedOrigin);
        return reply({ id: session.id, token: session.token, allowedOrigin: session.allowedOrigin, expiresAt: session.expiresAt, scopes: ["companion:chat", "companion:voice", "companion:vision"] }, 201);
      }
      if (request.method !== "POST") return reply({ error: { message: "Method not allowed." } }, 405);
      if (!deps.key) throw new ProviderError(503, "provider_unconfigured", "SOZO voice and conversation are not configured on this server.");
      if (action === "chat") {
        const input = chatSchema.parse(await json(request, 3 * 1024 * 1024));
        if (input.context?.screenshot) {
          const encoded = input.context.screenshot.split(",")[1];
          if (encoded.length * 3 / 4 > 2 * 1024 * 1024) throw new RequestError(413, "Shared images must be under 2 MB.");
          const bytes = atob(encoded.slice(0, 32));
          if (!(bytes.startsWith("\xff\xd8\xff") || bytes.startsWith("\x89PNG\r\n\x1a\n") || (bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WEBP"))) throw new RequestError(400, "The shared image format is invalid.");
        }
        let citations: Citation[] = [], retrievalError: string | null = null;
        if (input.retrieve) { try { citations = (await deps.retrieve(input.message, input.context?.body)).slice(0, 6); } catch { retrievalError = "Literature retrieval is temporarily unavailable; no literature citations were supplied."; } }
        const generated = await generateReply(deps.key, input, citations);
        const referenced = [...generated.reply.matchAll(/\[(\d+)\]/g)].map(match => Number(match[1]));
        const unsupported = referenced.filter(number => number < 1 || number > citations.length);
        const limitations = ["Route suggestions require validation against terrain, uncertainty and vehicle constraints.", ...(input.context?.metrics || input.context?.facts || input.context?.alternatives?.some(alternative => alternative.metrics) ? ["Shared metrics are user-supplied and have not been independently verified."] : []), ...(retrievalError ? [retrievalError] : []), ...(unsupported.length ? ["The model included an unsupported citation marker; verify the source list before relying on its answer."] : [])];
        return reply({ ...generated, citations: citations.map(({ abstract: _abstract, ...source }) => source), analysis: analyseRoute(input.context), limitations, contextUsed: { screenshot: Boolean(input.context?.screenshot), route: Boolean(input.context?.route), alternatives: input.context?.alternatives?.length ?? 0, facts: Object.keys(input.context?.facts ?? {}).length, literature: citations.length } });
      }
      if (action === "text-to-speech") {
        const data = z.object({ text: z.string().trim().min(1).max(2500), language: z.enum(languages).default("en-IN") }).strict().parse(await json(request));
        return reply(await synthesizeSpeech(deps.key, data.text, data.language));
      }
      if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) throw new RequestError(415, "Send multipart/form-data with an audio file.");
      const body = await boundedBody(request, 4 * 1024 * 1024);
      const form = await new Response(body, { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
      const file = form.get("file");
      if (!(file instanceof File) || !file.size || file.size > 3 * 1024 * 1024 || !/^(audio\/|video\/(webm|mp4))/.test(file.type)) throw new RequestError(400, "Provide an audio recording under 3 MB and 30 seconds.");
      return reply(await transcribeSpeech(deps.key, file));
    } catch (error) {
      if (error instanceof z.ZodError) return reply({ error: { message: "Some companion input is invalid. Check its size, fields and values.", fields: error.issues.map(issue => issue.path.join(".")) } }, 400);
      if (error instanceof RequestError || error instanceof ProviderError) return reply({ error: { message: error.message, ...(error instanceof ProviderError ? { code: error.code } : {}) } }, error.status);
      return reply({ error: { message: "The companion could not complete this request. Please retry." } }, 500);
    }
  };
}
