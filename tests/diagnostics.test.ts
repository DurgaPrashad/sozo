import test from "node:test";
import assert from "node:assert/strict";
import { checkDatabase, classifyDatabaseError } from "../lib/platform/diagnostics";

test("database failures map to safe categories with fix hints", () => {
  assert.equal(classifyDatabaseError({ code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND db.secret-host" }).state, "host_not_found");
  assert.equal(classifyDatabaseError({ code: "ENETUNREACH" }).state, "network_unreachable");
  assert.equal(classifyDatabaseError({ code: "28P01", message: 'password authentication failed for user "postgres"' }).state, "password_rejected");
  assert.equal(classifyDatabaseError({ message: "Tenant or user not found" }).state, "pooler_user_not_found");
  assert.equal(classifyDatabaseError({ name: "DrizzleQueryError", cause: { code: "ECONNREFUSED" } }).state, "unreachable");
  const unknown = classifyDatabaseError({ code: "weird code with spaces", message: "postgres://user:pass@host" });
  assert.deepEqual(unknown, { state: "query_failed", code: undefined });
  assert.ok(!JSON.stringify(classifyDatabaseError({ code: "ENOTFOUND", message: "db.secret-host" })).includes("secret-host"));
});

test("a working database reports ok and a missing one reports not configured", async () => {
  const db = { prepare: () => ({ first: async () => ({ ok: 1 }) }) } as unknown as D1Database;
  assert.deepEqual(await checkDatabase(db), { state: "ok" });
  assert.deepEqual(await checkDatabase(undefined), { state: "not_configured" });
});
