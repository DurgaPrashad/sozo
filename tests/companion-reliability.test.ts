import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createCompanionHandler } from "../lib/companion/handler";
import { budgetFrom, chatProviders, cleanSecret, describeKey, generateReply, providerHealth, ProviderError } from "../lib/companion/provider";
import { effectiveStyle, styleInstruction } from "../lib/companion/context";
import type { CompanionStore, WidgetSession } from "../lib/companion/security";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

class MemoryStore implements CompanionStore {
  counts = new Map<string, number>();
  async issue(ownerId: string, allowedOrigin: string) { return { id: "s", ownerId, allowedOrigin, expiresAt: new Date(Date.now() + 600000).toISOString(), token: "sozo_widget_" + "a".repeat(64) }; }
  async resolve(): Promise<WidgetSession | null> { return null; }
  async rateLimit(ownerId: string, kind: string, maximum: number) { const n = (this.counts.get(kind) ?? 0) + 1; this.counts.set(kind, n); return n <= maximum; }
  async usage(_ownerId: string, kind: string) { return this.counts.get(kind) ?? 0; }
  async revoke() {}
}

const glb = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0]);
function setup(options: { retrieve?: (message: string, body: string | undefined, o: { timeoutMs: number }) => Promise<unknown>; budgetMs?: number; retrievalBudgetMs?: number; env?: Record<string, string> } = {}) {
  const store = new MemoryStore();
  const handler = createCompanionHandler({
    key: "fixture-sarvam",
    providers: chatProviders({ SARVAM_API_KEY: "fixture-sarvam", ...options.env }),
    store,
    identity: async (request) => (request.headers.get("Authorization") === "Bearer owner" ? { id: "owner", name: "Fixture workspace", method: "api_key", keyLabel: "MOMAR backend" } : null),
    retrieve: (options.retrieve ?? (async () => [])) as never,
    model: async () => new Response(glb, { headers: { "Content-Encoding": "br", "Content-Length": "999", ETag: '"v1"' } }),
    health: async () => ({ chat: { status: "ok" }, speech: { status: "ok" }, transcription: { status: "ok" }, checkedAt: "now" }),
    budgetMs: options.budgetMs,
    retrievalBudgetMs: options.retrievalBudgetMs,
  });
  const call = (action: string, body?: unknown, init: { method?: string; accept?: string } = {}) =>
    handler(new Request(`https://sozo.example/api/companion/${action}`, {
      method: init.method ?? (body === undefined ? "GET" : "POST"),
      headers: { Authorization: "Bearer owner", "Content-Type": "application/json", ...(init.accept ? { Accept: init.accept } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }));
  return { store, call };
}
const completion = (text: string) => Response.json({ choices: [{ message: { content: text } }], usage: { total_tokens: 12 } });
// AbortSignal.timeout's timer does not keep Node alive, so hold the loop open
// until the provider call is aborted, as a live server would.
const hangUntilAborted = (_url: unknown, init?: RequestInit) =>
  new Promise<Response>((_, reject) => {
    const keepAlive = setInterval(() => {}, 1000);
    init?.signal?.addEventListener("abort", () => { clearInterval(keepAlive); reject(init.signal!.reason); });
  });

test("a hanging conversation model returns provider_timeout, worded for conversation", async () => {
  globalThis.fetch = hangUntilAborted as typeof fetch;
  const started = Date.now();
  const response = await setup({ budgetMs: 6000 }).call("chat", { message: "Delta-v for a Hohmann transfer to GEO?" });
  const body = await response.json() as { error: { code: string; message: string; retryable: boolean; retryAfterSeconds: number; requestId: string } };
  assert.equal(response.status, 504);
  assert.equal(body.error.code, "provider_timeout");
  assert.equal(body.error.retryable, true);
  assert.ok(body.error.retryAfterSeconds > 0);
  assert.equal(response.headers.get("retry-after"), String(body.error.retryAfterSeconds));
  assert.equal(body.error.requestId, response.headers.get("x-request-id"));
  assert.match(body.error.message, /conversation/);
  assert.doesNotMatch(body.error.message, /speech|voice/i);
  assert.ok(Date.now() - started < 6000);
});

test("refused connections are retried once, then reported as provider_unreachable", async () => {
  let calls = 0;
  globalThis.fetch = (async () => { calls++; throw new TypeError("fetch failed"); }) as typeof fetch;
  await assert.rejects(
    generateReply(chatProviders({ SARVAM_API_KEY: "k" }), { message: "hi", history: [] }, [], { budget: budgetFrom(Date.now() + 20000) }),
    (error: unknown) => error instanceof ProviderError && error.code === "provider_unreachable" && error.retryable,
  );
  assert.equal(calls, 2);
});

test("slow literature is dropped within the budget and the answer says so", async () => {
  globalThis.fetch = (async () => completion("Ice is likely stable in cold traps.")) as typeof fetch;
  const slow = () => new Promise((resolve) => setTimeout(() => resolve([]), 20000).unref());
  const response = await setup({ retrieve: slow, retrievalBudgetMs: 300 }).call("chat", { message: "Lunar ice?", retrieve: true });
  const body = await response.json() as { reply: string; limitations: string[]; citations: unknown[]; timings: { retrievalMs: number }; requestId: string; style: string };
  assert.equal(response.status, 200);
  assert.equal(body.citations.length, 0);
  assert.ok(body.limitations.some((item) => /took longer/.test(item)));
  assert.ok(body.timings.retrievalMs < 2000);
  assert.equal(body.style, "standard");
  assert.ok(body.requestId);
});

function sseResponse(chunks: string[], failAfter = Infinity) {
  const encoder = new TextEncoder();
  let index = 0;
  return new Response(new ReadableStream({
    pull(controller) {
      if (index >= failAfter) return controller.error(new Error("connection dropped"));
      if (index >= chunks.length) return controller.close();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: chunks[index++] } }] })}\n\n`));
    },
  }), { headers: { "Content-Type": "text/event-stream" } });
}
const events = (text: string) => text.trim().split("\n\n").map((block) => ({ event: block.match(/^event: (.+)$/m)?.[1], data: JSON.parse(block.match(/^data: (.+)$/m)?.[1] ?? "null") }));

test("SSE streams status, deltas and done; a failure mid-stream arrives as an error event", async () => {
  globalThis.fetch = (async () => sseResponse(["Orbital ", "period is ", "92 minutes."])) as typeof fetch;
  const ok = await setup().call("chat", { message: "What does the ISS study?" }, { accept: "text/event-stream" });
  assert.match(ok.headers.get("content-type") ?? "", /event-stream/);
  const stream = events(await ok.text());
  const names = stream.map((e) => e.event);
  assert.equal(names[0], "status");
  assert.ok(names.indexOf("delta") > names.indexOf("status"));
  assert.equal(names.at(-1), "done");
  assert.equal(stream.filter((e) => e.event === "delta").map((e) => e.data.text).join(""), "Orbital period is 92 minutes.");
  assert.ok(stream.at(-1)!.data.requestId);

  globalThis.fetch = (async () => sseResponse(["Partial ", "answer"], 1)) as typeof fetch;
  const broken = events(await (await setup().call("chat", { message: "x" }, { accept: "text/event-stream" })).text());
  assert.equal(broken.at(-1)!.event, "error");
  assert.ok(broken.at(-1)!.data.error.code);
  assert.ok(broken.some((e) => e.event === "delta"));
});

test("voice failures say voice and conversation failures say conversation", async () => {
  globalThis.fetch = (async () => new Response("{}", { status: 503 })) as typeof fetch;
  const speech = await (await setup().call("text-to-speech", { text: "hello" })).json() as { error: { code: string; message: string } };
  assert.equal(speech.error.code, "provider_error");
  assert.match(speech.error.message, /voice/);
  assert.doesNotMatch(speech.error.message, /conversation/);
  const chat = await (await setup({ budgetMs: 4000 }).call("chat", { message: "hi" })).json() as { error: { message: string } };
  assert.match(chat.error.message, /conversation/);
  assert.doesNotMatch(chat.error.message, /voice|speech/i);
});

test("the model endpoint never claims a compression the body does not have", async () => {
  const response = await setup().call("model");
  assert.equal(response.headers.get("content-encoding"), null);
  assert.equal(response.headers.get("content-length"), null);
  assert.equal(response.headers.get("etag"), '"v1"');
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "glTF");
});

test("Meta Llama answers when Sarvam keeps failing", async () => {
  const hosts: string[] = [];
  globalThis.fetch = (async (url: string) => {
    hosts.push(new URL(url).hostname);
    return url.includes("llama.com") ? completion("Escape velocity on Mars is about 5.0 km/s.") : new Response("{}", { status: 503 });
  }) as typeof fetch;
  const providers = chatProviders({ SARVAM_API_KEY: "s", META_LLAMA_API_KEY: "m" });
  const result = await generateReply(providers, { message: "Mars escape velocity?", history: [] }, [], { budget: budgetFrom(Date.now() + 20000) });
  assert.equal(result.model, "Llama-4-Maverick-17B-128E-Instruct-FP8");
  assert.match(result.provider, /Meta/);
  assert.deepEqual(hosts, ["api.sarvam.ai", "api.sarvam.ai", "api.llama.com"]);
  assert.equal(chatProviders({ SARVAM_API_KEY: "s", META_LLAMA_API_KEY: "m", SOZO_CHAT_PROVIDER: "meta" })[0].id, "meta");
});

test("answer styles size the reply and brief grows when asked to explain", async () => {
  let sent: { max_tokens: number; messages: { content: string }[] } | null = null;
  globalThis.fetch = (async (_url: string, init: RequestInit) => { sent = JSON.parse(String(init.body)); return completion("Short."); }) as typeof fetch;
  const body = await (await setup().call("chat", { message: "Moon gravity?", style: "brief" })).json() as { style: string };
  assert.equal(body.style, "brief");
  assert.equal(sent!.max_tokens, 320);
  assert.match(sent!.messages[0].content, /two to four sentences/);
  assert.equal(effectiveStyle("brief", "Explain the rocket equation"), "standard");
  assert.match(styleInstruction("detailed"), /structured/);
});

test("whoami reports the key and remaining quota without using any", async () => {
  const { call, store } = setup();
  await call("chat", { message: "hi" }).catch(() => {});
  const before = store.counts.get("minute") ?? 0;
  const body = await (await call("whoami")).json() as { method: string; key: { label: string }; quotas: { minute: { limit: number; remaining: number } } };
  assert.equal(body.method, "api_key");
  assert.equal(body.key.label, "MOMAR backend");
  assert.equal(body.quotas.minute.limit, 30);
  assert.equal(body.quotas.minute.remaining, 30 - before);
  assert.equal(store.counts.get("minute") ?? 0, before);
});

test("health checks real provider calls and reports each service", async () => {
  globalThis.fetch = (async (url: string) => {
    if (url.includes("text-to-speech")) return new Response("{}", { status: 401 });
    if (url.includes("speech-to-text")) return Response.json({ transcript: "" });
    return completion("p");
  }) as typeof fetch;
  const health = await providerHealth({ SARVAM_API_KEY: "k" });
  assert.equal(health.chat.status, "ok");
  assert.equal(health.speech.status, "down");
  assert.equal(health.speech.code, "provider_auth");
  assert.equal(health.transcription.status, "ok");
  const unconfigured = await providerHealth({});
  assert.equal(unconfigured.chat.status, "unconfigured");
  assert.equal(unconfigured.speech.status, "unconfigured");
});

test("every error uses one shape with a request ID", async () => {
  const response = await setup().call("nowhere");
  const body = await response.json() as { error: { code: string; retryable: boolean; requestId: string } };
  assert.equal(response.status, 404);
  assert.equal(body.error.code, "not_found");
  assert.equal(body.error.retryable, false);
  assert.equal(body.error.requestId, response.headers.get("x-request-id"));
});

test("pasted API keys are cleaned, and unusable ones are reported without revealing them", async () => {
  assert.deepEqual(cleanSecret("  sk_live\u200b123 ").value, "sk_live123");
  assert.equal(cleanSecret('"sk_live123"').value, "sk_live123");
  assert.equal(cleanSecret("\u201csk_live123\u201d").value, "sk_live123");
  assert.equal(cleanSecret("SARVAM_API_KEY=sk_live123").value, "sk_live123");
  assert.equal(cleanSecret("Bearer sk_live123").value, "sk_live123");
  assert.equal(cleanSecret("<sarvam-api-subscription-key>").value, undefined);
  assert.equal(cleanSecret("sk_live\n123").invalid, true);
  const described = describeKey("'sk_live123'", "sk_");
  assert.deepEqual(described, { set: true, usable: true, length: 10, expectedPrefix: true, cleaned: ["removed surrounding quotes"] });
  assert.ok(!JSON.stringify(describeKey("sk_secret value", "sk_")).includes("secret"));
  assert.equal(chatProviders({ SARVAM_API_KEY: '"sk_live123"' })[0].headers["api-subscription-key"], "sk_live123");

  let sent = "";
  globalThis.fetch = (async (_url: string, init: RequestInit) => { sent = new Headers(init.headers).get("api-subscription-key") ?? ""; return completion("ok"); }) as typeof fetch;
  await generateReply(chatProviders({ SARVAM_API_KEY: " sk_live123\u00a0" }), { message: "hi", history: [] }, [], { budget: budgetFrom(Date.now() + 10000) });
  assert.equal(sent, "sk_live123");

  const broken = createCompanionHandler({
    key: "sk_live\n123", store: new MemoryStore(), identity: async () => ({ id: "owner" }),
    retrieve: async () => [], model: async () => new Response(glb),
  });
  const response = await broken(new Request("https://sozo.example/api/companion/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "hi" }) }));
  const body = await response.json() as { error: { code: string; message: string } };
  assert.equal(body.error.code, "provider_key_invalid");
  assert.match(body.error.message, /invalid characters/);
  const health = await providerHealth({ SARVAM_API_KEY: "sk_live\n123" });
  assert.equal(health.chat.code, "provider_key_invalid");
  assert.equal(health.speech.code, "provider_key_invalid");
  assert.equal(health.keys.SARVAM_API_KEY.problem, "contains spaces, line breaks or non-ASCII characters inside the key");
});
