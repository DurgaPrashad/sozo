import { env } from "@/lib/platform";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Database is unavailable. On Cloudflare/Sites, set the `d1` field in .openai/hosting.json to `DB`; on Vercel or Node.js, set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN."
    );
  }

  return drizzle(env.DB, { schema });
}
