// Cloudflare Workers / Sites runtime. vite.config.ts aliases `@/lib/platform`
// here, so D1 comes from the Worker binding and the Sites edge identity
// headers are trusted (the platform strips client-supplied copies).
export { env } from "cloudflare:workers";
export const trustsHostIdentity = true;
export const clientAddress = (request: Request) =>
  request.headers.get("cf-connecting-ip");
