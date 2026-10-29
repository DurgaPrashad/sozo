import { createClient } from "@libsql/client/web";
import postgres from "postgres";
import { libsqlD1 } from "./libsql-d1";
import { postgresD1, type PostgresRunner } from "./postgres-d1";
import { checkDatabase, type DatabaseCheck } from "./diagnostics";

// Node.js hosts (Vercel, `next build`/`next start`). The Cloudflare/Sites
// build aliases this module to ./cloudflare.ts in vite.config.ts.
//
// Only the Sites edge strips and injects `oai-authenticated-user-*` headers.
// Anywhere else a client could forge them, so they are never trusted here.
export const trustsHostIdentity = false;

// Vercel sets x-real-ip and overwrites x-forwarded-for, so clients cannot
// choose the address used for sign-in throttling.
export function clientAddress(request: Request) {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    null
  );
}

export function postgresRunner(connectionString: string): PostgresRunner {
  const url = new URL(connectionString);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  // Pooler hints such as Vercel's `supa=base-pooler.x` are not server settings.
  url.search = "";
  // Supabase's transaction pooler does not support prepared statements.
  const sql = postgres(url.toString(), {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: local ? false : "require",
    onnotice: () => {},
  });
  const query = async (client: postgres.Sql | postgres.TransactionSql, text: string, params: unknown[]) => {
    const result = await client.unsafe(text, params as postgres.ParameterOrJSON<never>[]).values();
    return {
      columns: (result.columns ?? []).map((column) => column.name),
      rows: [...result] as unknown[][],
      count: result.count ?? 0,
    };
  };
  return {
    query: (text, params) => query(sql, text, params),
    transaction: <T,>(work: (run: PostgresRunner["query"]) => Promise<T>) =>
      sql.begin((tx) => work((text, params) => query(tx, text, params))) as Promise<T>,
  };
}

// Values copied from .env.example still contain <placeholders>; treat them
// as unset rather than as addresses to connect to.
export function configuredValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && !/[<>]/.test(trimmed) ? trimmed : undefined;
}

// DATABASE_URL first; then names Supabase's and Vercel's integrations use.
// POSTGRES_URL_NON_POOLING is the direct host, so it comes last.
const POSTGRES_SETTINGS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "SUPABASE_DB_URL",
  "SUPABASE_DATABASE_URL",
  "POSTGRES_URL_NON_POOLING",
] as const;
const isPostgresUrl = (value: string) => /^postgres(ql)?:\/\//i.test(value);
// A PostgreSQL URL pasted into TURSO_DATABASE_URL is still a PostgreSQL URL.
const postgresSetting = () => {
  for (const name of [...POSTGRES_SETTINGS, "TURSO_DATABASE_URL"]) {
    const value = configuredValue(process.env[name]);
    if (value && (name !== "TURSO_DATABASE_URL" || isPostgresUrl(value))) return { name, value };
  }
  return null;
};
const libsqlSetting = () => {
  const value = configuredValue(process.env.TURSO_DATABASE_URL);
  return value && !isPostgresUrl(value) ? value : undefined;
};

let database: D1Database | undefined;
let databaseError = false;

// Never throws: a missing or malformed database setting must not break module
// loading (or the build); callers see "no database" and report it per request.
export const env: { readonly DB?: D1Database } = {
  get DB() {
    if (database || databaseError) return database;
    try {
      const postgres = postgresSetting();
      if (postgres) return (database = postgresD1(postgresRunner(postgres.value)));
      const url = libsqlSetting();
      if (url)
        return (database = libsqlD1(
          createClient({ url, authToken: configuredValue(process.env.TURSO_AUTH_TOKEN) }),
        ));
    } catch (error) {
      databaseError = true;
      console.error(
        JSON.stringify({
          code: "DATABASE_CONFIG_INVALID",
          detail: (error as { code?: string }).code ?? "invalid connection string",
          hint: "Set DATABASE_URL to Supabase's Transaction pooler URI and URL-encode the password.",
        }),
      );
    }
    return undefined;
  },
};

// Reports only the kind of value, never the value itself.
const describeSetting = (value: string | undefined) => {
  const configured = configuredValue(value);
  if (!value?.trim()) return "missing";
  if (!configured) return "placeholder";
  if (isPostgresUrl(configured)) return "set (postgres URL)";
  if (/^(libsql|https?|wss?):\/\//i.test(configured)) return "set (libsql URL)";
  return "set (unrecognised value)";
};

// Public health detail: which settings exist (never their values), how the
// Postgres URL is shaped, and whether a trivial query succeeds.
export async function databaseDiagnostics() {
  const settings = Object.fromEntries(
    [...POSTGRES_SETTINGS, "TURSO_DATABASE_URL"].map((name) => [name, describeSetting(process.env[name])]),
  );
  const postgres = postgresSetting();
  const postgresUrl = postgres?.value;
  let target: { driver: string; using?: string; host?: string; port?: string } = { driver: "none" };
  let check: DatabaseCheck;
  if (postgresUrl) {
    try {
      const url = new URL(postgresUrl);
      target = {
        driver: "postgres",
        using: postgres!.name,
        host: /\.pooler\.supabase\.com$/.test(url.hostname)
          ? "supabase_pooler"
          : /^db\.[a-z0-9]+\.supabase\.co$/.test(url.hostname)
            ? "supabase_direct (IPv6-only; unreachable from Vercel)"
            : "other",
        port: url.port || "5432",
      };
      check = await checkDatabase(env.DB);
    } catch {
      check = {
        state: "invalid_url",
        hint: "DATABASE_URL is not a valid URL. URL-encode special characters in the password (@ → %40, # → %23, / → %2F).",
      };
    }
  } else if (libsqlSetting()) {
    target = { driver: "libsql", using: "TURSO_DATABASE_URL" };
    check = env.DB
      ? await checkDatabase(env.DB)
      : {
          state: "invalid_url",
          hint: "TURSO_DATABASE_URL is not a usable libSQL URL. For Supabase, delete it and set DATABASE_URL to the Transaction pooler URI.",
        };
  } else {
    check = {
      state: "not_configured",
      hint: "Set DATABASE_URL in Vercel (Production) to Supabase's Transaction pooler URI, then redeploy.",
    };
  }
  return { ...check, ...target, settings };
}
