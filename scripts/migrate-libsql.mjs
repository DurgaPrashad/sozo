// Applies drizzle/*.sql to a libSQL (Turso) database once each, in journal
// order. Cloudflare D1 keeps using `wrangler d1 execute`, as in the README.
//
//   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... node scripts/migrate-libsql.mjs
//
// --if-configured: exit quietly when TURSO_DATABASE_URL is unset, and skip
// Vercel preview builds so an unmerged branch never migrates production.
import { readFile } from "node:fs/promises";
import { createClient } from "@libsql/client/web";

const optional = process.argv.includes("--if-configured");
const url = process.env.TURSO_DATABASE_URL;

if (!url) {
  if (optional) {
    console.log("TURSO_DATABASE_URL is not set; skipping database migrations.");
    process.exit(0);
  }
  throw new Error("Set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN) first.");
}
if (optional && process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
  console.log(`Vercel ${process.env.VERCEL_ENV} build; skipping database migrations.`);
  process.exit(0);
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
await client.execute(
  "CREATE TABLE IF NOT EXISTS __sozo_migrations (tag TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
);
const applied = new Set(
  (await client.execute("SELECT tag FROM __sozo_migrations")).rows.map((row) => row.tag),
);
const journal = JSON.parse(
  await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"),
);

for (const { tag } of journal.entries) {
  if (applied.has(tag)) continue;
  const sql = await readFile(new URL(`../drizzle/${tag}.sql`, import.meta.url), "utf8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  await client.batch(
    [
      ...statements,
      {
        sql: "INSERT INTO __sozo_migrations (tag, applied_at) VALUES (?, ?)",
        args: [tag, new Date().toISOString()],
      },
    ],
    "write",
  );
  console.log(`Applied migration ${tag}.`);
}
console.log("Database schema is up to date.");
client.close();
