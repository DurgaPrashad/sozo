import { loadCompanionModel } from "../../../../lib/companion/model";
import { env } from "@/lib/platform";
import { getIdentity } from "../../../../lib/auth/identity";
import { createCompanionHandler } from "../../../../lib/companion/handler";
import { D1CompanionStore, type CompanionStore } from "../../../../lib/companion/security";
import { ProviderError } from "../../../../lib/companion/provider";
import { retrieveEvidence } from "../../../../lib/science/retrieval";

export const dynamic = "force-dynamic";
// Vercel: Sarvam requests time out at 45 s; keep the function alive past that.
export const maxDuration = 60;
// Storage is looked up per request so a missing database never breaks module
// loading; status and model requests do not need it.
const unavailable = (): never => {
  throw new ProviderError(503, "storage_unconfigured", "Workspace storage is not configured on this server.");
};
const missingStore: CompanionStore = { issue: unavailable, resolve: unavailable, rateLimit: unavailable, revoke: unavailable };
function handler(request: Request) {
  const db = env.DB;
  return createCompanionHandler({
    identity: getIdentity,
    store: db ? new D1CompanionStore(db) : missingStore,
    key: process.env.SARVAM_API_KEY,
    retrieve: async (message, body) => (await retrieveEvidence(`${body || ""} ${message}`.trim(), ["crossref", "europepmc"], "focused")).citations,
    model: loadCompanionModel,
  })(request);
}
export const GET = handler;
export const POST = handler;
export const DELETE = handler;
export const OPTIONS = handler;
