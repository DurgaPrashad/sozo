import { loadCompanionModel } from "../../../../lib/companion/model";
import { env } from "@/lib/platform";
import { getIdentity } from "../../../../lib/auth/identity";
import { createCompanionHandler } from "../../../../lib/companion/handler";
import { D1CompanionStore } from "../../../../lib/companion/security";
import { retrieveEvidence } from "../../../../lib/science/retrieval";

export const dynamic = "force-dynamic";
// Vercel: Sarvam requests time out at 45 s; keep the function alive past that.
export const maxDuration = 60;
const store = new D1CompanionStore(env.DB!);
function handler(request: Request) {
  return createCompanionHandler({
    identity: getIdentity,
    store,
    key: process.env.SARVAM_API_KEY,
    retrieve: async (message, body) => (await retrieveEvidence(`${body || ""} ${message}`.trim(), ["crossref", "europepmc"], "focused")).citations,
    model: loadCompanionModel,
  })(request);
}
export const GET = handler;
export const POST = handler;
export const DELETE = handler;
export const OPTIONS = handler;
