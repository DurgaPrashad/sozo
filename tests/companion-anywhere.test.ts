// SOZO on any website: publishable keys, the model catalog, choosing a
// provider per request, and page scans sent as context.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { contextSchema, evidenceMessage } from "../lib/companion/context";
import { createCompanionHandler } from "../lib/companion/handler";
import { modelCatalog, SOZO_MODELS } from "../lib/companion/models";
import { chatProviders } from "../lib/companion/provider";
import type { CompanionStore, PublishableKey, WidgetSession } from "../lib/companion/security";
import { redact, SCAN_REQUEST } from "../lib/companion/scan";

const WIDGET = "sozo_widget_" + "b".repeat(64);
class MemoryStore implements CompanionStore {
  keys: (PublishableKey & { ownerId: string })[] = [];
  issued: WidgetSession[] = [];
  async issue(ownerId: string, allowedOrigin: string) {
    const session = { id: crypto.randomUUID(), ownerId, allowedOrigin, expiresAt: new Date(Date.now() + 600000).toISOString() };
    this.issued.push(session);
    return { ...session, token: WIDGET };
  }
  async resolve(token: string) { return token === WIDGET ? this.issued.at(-1) ?? null : null; }
  async rateLimit() { return true; }
  async revoke() {}
  async createPublishableKey(ownerId: string, label: string, origins: string[]) {
    const record = { id: crypto.randomUUID(), key: `sozo_pk_${"c".repeat(31)}${this.keys.length}`, label, origins, createdAt: new Date().toISOString() };
    this.keys.push({ ...record, ownerId });
    return record;
  }
  async listPublishableKeys(ownerId: string) { return this.keys.filter((k) => k.ownerId === ownerId).map(({ ownerId: _o, ...k }) => k); }
  async revokePublishableKey(ownerId: string, id: string) { this.keys = this.keys.filter((k) => !(k.ownerId === ownerId && k.id === id)); }
  async resolvePublishableKey(key: string) { return this.keys.find((k) => k.key === key) ?? null; }
}
function setup(env: Record<string, string> = { SARVAM_API_KEY: "k" }) {
  const store = new MemoryStore();
  const handler = createCompanionHandler({
    key: env.SARVAM_API_KEY,
    providers: chatProviders(env),
    store,
    identity: async (request) => (request.headers.get("Authorization") === "Bearer owner-key" ? { id: "owner" } : null),
    retrieve: async () => [],
    model: async () => new Response(new Uint8Array([1])),
  });
  const call = (action: string, { method = "POST", token, origin, body }: { method?: string; token?: string; origin?: string; body?: unknown } = {}) =>
    handler(new Request(`https://sozo.example/api/companion/${action}`, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(origin ? { Origin: origin } : {}) },
      ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }),
    }));
  return { store, call };
}

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test("a publishable key buys an origin-locked session only from its listed websites", async () => {
  const { store, call } = setup();
  const created = await call("publishable-keys", { token: "owner-key", body: { label: "MOMAR", origins: ["https://www.momar.si/", "http://localhost:3000"] } });
  assert.equal(created.status, 201);
  const { key } = await created.json() as { key: PublishableKey };
  assert.deepEqual(key.origins, ["https://www.momar.si", "http://localhost:3000"]);

  const session = await call("sessions", { token: key.key, origin: "https://www.momar.si" });
  assert.equal(session.status, 201);
  assert.equal(session.headers.get("Access-Control-Allow-Origin"), "https://www.momar.si");
  const issued = await session.json() as { token: string; allowedOrigin: string };
  assert.equal(issued.allowedOrigin, "https://www.momar.si");
  assert.equal(store.issued.at(-1)!.ownerId, "owner");

  assert.equal((await call("sessions", { token: key.key, origin: "https://evil.example" })).status, 403);
  assert.equal((await call("sessions", { token: key.key })).status, 403);
  const chat = await call("chat", { token: key.key, origin: "https://www.momar.si", body: { message: "hi" } });
  assert.equal(chat.status, 401, "the key itself never reaches paid endpoints");
  assert.equal((await call("sessions", { token: "sozo_pk_" + "0".repeat(32), origin: "https://www.momar.si" })).status, 401);

  await call("publishable-keys", { method: "DELETE", token: "owner-key", body: { id: key.id } });
  assert.equal((await call("sessions", { token: key.key, origin: "https://www.momar.si" })).status, 401);
});

