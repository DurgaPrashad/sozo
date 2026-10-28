import { createClient } from "@libsql/client/web";
import { libsqlD1 } from "./libsql-d1";

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

let database: D1Database | undefined;

export const env: { readonly DB?: D1Database } = {
  get DB() {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) return undefined;
    database ??= libsqlD1(
      createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN }),
    );
    return database;
  },
};
