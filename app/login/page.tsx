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
  const { error, returnTo } = await searchParams;
  const query =
    typeof returnTo === "string" ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
  const supabase = supabaseConfig();
  return (
    <WorkspaceLogin
      chatGPT={chatGPTSignInAvailable}
      googleHref={supabase ? `/api/auth/supabase${query}` : undefined}
      googleClientId={supabase?.googleClientId ?? undefined}
      facebookHref={facebookConfig() ? `/api/auth/facebook${query}` : undefined}
      initialError={typeof error === "string" ? errors[error] : undefined}
    />
  );
}