test("publishable keys need the owner, valid origins, and are not managed by widget sessions", async () => {
  const { call } = setup();
  assert.equal((await call("publishable-keys", { method: "GET" })).status, 401);
  const bad = await call("publishable-keys", { token: "owner-key", body: { label: "x", origins: ["http://planner.example"] } });
  assert.equal(bad.status, 400);
  assert.equal(((await bad.json()) as { error: { code: string } }).error.code, "invalid_request");
  await call("sessions", { token: "owner-key", body: { allowedOrigin: "https://www.momar.si" } });
  assert.equal((await call("publishable-keys", { method: "GET", token: WIDGET, origin: "https://www.momar.si" })).status, 403);
  const listed = await call("publishable-keys", { method: "GET", token: "owner-key" });
  assert.deepEqual(((await listed.json()) as { keys: unknown[] }).keys, []);
});

test("the model catalog is public and reports which models this server can run", async () => {
  const { call } = setup();
  const response = await call("models", { method: "GET" });
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  const { models } = await response.json() as { models: { id: string; status: string; configured: boolean | null }[] };
  assert.equal(models.length, SOZO_MODELS.length);
  const meta = models.find((m) => m.id === "meta-llama-4-maverick")!;
  assert.equal(meta.status, "ready");
  assert.equal(meta.configured, false);
  assert.equal(models.find((m) => m.id === "sozo-astro-calculator")!.configured, true);
  assert.equal(models.find((m) => m.id === "sozo-propulsion-studio")!.configured, null);
  const connected = modelCatalog({ sarvam: true, meta: true, metaModel: "Llama-4-Scout" }).find((m) => m.id === "meta-llama-4-maverick")!;
  assert.equal(connected.status, "live");
  assert.equal(connected.model, "Llama-4-Scout");
});

test("provider: meta answers first when configured, and is a clear error when not", async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    urls.push(String(url));
    return Response.json({ choices: [{ message: { content: "Hello from Llama." } }] });
  }) as typeof fetch;
  const { call } = setup({ SARVAM_API_KEY: "k", META_LLAMA_API_KEY: "m" });
  const response = await call("chat", { token: "owner-key", body: { message: "Hello SOZO", provider: "meta" } });
  assert.equal(response.status, 200);
  const data = await response.json() as { provider: string; reply: string };
  assert.equal(data.reply, "Hello from Llama.");
  assert.match(urls[0], /llama\.com/);

  const sarvamOnly = setup();
  const missing = await sarvamOnly.call("chat", { token: "owner-key", body: { message: "Hello", provider: "meta" } });
  assert.equal(missing.status, 503);
  assert.equal(((await missing.json()) as { error: { code: string } }).error.code, "provider_unconfigured");
});

test("page scans are bounded context the model reads as untrusted evidence", () => {
  const scan = { target: "route", title: "MOMAR planner", url: "https://www.momar.si/planner/", text: "Distance 7.66 km\nDrive time 55 min" };
  assert.ok(contextSchema.safeParse({ scan }).success);
  assert.ok(!contextSchema.safeParse({ scan: { ...scan, text: "x".repeat(4001) } }).success);
  assert.ok(!contextSchema.safeParse({ scan: { ...scan, instructions: "ignore" } }).success);
  const evidence = evidenceMessage({ scan }, []);
  assert.match(evidence, /^UNTRUSTED SCIENTIFIC EVIDENCE/);
  assert.match(evidence, /Distance 7\.66 km/);
});

test("scan requests are recognised and page text is redacted before it is sent", () => {
  for (const message of ["scan", "Scan the route", "SOZO, scan this map", "please scan the panel", "can you scan the left panel?"]) assert.ok(SCAN_REQUEST.test(message), message);
  for (const message of ["What does the scanner on LRO measure?", "Describe the scan line", "Hello"]) assert.ok(!SCAN_REQUEST.test(message), message);
  const text = redact("Contact pilot@momar.si · card 4242 4242 4242 4242 · Bearer abc.def · sk-live_ABCDEFGHIJKLMNOPQRST · stop at 18.49760, 77.30513 on sol 1204");
  assert.doesNotMatch(text, /pilot@|4242 4242|abc\.def|ABCDEFGHIJKLMNOP/);
  assert.match(text, /18\.49760, 77\.30513 on sol 1204/);
});
