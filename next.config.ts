import type { NextConfig } from "next";

// Used by `next build` (Vercel). The Cloudflare/Sites build runs through
// vinext and applies the same CORS rule in worker/index.ts.
const embeddable = ["embed", "models", "audio", "fonts"];

const nextConfig: NextConfig = {
  async headers() {
    return embeddable.map((prefix) => ({
      source: `/${prefix}/:path*`,
      headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
    }));
  },
  // Supabase returns Google sign-in to its Site URL (with ?code= or an error)
  // when the callback is missing from its Redirect URLs list. Hand those
  // arrivals to SOZO's callback; the query string is passed through.
  async redirects() {
    return ["code", "error_description"].map((key) => ({
      source: "/",
      has: [{ type: "query" as const, key }],
      destination: "/api/auth/supabase/callback",
      permanent: false,
    }));
  },
};

export default nextConfig;
