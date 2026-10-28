import { searchSpaceArchive } from "./science/space-data";
import { and, eq, desc, gte, count } from "drizzle-orm";
import { getDb } from "../db";
import {
  projects,
  runs,
  notes,
  integrations,
  apiKeys,
  audit,
} from "../db/schema";
import { getIdentity } from "./auth/identity";
import { z } from "zod";
import { env } from "@/lib/platform";
import { D1CompanionStore } from "./companion/security";
import { generateReply } from "./companion/provider";
import { retrieveEvidence } from "./science/retrieval";
import {
  allowedURL,
  DEFAULT_ALLOWED_HOSTS,
  discoverOpenAPI,
  readRemoteJSON,
  buildOperationURL,
} from "./science/connectors";
import { background } from "./execution-context";
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
class APIError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function digest(token: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
const cleanRun = (run: typeof runs.$inferSelect) => {
  const { ownerId: _owner, idempotencyKey: _key, ...data } = run;
  return data;
};
async function user(request: Request) {
  const identity = await getIdentity(request);
  if (identity) return identity;
  throw new APIError(
    401,
    "Sign in to your SOZO workspace or supply a valid API key.",
  );
}
async function body(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new APIError(415, "Use Content-Type: application/json.");
  const reader = request.body?.getReader();
  if (!reader) throw new APIError(400, "A JSON body is required.");
  let size = 0;
  let raw = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 1_100_000)
        throw new APIError(413, "Request body is too large.");
      raw += decoder.decode(part.value, { stream: true });
    }
  } finally {
    await reader.cancel();
  }
  try {
    return JSON.parse(raw + decoder.decode());
  } catch {
    throw new APIError(400, "A valid JSON body is required.");
  }
}
async function log(ownerId: string, action: string, resourceId?: string) {
  await getDb()
    .insert(audit)
    .values({ id: uuid(), ownerId, action, resourceId, createdAt: now() });
}
const allowedHosts = () => [
  ...DEFAULT_ALLOWED_HOSTS,
  ...(process.env.SOZO_CONNECTOR_HOSTS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
];
async function executeRun(
  id: string,
  ownerId: string,
  question: string,
  sources: string[],
  mode: string,
) {
  const db = getDb();
  const condition = and(
    eq(runs.id, id),
    eq(runs.ownerId, ownerId),
    eq(runs.status, "running"),
  );
  try {
    await db
      .update(runs)
      .set({
        progress: [
          { label: "Research question saved", at: now() },
          {
            label: `Searching ${sources.map((s) => (s === "crossref" ? "Crossref" : "Europe PMC")).join(" + ")}`,
            at: now(),
          },
        ],
      })
      .where(condition);
    const result = await retrieveEvidence(question, sources, mode);
    if (process.env.SARVAM_API_KEY && result.citations.length && env.DB && await new D1CompanionStore(env.DB).rateLimit(ownerId, "hour", 240, 3600000)) {
      const synthesisStart = Date.now();
      await db.update(runs).set({progress:[{label:"Source discovery finished",at:now()},{label:"Synthesizing retrieved evidence with Sarvam",at:now()}]}).where(condition);
      try {
        const generated = await generateReply(process.env.SARVAM_API_KEY, {
          message: `Answer this research question from the supplied publication records: ${question}\nUse short sections only where useful: Research summary, Key evidence, Interpretation, Limits, Implications for exploration. Cite numbered records. Do not imply abstract metadata is full-text validation.`, history: []
        }, result.citations);
        const invalid = [...generated.reply.matchAll(/\[(\d+)\]/g)].some(match => Number(match[1]) < 1 || Number(match[1]) > result.citations.length);
        if (invalid) throw new Error("Unsupported citation marker");
        result.answer = generated.reply;
        result.usage.model = generated.model;
        result.limitations.push("AI synthesis uses the retrieved metadata and available abstract excerpts. Verify every scientific claim against the original publication; citation markers are range-checked, not proof of claim support.");
      } catch { result.limitations.push("Model synthesis was unavailable or failed citation checks. The publication discovery record is retained."); }
      result.usage.durationMs += Date.now() - synthesisStart;
    }
    const status = result.providerStatus.every((p) => !p.ok)
      ? "failed"
      : result.providerStatus.some((p) => !p.ok)
        ? "partial"
        : "completed";
    await db
      .update(runs)
      .set({
        result,
        status,
        completedAt: now(),
        error:
          status === "failed"
            ? "The selected sources are temporarily unavailable. You can retry this question."
            : null,
        progress: [
          { label: "Research question saved", at: now() },
          { label: "Source discovery finished", at: now() },
          {
            label: `${result.citations.length} unique publication records retrieved`,
            at: now(),
          },
          { label: "Research record saved", at: now() },
        ],
      })
      .where(condition);
  } catch {
    await db
      .update(runs)
      .set({
        status: "failed",
        completedAt: now(),
        error: "Research could not complete. Please try again.",
      })
      .where(condition);
  }
}
export async function handleAPI(request: Request) {
  const requestId = uuid();
  const json = (data: unknown, status = 200) =>
    Response.json(
      { request_id: requestId, ...(data as object) },
      {
        status,
        headers: {
          "Cache-Control": "no-store",
          "X-Request-ID": requestId,
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  try {
    const [resource, id, action] = new URL(request.url).pathname
      .replace(/^\/api\/v1\/?/, "")
      .split("/")
      .filter(Boolean);
    const method = request.method;
    if (method === "GET" && resource === "health")
      return json({
        status: "ok",
        version: "0.4.0",
        mode: process.env.SARVAM_API_KEY ? "grounded-research-and-voice" : "literature-discovery",
      });
    const identity = await user(request);
    const ownerId = identity.id;
    const db = getDb();
    if (!["GET", "HEAD"].includes(method)) {
      const origin = request.headers.get("origin");
      if (origin && origin !== new URL(request.url).origin)
        throw new APIError(403, "Cross-origin writes are not permitted.");
      const [recent] = await db
        .select({ total: count() })
        .from(audit)
        .where(
          and(
            eq(audit.ownerId, ownerId),
            gte(audit.createdAt, new Date(Date.now() - 60000).toISOString()),
          ),
        );
      if (recent.total >= 30)
        throw new APIError(
          429,
          "Workspace write limit reached. Please wait one minute.",
        );
    }
    if (resource === "space-data" && method === "GET") {
      const params = new URL(request.url).searchParams;
      const query = z
        .string()
        .trim()
        .min(2)
        .max(160)
        .parse(params.get("q") ?? "lunar south pole");
      const media = z
        .enum(["all", "image", "video"])
        .parse(params.get("media") ?? "all");
      try {
        return json(await searchSpaceArchive(query, media));
      } catch {
        throw new APIError(
          502,
          "The NASA archive could not complete this search. Please try again.",
        );
      }
    }
    if (resource === "workspace" && method === "GET") {
      const [projectRows, runRows, noteRows, connectorRows] = await Promise.all(
        [
          db
            .select()
            .from(projects)
            .where(eq(projects.ownerId, ownerId))
            .orderBy(desc(projects.createdAt))
            .limit(100),
          db
            .select()
            .from(runs)
            .where(eq(runs.ownerId, ownerId))
            .orderBy(desc(runs.createdAt))
            .limit(100),
          db
            .select()
            .from(notes)
            .where(eq(notes.ownerId, ownerId))
            .orderBy(desc(notes.createdAt))
            .limit(200),
          db
            .select()
            .from(integrations)
            .where(eq(integrations.ownerId, ownerId))
            .limit(100),
        ],
      );
      return json({
        user: identity,
        projects: projectRows,
        runs: runRows.map(cleanRun),
        notes: noteRows,
        connectors: connectorRows,
      });
    }
    if (resource === "projects") {
      if (method === "GET")
        return json({
          projects: await db
            .select()
            .from(projects)
            .where(eq(projects.ownerId, ownerId))
            .limit(100),
        });
      if (method === "POST") {
        const data = z
          .object({
            name: z.string().trim().min(1).max(100),
            description: z.string().max(500).default(""),
            color: z.enum(["lime", "blue", "purple", "orange"]).default("lime"),
          })
          .parse(await body(request));
        const project = { id: uuid(), ownerId, ...data, createdAt: now() };
        await db.insert(projects).values(project);
        await log(ownerId, "project.created", project.id);
        return json({ project }, 201);
      }
      if (method === "DELETE" && id) {
        await db
          .update(runs)
          .set({ projectId: null })
          .where(and(eq(runs.projectId, id), eq(runs.ownerId, ownerId)));
        await db
          .delete(projects)
          .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)));
        await log(ownerId, "project.deleted", id);
        return json({ deleted: true });
      }
    }
    if (resource === "research") {
      if (method === "GET" && !id)
        return json({
          runs: (
            await db
              .select()
              .from(runs)
              .where(eq(runs.ownerId, ownerId))
              .orderBy(desc(runs.createdAt))
              .limit(100)
          ).map(cleanRun),
        });
      if (id) {
        const [run] = await db
          .select()
          .from(runs)
          .where(and(eq(runs.id, id), eq(runs.ownerId, ownerId)))
          .limit(1);
        if (!run) throw new APIError(404, "Research run not found.");
        if (method === "GET") {
          if (
            run.status === "running" &&
            Date.now() - new Date(run.createdAt).getTime() > 90000
          ) {
            await db
              .update(runs)
              .set({
                status: "failed",
                error:
                  "This run was interrupted. Retry to start a fresh source search.",
                completedAt: now(),
              })
              .where(
                and(
                  eq(runs.id, id),
                  eq(runs.ownerId, ownerId),
                  eq(runs.status, "running"),
                ),
              );
            run.status = "failed";
            run.error =
              "This run was interrupted. Retry to start a fresh source search.";
          }
          if (action === "events")
            return new Response(
              `retry: 1500\nevent: ${run.status === "running" ? "progress" : "result"}\ndata: ${JSON.stringify({ request_id: requestId, run: cleanRun(run) })}\n\n`,
              {
                headers: {
                  "Content-Type": "text/event-stream",
                  "Cache-Control": "no-store",
                  "X-Content-Type-Options": "nosniff",
                },
              },
            );
          if (action === "report")
            return json({ research_run_id: id, ...cleanRun(run) });
          return json({ run: cleanRun(run) });
        }
        if (method === "POST" && action === "cancel") {
          await db
            .update(runs)
            .set({ status: "cancelled", completedAt: now() })
            .where(
              and(
                eq(runs.id, id),
                eq(runs.ownerId, ownerId),
                eq(runs.status, "running"),
              ),
            );
          await log(ownerId, "research.cancelled", id);
          return json({
            status: run.status === "running" ? "cancelled" : run.status,
          });
        }
        if (method === "DELETE") {
          if (run.status === "running")
            throw new APIError(
              409,
              "Cancel the active run before deleting it.",
            );
          await db
            .delete(runs)
            .where(and(eq(runs.id, id), eq(runs.ownerId, ownerId)));
          await log(ownerId, "research.deleted", id);
          return json({ deleted: true });
        }
      }
      if (method === "POST" && !id) {
        const data = z
          .object({
            question: z.string().trim().min(5).max(1500),
            domain: z.string().max(80).default("All sciences"),
            mode: z.enum(["focused", "broad"]).default("broad"),
            sources: z
              .array(z.enum(["crossref", "europepmc"]))
              .min(1)
              .max(2)
              .default(["crossref", "europepmc"]),
            projectId: z.string().uuid().nullable().optional(),
          })
          .parse(await body(request));
        if (new Set(data.sources).size !== data.sources.length)
          throw new APIError(400, "Duplicate sources are not permitted.");
        if (data.projectId) {
          const [project] = await db
            .select()
            .from(projects)
            .where(
              and(
                eq(projects.id, data.projectId),
                eq(projects.ownerId, ownerId),
              ),
            );
          if (!project) throw new APIError(404, "Project not found.");
        }
        const key = request.headers.get("idempotency-key");
        if (key && key.length > 120)
          throw new APIError(400, "Idempotency key is too long.");
        if (key) {
          const [existing] = await db
            .select()
            .from(runs)
            .where(
              and(eq(runs.ownerId, ownerId), eq(runs.idempotencyKey, key)),
            );
          if (existing) {
            if (
              existing.question !== data.question ||
              existing.mode !== data.mode ||
              JSON.stringify(existing.sources) !==
                JSON.stringify(data.sources) ||
              existing.projectId !== (data.projectId ?? null)
            )
              throw new APIError(
                409,
                "This idempotency key belongs to a different request.",
              );
            return json({ run: cleanRun(existing) });
          }
        }
        const [active] = await db
          .select({ total: count() })
          .from(runs)
          .where(
            and(
              eq(runs.ownerId, ownerId),
              eq(runs.status, "running"),
              gte(runs.createdAt, new Date(Date.now() - 90000).toISOString()),
            ),
          );
        if (active.total >= 3)
          throw new APIError(
            429,
            "You can run three research questions at a time.",
          );
        const run = {
          id: uuid(),
          ownerId,
          ...data,
          projectId: data.projectId ?? null,
          status: "running",
          progress: [{ label: "Research question saved", at: now() }],
          createdAt: now(),
          idempotencyKey: key,
          result: null,
          error: null,
          completedAt: null,
        };
        await db.insert(runs).values(run);
        await log(ownerId, "research.started", run.id);
        background(
          executeRun(run.id, ownerId, data.question, data.sources, data.mode),
        );
        return json({ research_run_id: run.id, run: cleanRun(run) }, 202);
      }
    }
    if (resource === "notes") {
      if (method === "GET")
        return json({
          notes: await db
            .select()
            .from(notes)
            .where(eq(notes.ownerId, ownerId))
            .limit(200),
        });
      if (method === "POST") {
        const data = z
          .object({
            title: z.string().trim().min(1).max(300),
            content: z.string().max(20000),
            sourceUrl: z.string().url().max(2000).nullable().optional(),
          })
          .parse(await body(request));
        if (data.sourceUrl && !/^https?:\/\//.test(data.sourceUrl))
          throw new APIError(400, "Use an HTTP or HTTPS source URL.");
        const note = {
          id: uuid(),
          ownerId,
          ...data,
          sourceUrl: data.sourceUrl ?? null,
          createdAt: now(),
        };
        await db.insert(notes).values(note);
        await log(ownerId, "note.created", note.id);
        return json({ note }, 201);
      }
      if (method === "DELETE" && id) {
        await db
          .delete(notes)
          .where(and(eq(notes.id, id), eq(notes.ownerId, ownerId)));
        await log(ownerId, "note.deleted", id);
        return json({ deleted: true });
      }
    }
    if (resource === "connectors") {
      if (method === "GET")
        return json({
          connectors: await db
            .select()
            .from(integrations)
            .where(eq(integrations.ownerId, ownerId))
            .limit(100),
        });
      if (method === "POST" && id === "test") {
        const { provider } = z
          .object({ provider: z.enum(["crossref", "europepmc"]) })
          .parse(await body(request));
        const url =
          provider === "crossref"
            ? new URL("https://api.crossref.org/works?rows=0")
            : new URL(
                "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=science&format=json&pageSize=1",
              );
        await readRemoteJSON(url);
        await log(ownerId, "connector.tested", provider);
        return json({ ok: true, checkedAt: now() });
      }
      if (method === "POST" && id === "discover") {
        const { url } = z
          .object({ url: z.string().url().max(2000) })
          .parse(await body(request));
        const approved = allowedURL(url, allowedHosts());
        const spec = (await readRemoteJSON(approved)) as Record<string, any>;
        const capabilities = discoverOpenAPI(spec);
        const server = spec.servers?.[0]?.url
          ? new URL(spec.servers[0].url, approved).toString()
          : approved.origin;
        allowedURL(server, allowedHosts());
        await log(ownerId, "connector.discovered");
        return json({ name: spec.info.title, capabilities, server });
      }
      if (method === "POST" && !id) {
        const data = z
          .object({
            name: z.string().trim().min(1).max(100),
            url: z.string().url().max(2000),
            approved: z.array(z.string()).min(1).max(100),
          })
          .parse(await body(request));
        const spec = (await readRemoteJSON(
          allowedURL(data.url, allowedHosts()),
        )) as any;
        const candidates = discoverOpenAPI(spec);
        const capabilities = candidates.filter((c) =>
          data.approved.includes(c.id),
        );
        if (capabilities.length !== new Set(data.approved).size)
          throw new APIError(
            400,
            "Only discovered read operations can be approved.",
          );
        const server = spec.servers?.[0]?.url
          ? new URL(spec.servers[0].url, data.url).toString()
          : new URL(data.url).origin;
        allowedURL(server, allowedHosts());
        const connector = {
          id: uuid(),
          ownerId,
          name: data.name,
          type: "openapi",
          url: server,
          capabilities,
          createdAt: now(),
        };
        await db.insert(integrations).values(connector);
        await log(ownerId, "connector.registered", connector.id);
        return json({ connector }, 201);
      }
      if (id && !["discover", "test"].includes(id)) {
        const [connector] = await db
          .select()
          .from(integrations)
          .where(
            and(eq(integrations.id, id), eq(integrations.ownerId, ownerId)),
          );
        if (!connector) throw new APIError(404, "Connector not found.");
        if (method === "GET") return json({ connector });
        if (method === "DELETE") {
          await db
            .delete(integrations)
            .where(
              and(eq(integrations.id, id), eq(integrations.ownerId, ownerId)),
            );
          await log(ownerId, "connector.revoked", id);
          return json({ deleted: true });
        }
        if (method === "POST" && action === "invoke") {
          const data = z
            .object({
              capability: z.string(),
              input: z.record(z.string(), z.unknown()).default({}),
            })
            .parse(await body(request));
          const capability = connector.capabilities.find(
            (c) => c.id === data.capability,
          );
          if (!capability)
            throw new APIError(403, "This capability has not been approved.");
          const output = await readRemoteJSON(
            buildOperationURL(
              connector.url,
              capability,
              data.input,
              allowedHosts(),
            ),
          );
          await log(ownerId, "connector.invoked", id);
          return json({
            output,
            provenance: {
              connectorId: id,
              capability: capability.id,
              retrievedAt: now(),
            },
          });
        }
      }
    }
    if (resource === "keys") {
      if (method === "GET")
        return json({
          keys: await db
            .select({
              id: apiKeys.id,
              name: apiKeys.name,
              prefix: apiKeys.prefix,
              createdAt: apiKeys.createdAt,
            })
            .from(apiKeys)
            .where(eq(apiKeys.ownerId, ownerId)),
        });
      if (method === "POST") {
        const data = z
          .object({ name: z.string().trim().min(1).max(100) })
          .parse(await body(request));
        const token =
          "sozo_" +
          [...crypto.getRandomValues(new Uint8Array(32))]
            .map((x) => x.toString(16).padStart(2, "0"))
            .join("");
        const key = {
          id: uuid(),
          ownerId,
          name: data.name,
          hash: await digest(token),
          prefix: token.slice(0, 13),
          createdAt: now(),
        };
        await db.insert(apiKeys).values(key);
        await log(ownerId, "key.created", key.id);
        return json(
          {
            token,
            key: {
              id: key.id,
              name: key.name,
              prefix: key.prefix,
              createdAt: key.createdAt,
            },
          },
          201,
        );
      }
      if (method === "DELETE" && id) {
        await db
          .delete(apiKeys)
          .where(and(eq(apiKeys.id, id), eq(apiKeys.ownerId, ownerId)));
        await log(ownerId, "key.revoked", id);
        return json({ deleted: true });
      }
    }
    if (resource === "audit" && method === "GET")
      return json({
        events: await db
          .select()
          .from(audit)
          .where(eq(audit.ownerId, ownerId))
          .orderBy(desc(audit.createdAt))
          .limit(100),
      });
    throw new APIError(404, "API endpoint not found.");
  } catch (error) {
    if (error instanceof APIError)
      return json(
        { error: { code: `HTTP_${error.status}`, message: error.message } },
        error.status,
      );
    if (error instanceof z.ZodError)
      return json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; "),
          },
        },
        400,
      );
    if (
      error instanceof Error &&
      /approved host|operation|parameter|HTTPS|Response exceeds|Endpoint returned|identifiers|Specifications|JSON|Invalid option/.test(
        error.message,
      )
    )
      return json(
        { error: { code: "CONNECTOR_ERROR", message: error.message } },
        400,
      );
    console.error(JSON.stringify({ requestId, code: "INTERNAL_ERROR" }));
    return json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            "The workspace could not complete this request. Please try again.",
        },
      },
      500,
    );
  }
}
