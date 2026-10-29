// Cloudflare Workers / Sites runtime. vite.config.ts aliases `@/lib/platform`
// here, so D1 comes from the Worker binding and the Sites edge identity
// headers are trusted (the platform strips client-supplied copies).
import { env } from "cloudflare:workers";
import { checkDatabase } from "./diagnostics";

export { env };
export const trustsHostIdentity = true;
export const clientAddress = (request: Request) =>
  request.headers.get("cf-connecting-ip");
export const databaseDiagnostics = async () => ({
  ...(await checkDatabase(env.DB)),
  driver: env.DB ? "d1" : "none",
});
