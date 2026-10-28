import { env } from "cloudflare:workers";
import { getIdentity } from "../../../../lib/auth/identity";
import { createCompanionHandler } from "../../../../lib/companion/handler";
import { D1CompanionStore } from "../../../../lib/companion/security";
import { retrieveEvidence } from "../../../../lib/science/retrieval";

export const dynamic = "force-dynamic";
const store = new D1CompanionStore(env.DB!);
function handler(request: Request) {
  return createCompanionHandler({
    identity: getIdentity,
    store,
    key: process.env.SARVAM_API_KEY,
    retrieve: async (message, body) => (await retrieveEvidence(`${body || ""} ${message}`.trim(), ["crossref", "europepmc"], "focused")).citations,
    model: async request => {
      const url = new URL(request.url);
      const origin = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
        ? url.origin : "https://sozo-research-lab.sharpscarf8.chatgpt.site";
      return fetch(new URL("/models/sozo-companion.glb", origin), { redirect: "manual" });
    },
  })(request);
}
export const GET = handler;
export const POST = handler;
export const DELETE = handler;
export const OPTIONS = handler;
