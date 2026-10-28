import { createClient } from "@libsql/client/web";
import { libsqlD1 } from "./libsql-d1";

// Node.js hosts (Vercel, `next build`/`next start`). The Cloudflare/Sites
// build aliases this module to ./cloudflare.ts in vite.config.ts.
//
// Only the Sites edge strips and injects `oai-authenticated-user-*` headers.
// Anywhere else a client could forge them, so they are never trusted here.
export const trustsHostIdentity = false;

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
