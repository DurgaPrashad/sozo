// Google sign-in through Supabase Auth, without the Supabase browser SDK.
//
// Preferred: Google's own button on SOZO's domain returns a Google ID token,
// which the server exchanges with Supabase (grant_type=id_token). Google then
// shows SOZO's domain instead of the project's supabase.co address.
// Fallback: Supabase's redirect flow with PKCE (grant_type=pkce).
// Either way the server talks to Supabase directly and trusts only its reply.
export type SupabaseConfig = { url: string; key: string; googleClientId: string | null };
export type SupabaseProfile = { id: string; email: string | null; name: string };

export class SupabaseAuthError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

type Env = Record<string, string | undefined>;

export function supabaseConfig(env: Env = process.env): SupabaseConfig | null {
  const raw = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const key = (
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();
  if (!raw || !key) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) return null;
  const googleClientId = (env.GOOGLE_CLIENT_ID || env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)?.trim();
  return {
    url: url.origin,
    key,
    googleClientId:
      googleClientId && /^[\w.-]+\.apps\.googleusercontent\.com$/.test(googleClientId)
        ? googleClientId
        : null,
  };
}

const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// RFC 7636: a 64-character verifier and its S256 challenge.
export async function pkcePair() {
  const verifier = [...crypto.getRandomValues(new Uint8Array(32))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const challenge = base64Url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))),
  );
  return { verifier, challenge };
}

export function supabaseAuthorizeUrl(config: SupabaseConfig, redirectTo: string, challenge: string) {
  const url = new URL(`${config.url}/auth/v1/authorize`);
  url.search = new URLSearchParams({
    provider: "google",
    redirect_to: redirectTo,
    code_challenge: challenge,
    code_challenge_method: "s256",
  }).toString();
  return url.toString();
}

async function token(config: SupabaseConfig, grant: "pkce" | "id_token", body: object, fetcher: typeof fetch) {
  let response: Response;
  try {
    response = await fetcher(`${config.url}/auth/v1/token?grant_type=${grant}`, {
      method: "POST",
      headers: { apikey: config.key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new SupabaseAuthError("auth_unreachable");
  }
  const text = await response.text();
  if (text.length > 262144) throw new SupabaseAuthError("auth_oversize");
  if (!response.ok) throw new SupabaseAuthError(`auth_${response.status}`);
  try {
    return profileFromUser((JSON.parse(text) as { user?: unknown }).user);
  } catch (error) {
    if (error instanceof SupabaseAuthError) throw error;
    throw new SupabaseAuthError("auth_invalid");
  }
}

export function profileFromUser(user: unknown): SupabaseProfile {
  const value = (user ?? {}) as {
    id?: unknown;
    email?: unknown;
    email_confirmed_at?: unknown;
    user_metadata?: { full_name?: unknown; name?: unknown };
  };
  if (typeof value.id !== "string" || !/^[0-9a-f-]{36}$/i.test(value.id))
    throw new SupabaseAuthError("user_invalid");
  // Only a verified address may match the owner or the allow list.
  const email =
    typeof value.email === "string" && value.email.includes("@") && value.email.length <= 254 && value.email_confirmed_at
      ? value.email.trim().toLowerCase()
      : null;
  const metadata = value.user_metadata ?? {};
  const name = [metadata.full_name, metadata.name, email].find(
    (candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0,
  );
  return { id: value.id.toLowerCase(), email, name: (name ?? "SOZO member").trim().slice(0, 200) };
}

export const exchangeSupabaseCode = (
  config: SupabaseConfig,
  code: string,
  verifier: string,
  fetcher: typeof fetch = fetch,
) => token(config, "pkce", { auth_code: code, code_verifier: verifier }, fetcher);

// `nonce` is the raw value whose SHA-256 the browser gave Google.
export const exchangeGoogleCredential = (
  config: SupabaseConfig,
  credential: string,
  nonce: string,
  fetcher: typeof fetch = fetch,
) => token(config, "id_token", { provider: "google", id_token: credential, nonce }, fetcher);

export const supabaseOwnerId = (profile: SupabaseProfile) => `supabase_${profile.id}`;
