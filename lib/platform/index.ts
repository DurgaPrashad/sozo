import { createClient } from "@libsql/client/web";
import postgres from "postgres";
import { libsqlD1 } from "./libsql-d1";
import { postgresD1, type PostgresRunner } from "./postgres-d1";

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

let database: D1Database | undefined;
let databaseError = false;

// Never throws: a missing or malformed database setting must not break module
// loading (or the build); callers see "no database" and report it per request.
export const env: { readonly DB?: D1Database } = {
  get DB() {
    if (database || databaseError) return database;
    try {
      const postgresUrl =
        configuredValue(process.env.DATABASE_URL) || configuredValue(process.env.POSTGRES_URL);
      if (postgresUrl) return (database = postgresD1(postgresRunner(postgresUrl)));
      const url = configuredValue(process.env.TURSO_DATABASE_URL);
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
