// Applies drizzle/*.sql once each, in journal order, to the database the
// Node.js host uses: PostgreSQL/Supabase (DATABASE_URL or POSTGRES_URL) or
// libSQL/Turso (TURSO_DATABASE_URL). Cloudflare D1 keeps using
// `wrangler d1 execute`, as in the README.
//
//   DATABASE_URL=postgresql://... node scripts/migrate-db.mjs
//
// --if-configured: exit quietly when no database is configured, and skip
// Vercel preview builds so an unmerged branch never migrates production.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const POSTGRES_SCHEMA = "sozo";

// Tables lib/ creates on first use; created here too so they are locked down.
const POSTGRES_RUNTIME_TABLES = `
CREATE TABLE IF NOT EXISTS sozo.sozo_widget_sessions (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, owner_id TEXT NOT NULL, allowed_origin TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS sozo_widget_expiry ON sozo.sozo_widget_sessions(expires_at);
CREATE TABLE IF NOT EXISTS sozo.sozo_companion_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sozo.sozo_article_cache (cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL, retrieved_at TEXT NOT NULL);
`;

// Supabase exposes only selected schemas through its Data API; also deny its
// API roles outright and enable RLS (the owning role SOZO connects as bypasses it).
const POSTGRES_LOCKDOWN = `
DO $$
DECLARE t record; r text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'sozo' LOOP
    EXECUTE format('ALTER TABLE sozo.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA sozo FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA sozo FROM %I', r);
    END IF;
  END LOOP;
END $$;
`;

export function migrationStatements(sql, dialect) {
  const statements = sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  // drizzle-kit writes SQLite DDL with backtick identifiers; the column types
  // it uses (text, integer) are valid PostgreSQL.
  return dialect === "postgres"
    ? statements.map((statement) => statement.replace(/`/g, '"'))
    : statements;
}

async function journal() {
  const { entries } = JSON.parse(
    await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"),
  );
  return Promise.all(
    entries.map(async ({ tag }) => ({
      tag,
      sql: await readFile(new URL(`../drizzle/${tag}.sql`, import.meta.url), "utf8"),
    })),
  );
}

// `sql` is a postgres.js client (or anything with unsafe/begin, for tests).
export async function migratePostgres(sql, log = console.log) {
  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS ${POSTGRES_SCHEMA}`);
  await sql.unsafe(
    `CREATE TABLE IF NOT EXISTS ${POSTGRES_SCHEMA}.__sozo_migrations (tag TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`,
  );
  const applied = new Set(
    (await sql.unsafe(`SELECT tag FROM ${POSTGRES_SCHEMA}.__sozo_migrations`)).map((row) => row.tag),
  );
  for (const { tag, sql: text } of await journal()) {
    if (applied.has(tag)) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL search_path TO ${POSTGRES_SCHEMA}`);
      for (const statement of migrationStatements(text, "postgres")) await tx.unsafe(statement);
      await tx.unsafe(
        `INSERT INTO ${POSTGRES_SCHEMA}.__sozo_migrations (tag, applied_at) VALUES ($1, $2)`,
        [tag, new Date().toISOString()],
      );
    });
    log(`Applied migration ${tag}.`);
  }
  await sql.unsafe(POSTGRES_RUNTIME_TABLES);
  await sql.unsafe(POSTGRES_LOCKDOWN);
}

async function migrateLibsql(client, log = console.log) {
  await client.execute(
    "CREATE TABLE IF NOT EXISTS __sozo_migrations (tag TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const applied = new Set(
    (await client.execute("SELECT tag FROM __sozo_migrations")).rows.map((row) => row.tag),
  );
  for (const { tag, sql } of await journal()) {
    if (applied.has(tag)) continue;
    await client.batch(
      [
        ...migrationStatements(sql, "sqlite"),
        {
          sql: "INSERT INTO __sozo_migrations (tag, applied_at) VALUES (?, ?)",
          args: [tag, new Date().toISOString()],
        },
      ],
      "write",
    );
    log(`Applied migration ${tag}.`);
  }
}

async function main() {
  const optional = process.argv.includes("--if-configured");
  // Template values such as libsql://<database>-<org>.turso.io count as unset.
  const configured = (value) => (value?.trim() && !/[<>]/.test(value) ? value.trim() : undefined);
  const isPostgres = (value) => /^postgres(ql)?:\/\//i.test(value ?? "");
  const turso = configured(process.env.TURSO_DATABASE_URL);
  // A PostgreSQL URL pasted into TURSO_DATABASE_URL is still a PostgreSQL URL.
  const postgresUrl =
    ["DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "SUPABASE_DB_URL", "SUPABASE_DATABASE_URL", "POSTGRES_URL_NON_POOLING"]
      .map((name) => configured(process.env[name]))
      .find(Boolean) || (isPostgres(turso) ? turso : undefined);
  const tursoUrl = isPostgres(turso) ? undefined : turso;
  if (!postgresUrl && !tursoUrl) {
    if (optional) {
      console.log("No database is configured; skipping database migrations.");
      return;
    }
    throw new Error("Set DATABASE_URL (Supabase/PostgreSQL) or TURSO_DATABASE_URL first.");
  }
  if (optional && process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    console.log(`Vercel ${process.env.VERCEL_ENV} build; skipping database migrations.`);
    return;
  }
  if (postgresUrl) {
    const { default: postgres } = await import("postgres");
    const url = new URL(postgresUrl);
    const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    url.search = "";
    const sql = postgres(url.toString(), {
      prepare: false,
      max: 1,
      ssl: local ? false : "require",
      onnotice: () => {},
    });
    try {
      await migratePostgres(sql);
    } finally {
      await sql.end();
    }
  } else {
    const { createClient } = await import("@libsql/client/web");
    const client = createClient({ url: tursoUrl, authToken: configured(process.env.TURSO_AUTH_TOKEN) });
    await migrateLibsql(client);
    client.close();
  }
  console.log("Database schema is up to date.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    // During a deploy (--if-configured), an unreachable or misconfigured
    // database must not block the site; sign-in reports it at runtime.
    if (!process.argv.includes("--if-configured")) throw error;
    console.warn(
      `::warning:: Database migration skipped: ${error?.code ?? ""} ${error?.message ?? error}`.trim(),
    );
    console.warn(
      "Check DATABASE_URL: use Supabase's Transaction pooler URI (port 6543) and URL-encode the password, then redeploy.",
    );
  }
}
