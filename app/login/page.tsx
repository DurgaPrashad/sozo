import WorkspaceLogin from "../../components/workspace-login";
import { facebookConfig } from "../../lib/auth/facebook";
import { supabaseConfig } from "../../lib/auth/supabase";
import { chatGPTSignInAvailable } from "../chatgpt-auth";

const notAllowed =
  "does not have access to this workspace. Ask the workspace owner to add your email.";
const errors: Record<string, string> = {
  google_unavailable: "Google sign-in is not configured yet.",
  google_cancelled: "Google sign-in was cancelled.",
  google_expired: "That Google sign-in attempt expired. Please try again.",
  google_not_allowed: `This Google account ${notAllowed}`,
  google_failed: "Google sign-in could not complete. Please try again.",
  storage_unavailable:
    "You signed in, but SOZO's database is unavailable, so the session could not be saved. The workspace owner can see the cause at /api/v1/health.",
  facebook_unavailable: "Facebook sign-in is not configured yet.",
  facebook_cancelled: "Facebook sign-in was cancelled.",
  facebook_expired: "That Facebook sign-in attempt expired. Please try again.",
  facebook_not_allowed: `This Facebook account ${notAllowed}`,
  facebook_failed: "Facebook sign-in could not complete. Please try again.",
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { error, reason, returnTo } = await searchParams;
  const message = typeof error === "string" ? errors[error] : undefined;
  // Provider reason codes (e.g. auth_400) help support; they hold no secrets.
  const reference =
    typeof reason === "string" && /^[\w.-]{1,40}$/.test(reason) ? ` (Reference: ${reason})` : "";
  const query =
    typeof returnTo === "string" ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
  const supabase = supabaseConfig();
  return (
    <WorkspaceLogin
      chatGPT={chatGPTSignInAvailable}
      googleHref={supabase ? `/api/auth/supabase${query}` : undefined}
      googleClientId={supabase?.googleClientId ?? undefined}
      facebookHref={facebookConfig() ? `/api/auth/facebook${query}` : undefined}
      initialError={message ? message + reference : undefined}
    />
  );
}
