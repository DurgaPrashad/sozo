// Who may sign in with an external identity (Google via Supabase, Facebook).
// SOZO_WORKSPACE_EMAIL opens the owner workspace; SOZO_ALLOWED_EMAILS or
// SOZO_OPEN_SIGNUP=true admit others, each to a private workspace.
export type SignInPolicy = {
  ownerEmail: string | null;
  allowedEmails: string[];
  openSignup: boolean;
};

type Env = Record<string, string | undefined>;

export function signInPolicy(env: Env = process.env): SignInPolicy {
  return {
    ownerEmail: env.SOZO_WORKSPACE_EMAIL?.trim().toLowerCase() || null,
    allowedEmails: (env.SOZO_ALLOWED_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
    openSignup: env.SOZO_OPEN_SIGNUP?.trim().toLowerCase() === "true",
  };
}

// Pass only an email the identity provider has verified.
export function signInAccess(verifiedEmail: string | null, policy: SignInPolicy) {
  const email = verifiedEmail?.toLowerCase() ?? null;
  if (email && email === policy.ownerEmail) return "owner" as const;
  if (policy.openSignup || (email && policy.allowedEmails.includes(email)))
    return "member" as const;
  return null;
}
