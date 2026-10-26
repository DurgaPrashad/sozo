// Local-only integration test. Creates isolated fake tenants and cleans up its own fixtures.
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { runCLI } from "../cli/sozo.mjs";
const base = process.env.SOZO_TEST_URL || "http://localhost:5173";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Smoke tests are restricted to the local preview.");
const owners = ["smoke-" + randomUUID(), "smoke-" + randomUUID()];
const tokens = owners.map(() => "sozo_" + randomBytes(32).toString("hex"));
mkdirSync(".sites-runtime", { recursive: true });
let passed = 0;
const measurements = [];
function sql(text) {
  const path = ".sites-runtime/smoke-fixtures.sql";
  writeFileSync(path, text);
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "./scripts/sites-env.mjs",
      "node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      "dist/server/wrangler.json",
      "--persist-to",
      ".wrangler/state",
      "--file",
      path,
    ],
    { encoding: "utf8" },
  );
  if (result.status)
    throw new Error("Could not prepare local test fixtures. " + result.stderr);
}
const check = (label, fn) => {
  fn();
  passed++;
  console.log("PASS " + label);
};
async function request(path, method = "GET", data, tenant = 0, headers = {}) {
  const start = performance.now();
  const response = await fetch(base + "/api/v1/" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(tenant >= 0 ? { Authorization: "Bearer " + tokens[tenant] } : {}),
      ...headers,
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  measurements.push(performance.now() - start);
  const text = await response.text();
  let output;
  try {
    output = JSON.parse(text);
  } catch {
    output = { error: { message: text } };
  }
  return { status: response.status, data: output, headers: response.headers };
}
try {
  sql(
    owners
      .map(
        (owner, i) =>
          `INSERT INTO api_keys (id,owner_id,name,hash,prefix,created_at) VALUES ('${randomUUID()}','${owner}','isolated smoke fixture','${createHash("sha256").update(tokens[i]).digest("hex")}','test-only','${new Date().toISOString()}');`,
      )
      .join("\n"),
  );
  const health = await request("health", "GET", undefined, -1);
  check("public health is reachable", () => assert.equal(health.status, 200));
  const anonymous = await request("workspace", "GET", undefined, -1);
  check("anonymous workspace access is rejected", () =>
    assert.equal(anonymous.status, 401),
  );
  const project = await request("projects", "POST", {
    name: "Isolated research fixture",
  });
  check("project creation persists", () => assert.equal(project.status, 201));
  const pid = project.data.project.id;
  const own = await request("workspace");
  const other = await request("workspace", "GET", undefined, 1);
  check("tenant records are isolated", () => {
    assert.ok(own.data.projects.some((p) => p.id === pid));
    assert.equal(other.data.projects.length, 0);
  });
  const cross = await request(
    "research",
    "POST",
    { question: "Mars terrain", projectId: pid },
    1,
  );
  check("cross-tenant project reference is rejected", () =>
    assert.equal(cross.status, 404),
  );
  const bad = await request("research", "POST", { question: "x", sources: [] });
  check("research inputs are validated", () => assert.equal(bad.status, 400));
  const csrf = await request(
    "notes",
    "POST",
    { title: "not saved", content: "" },
    0,
    { Origin: "https://untrusted.example" },
  );
  check("cross-origin writes are rejected", () =>
    assert.equal(csrf.status, 403),
  );
  const ssrf = await request("connectors/discover", "POST", {
    url: "https://127.0.0.1/openapi.json",
  });
  check("internal-network connector is rejected", () =>
    assert.equal(ssrf.status, 400),
  );
  const note = await request("notes", "POST", {
    title: "Evidence fixture",
    content: "Plain <script>untrusted</script> text",
    sourceUrl: "https://example.org/source",
  });
  check("notebook entry is persisted without interpretation", () =>
    assert.equal(note.status, 201),
  );
  const unsafe = await request("notes", "POST", {
    title: "Unsafe link",
    content: "",
    sourceUrl: "javascript:alert(1)",
  });
  check("unsafe notebook links are rejected", () =>
    assert.equal(unsafe.status, 400),
  );
  const input = {
    question: "Mars rover terrain slope route planning",
    projectId: pid,
    sources: ["crossref", "europepmc"],
    mode: "focused",
  };
  const started = await request("research", "POST", input, 0, {
    "Idempotency-Key": "smoke-idempotency",
  });
  check("asynchronous research returns a persisted ID", () =>
    assert.equal(started.status, 202),
  );
  const id = started.data.run.id;
  const repeated = await request("research", "POST", input, 0, {
    "Idempotency-Key": "smoke-idempotency",
  });
  check("idempotent retry does not start another job", () =>
    assert.equal(repeated.data.run.id, id),
  );
  const conflict = await request(
    "research",
    "POST",
    { ...input, question: "A different question" },
    0,
    { "Idempotency-Key": "smoke-idempotency" },
  );
  check("changed idempotent payload is rejected", () =>
    assert.equal(conflict.status, 409),
  );
  const forbidden = await request("research/" + id, "GET", undefined, 1);
  check("cross-tenant research access is rejected", () =>
    assert.equal(forbidden.status, 404),
  );
  let run;
  for (let i = 0; i < 35; i++) {
    run = (await request("research/" + id)).data.run;
    if (run.status !== "running") break;
    await new Promise((r) => setTimeout(r, 500));
  }
  check("real scientific sources return publications", () => {
    assert.ok(["completed", "partial"].includes(run.status));
    assert.ok(run.result.citations.length > 0);
    assert.ok(
      run.result.citations.every(
        (s) => s.url.startsWith("https://") && s.retrievedAt,
      ),
    );
  });
  console.log(
    JSON.stringify({
      liveSources: run.result.providerStatus,
      publications: run.result.citations.length,
      retrievalMs: run.result.usage.durationMs,
    }),
  );
  const report = await request(`research/${id}/report`);
  check("report preserves sources and limitations", () => {
    assert.equal(report.data.research_run_id, id);
    assert.ok(report.data.result.limitations.length);
  });
  const events = await fetch(base + `/api/v1/research/${id}/events`, {
    headers: { Authorization: "Bearer " + tokens[0] },
  });
  check("SSE endpoint exposes authenticated final progress", () =>
    assert.match(events.headers.get("content-type"), /text\/event-stream/),
  );
  const eventText = await events.text();
  check("SSE event contains real persisted result", () =>
    assert.ok(eventText.includes("event: result") && eventText.includes(id)),
  );
  const cancelStart = await request("research", "POST", {
    question: "Ocean circulation climate",
    sources: ["crossref"],
    mode: "focused",
  });
  await request(`research/${cancelStart.data.run.id}/cancel`, "POST", {});
  const cancelled = (await request("research/" + cancelStart.data.run.id)).data
    .run;
  check("cancellation reaches terminal state", () =>
    assert.equal(cancelled.status, "cancelled"),
  );
  const cli = await runCLI(["research", "status", id], {
    baseURL: base,
    token: tokens[0],
  });
  check("independent CLI retrieves real research", () =>
    assert.equal(cli.run.id, id),
  );
  const key = await request("keys", "POST", { name: "temporary test key" });
  check("API key is issued once", () =>
    assert.match(key.data.token, /^sozo_[a-f0-9]{64}$/),
  );
  const keyList = await request("keys");
  check("API key list never returns raw secrets", () =>
    assert.ok(keyList.data.keys.every((k) => !k.token && !k.hash)),
  );
  await request("keys/" + key.data.key.id, "DELETE");
  const revoked = await fetch(base + "/api/v1/workspace", {
    headers: { Authorization: "Bearer " + key.data.token },
  });
  check("revoked API key is rejected", () => assert.equal(revoked.status, 401));
  const audited = await request("audit");
  check("write activity is audited", () =>
    assert.ok(audited.data.events.some((e) => e.action === "research.started")),
  );
  console.log(
    JSON.stringify(
      {
        checksPassed: passed,
        requestsMeasured: measurements.length,
        localRequestP50Ms: measurements.sort((a, b) => a - b)[
          Math.floor(measurements.length * 0.5)
        ],
        note: "Local smoke timings only; not a production load benchmark.",
      },
      null,
      2,
    ),
  );
} finally {
  await new Promise((r) => setTimeout(r, 1500));
  for (const table of [
    "research_runs",
    "projects",
    "notebook",
    "integrations",
    "api_keys",
    "audit_events",
  ])
    sql(
      `DELETE FROM ${table} WHERE owner_id IN ('${owners[0]}','${owners[1]}');`,
    );
}
