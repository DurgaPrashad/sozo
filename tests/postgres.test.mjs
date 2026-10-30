// Runs SOZO's migrations, drizzle queries and raw SQL against real PostgreSQL
// (PGlite) through the D1 facade used on Supabase.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/d1";
import { and, count, eq, gt, sql } from "drizzle-orm";
import { migratePostgres } from "../scripts/migrate-db.mjs";

const require = createRequire(import.meta.url);
const compiled = "../.sites-runtime/tests/";
const { postgresD1, toPostgres } = require(compiled + "lib/platform/postgres-d1.js");
const schema = require(compiled + "db/schema.js");
const { D1CompanionStore } = require(compiled + "lib/companion/security.js");
const { cachedArticles } = require(compiled + "lib/science/article-cache.js");

// postgres.js-shaped client for the migrator.
const migrationClient = (pg) => {
  const unsafe = (run) => async (text, params) =>
    params ? (await run.query(text, params)).rows : ((await run.exec(text)).at(-1)?.rows ?? []);
  return { unsafe: unsafe(pg), begin: (work) => pg.transaction((tx) => work({ unsafe: unsafe(tx) })) };
};
const runner = (pg) => {
  const query = (run) => async (text, params) => {
    const result = await run.query(text, params, { rowMode: "array" });
    return { columns: result.fields.map((field) => field.name), rows: result.rows, count: result.affectedRows ?? result.rows.length };
  };
  return { query: query(pg), transaction: (work) => pg.transaction((tx) => work(query(tx))) };
};

async function database() {
  const pg = new PGlite();
  const logs = [];
  await migratePostgres(migrationClient(pg), (line) => logs.push(line));
  return { pg, d1: postgresD1(runner(pg)), logs };
}

test("placeholders and SOZO tables are rewritten for the sozo schema", () => {
  assert.equal(toPostgres('select "id" from "projects" where "projects"."owner_id" = ? limit ?'), 'select "id" from "sozo"."projects" where "sozo"."projects"."owner_id" = $1 limit $2');
  assert.equal(toPostgres("INSERT INTO sozo_companion_limits (key) VALUES (?) ON CONFLICT(key) DO UPDATE SET count=count+1"), "INSERT INTO sozo.sozo_companion_limits (key) VALUES ($1) ON CONFLICT(key) DO UPDATE SET count=count+1");
  assert.equal(toPostgres(`select 'what? "projects"' as x, "name" from "notebook"`), `select 'what? "projects"' as x, "name" from "sozo"."notebook"`);
  assert.equal(toPostgres('select * from "sozo"."projects"'), 'select * from "sozo"."projects"');
  assert.equal(toPostgres('insert into "login_limits" ("key") values (?) on conflict ("login_limits"."key") do update set "attempts" = "login_limits"."attempts"+1'), 'insert into "sozo"."login_limits" ("key") values ($1) on conflict ("key") do update set "attempts" = "sozo"."login_limits"."attempts"+1');
});

test("migrations create every table in the sozo schema with RLS, once", async () => {
  const { pg, logs } = await database();
  assert.deepEqual(logs, ["Applied migration 0000_icy_husk.", "Applied migration 0001_lumpy_magus."]);
  const tables = (await pg.query("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'sozo' ORDER BY tablename")).rows;
  assert.ok(tables.length >= 12);
  assert.ok(tables.every((table) => table.rowsecurity === true));
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'")).rows[0].n, 0);
  const again = [];
  await migratePostgres(migrationClient(pg), (line) => again.push(line));
  assert.deepEqual(again, []);
});

test("drizzle queries used by sign-in and the workspace run on PostgreSQL", async () => {
  const { d1 } = await database();
  const db = drizzle(d1, { schema });
  const now = new Date().toISOString(), later = new Date(Date.now() + 3600e3).toISOString();
  await db.insert(schema.sessions).values({ hash: "h1", ownerId: "o1", email: "a@b.c", name: "A", createdAt: now, expiresAt: later });
  const [session] = await db.select().from(schema.sessions).where(and(eq(schema.sessions.hash, "h1"), gt(schema.sessions.expiresAt, now))).limit(1);
  assert.equal(session.ownerId, "o1");
  const limitValues = { key: "k", attempts: 1, expiresAt: later };
  // The sign-in throttle's upsert in lib/auth/handler.ts.
  const upsert = () => db.insert(schema.loginLimits).values(limitValues).onConflictDoUpdate({ target: schema.loginLimits.key, set: { attempts: sql`${schema.loginLimits.attempts}+1` } }).returning();
  assert.equal((await upsert())[0].attempts, 1);
  assert.equal((await upsert())[0].attempts, 2);
  await db.insert(schema.runs).values({ id: "r1", ownerId: "o1", question: "Lunar ice", domain: "All", status: "running", mode: "focused", sources: ["crossref"], progress: [{ label: "saved", at: now }], createdAt: now, idempotencyKey: null, result: null, error: null, completedAt: null });
  const [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, "r1"));
  assert.deepEqual(run.sources, ["crossref"]);
  await db.update(schema.runs).set({ status: "completed", result: { answer: "ok" } }).where(eq(schema.runs.id, "r1"));
  assert.equal((await db.select().from(schema.runs))[0].status, "completed");
  const [{ total }] = await db.select({ total: count() }).from(schema.runs).where(eq(schema.runs.ownerId, "o1"));
  assert.equal(total, 1);
  await db.delete(schema.sessions).where(eq(schema.sessions.hash, "h1"));
  assert.equal((await db.select().from(schema.sessions)).length, 0);
});

test("companion sessions, limits and the article cache use raw SQL on PostgreSQL", async () => {
  const { d1 } = await database();
  const store = new D1CompanionStore(d1);
  assert.equal(await store.rateLimit("o1", "minute", 2, 60000), true);
  assert.equal(await store.rateLimit("o1", "minute", 2, 60000), true);
  assert.equal(await store.rateLimit("o1", "minute", 2, 60000), false);
  const issued = await store.issue("o1", "https://www.momar.si");
  assert.equal((await store.resolve(issued.token)).ownerId, "o1");
  await store.revoke("o1", issued.id);
  assert.equal(await store.resolve(issued.token), null);
  const published = await store.createPublishableKey("o1", "MOMAR", ["https://www.momar.si"]);
  assert.match(published.key, /^sozo_pk_[a-f0-9]{32}$/);
  assert.deepEqual((await store.resolvePublishableKey(published.key)).origins, ["https://www.momar.si"]);
  assert.equal((await store.listPublishableKeys("o1")).length, 1);
  assert.equal((await store.listPublishableKeys("o2")).length, 0);
  await store.revokePublishableKey("o2", published.id);
  assert.ok(await store.resolvePublishableKey(published.key), "another owner cannot revoke it");
  await store.revokePublishableKey("o1", published.id);
  assert.equal(await store.resolvePublishableKey(published.key), null);
  let loads = 0;
  const load = async () => { loads++; return { records: [], diagnostics: [{ ok: true }], retrievedAt: new Date().toISOString() }; };
  await cachedArticles(d1, { body: "moon", query: "ice", limit: 4 }, load);
  await cachedArticles(d1, { body: "moon", query: "ice", limit: 4 }, load);
  assert.equal(loads, 1);
});
