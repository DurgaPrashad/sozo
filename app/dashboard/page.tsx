import { redirect } from "next/navigation";
import { getIdentity } from "../../lib/auth/identity";
import SozoWorkspace from "../../components/sozo-workspace";
export const dynamic = "force-dynamic";
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await getIdentity())) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams))
      if (
        ["view", "body", "question"].includes(key) &&
        typeof value === "string"
      )
        query.set(key, value.slice(0, 1500));
    redirect(
      "/login?returnTo=" +
        encodeURIComponent("/dashboard" + (query.size ? "?" + query : "")),
    );
  }
  return <SozoWorkspace />;
}
