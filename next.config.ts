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
};

export default nextConfig;
