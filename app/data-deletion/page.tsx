import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Delete your SOZO data" };

export default async function DataDeletion({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await searchParams;
  const confirmation =
    typeof code === "string" && /^[a-f0-9]{16}$/.test(code) ? code : null;
  return (
    <main className="data-deletion">
      <Link href="/" className="back-link">
        ← SOZO
      </Link>
      <h1>Delete your SOZO data</h1>
      {confirmation && (
        <p className="data-deletion-status" role="status">
          Request <code>{confirmation}</code> is complete. SOZO deleted the
          workspace linked to your Facebook login as soon as Facebook notified
          it.
        </p>
      )}
      <h2>What SOZO keeps when you sign in with Facebook</h2>
      <ul>
        <li>
          Your Facebook app-scoped ID, name and email address (if you share it),
          in your sign-in session.
        </li>
        <li>
          The workspace content you create: projects, research questions and
          results, notes, API keys and an activity log.
        </li>
      </ul>
      <p>SOZO does not keep your Facebook access token or password.</p>
      <h2>How to delete it</h2>
      <ol>
        <li>
          On Facebook, open <strong>Settings &amp; privacy → Settings → Apps
          and websites</strong>.
        </li>
        <li>
          Remove <strong>SOZO</strong>. Facebook notifies SOZO, which then
          deletes your private workspace and ends its sessions.
        </li>
      </ol>
      <p>
        If you signed in to the workspace owner&apos;s account, that workspace
        is not deleted; your Facebook name and email remain only in sign-in
        sessions, which expire within eight hours.
      </p>
    </main>
  );
}
