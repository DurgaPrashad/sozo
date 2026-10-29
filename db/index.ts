import { env } from "@/lib/platform";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export class DatabaseUnavailableError extends Error {
  constructor() {
    super(
      "Database is unavailable. On Vercel or Node.js set DATABASE_URL (Supabase Transaction pooler URI); on Cloudflare/Sites set the `d1` field in .openai/hosting.json to `DB`.",
    );
    this.name = "DatabaseUnavailableError";
  }
}

export function getDb() {
  if (!env.DB) throw new DatabaseUnavailableError();
  return drizzle(env.DB, { schema });
}

// Errors from reaching or querying the database, as opposed to bad input.
export function isStorageError(error: unknown) {
  const name = (error as { name?: string })?.name ?? "";
  return (
    error instanceof DatabaseUnavailableError ||
    ["DrizzleQueryError", "PostgresError", "LibsqlError"].includes(name) ||
    /^(E[A-Z]+|CONNECT_TIMEOUT)$/.test(String((error as { code?: unknown })?.code ?? ""))
  );
}
