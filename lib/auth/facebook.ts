// Server-side "Login with Facebook" (OAuth code flow). The app secret never
// leaves the server, and identities come only from Graph API responses to
// requests SOZO itself makes, never from browser-supplied user IDs.
export const FACEBOOK_GRAPH_VERSION = "v26.0";

export type FacebookConfig = { appId: string; appSecret: string; version: string };
export type FacebookProfile = { id: string; name: string; email: string | null };
export class FacebookError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

type Env = Record<string, string | undefined>;

export function facebookConfig(env: Env = process.env): FacebookConfig | null {
  const appId = env.FACEBOOK_APP_ID?.trim();
  const appSecret = env.FACEBOOK_APP_SECRET?.trim();
  if (!appId || !/^\d{5,32}$/.test(appId) || !appSecret) return null;
  const version = env.FACEBOOK_GRAPH_VERSION?.trim();
  return {
    appId,
    appSecret,
    version: version && /^v\d{1,3}\.\d$/.test(version) ? version : FACEBOOK_GRAPH_VERSION,
  };
}

export const facebookOwnerId = (profile: FacebookProfile) => `facebook_${profile.id}`;

export function facebookDialogUrl(config: FacebookConfig, redirectUri: string, state: string) {
  const url = new URL(`https://www.facebook.com/${config.version}/dialog/oauth`);
  url.search = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: redirectUri,
    state,
    scope: "public_profile,email",
    response_type: "code",
  }).toString();
  return url.toString();
}

async function hmacSha256(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

const hex = (bytes: Uint8Array) =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

async function graphJSON(fetcher: typeof fetch, url: URL, init: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetcher(url, { ...init, redirect: "error", signal: AbortSignal.timeout(10000) });
  } catch {
    throw new FacebookError("graph_unreachable");
  }
  const text = await response.text();
  if (text.length > 65536) throw new FacebookError("graph_oversize");
  if (!response.ok) throw new FacebookError(`graph_${response.status}`);
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new FacebookError("graph_invalid");
  }
}

export async function facebookProfile(
  config: FacebookConfig,
  code: string,
  redirectUri: string,
  fetcher: typeof fetch = fetch,
): Promise<FacebookProfile> {
  const tokenUrl = new URL(`https://graph.facebook.com/${config.version}/oauth/access_token`);
  tokenUrl.search = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: redirectUri,
    code,
  }).toString();
  const token = (await graphJSON(fetcher, tokenUrl)).access_token;
  if (typeof token !== "string" || !token) throw new FacebookError("token_missing");

  const meUrl = new URL(`https://graph.facebook.com/${config.version}/me`);
  meUrl.search = new URLSearchParams({
    fields: "id,name,email",
    appsecret_proof: hex(await hmacSha256(config.appSecret, token)),
  }).toString();
  const me = await graphJSON(fetcher, meUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (typeof me.id !== "string" || !/^\d{1,32}$/.test(me.id)) throw new FacebookError("profile_invalid");
  const email =
    typeof me.email === "string" && me.email.length <= 254 && me.email.includes("@")
      ? me.email.trim().toLowerCase()
      : null;
  const name = typeof me.name === "string" && me.name.trim() ? me.name.trim().slice(0, 200) : "Facebook user";
  return { id: me.id, name, email };
}

function base64UrlBytes(value: string) {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

// Meta's data deletion callback posts a signed_request: base64url(HMAC-SHA256
// signature).base64url(JSON payload), signed with the app secret.
export async function parseSignedRequest(signedRequest: string, appSecret: string) {
  const [signature, payload, extra] = signedRequest.split(".");
  if (!signature || !payload || extra !== undefined || signedRequest.length > 4096)
    throw new FacebookError("signed_request_invalid");
  let expected: Uint8Array, actual: Uint8Array, data: { algorithm?: string; user_id?: unknown };
  try {
    expected = await hmacSha256(appSecret, payload);
    actual = base64UrlBytes(signature);
    data = JSON.parse(new TextDecoder().decode(base64UrlBytes(payload)));
  } catch {
    throw new FacebookError("signed_request_invalid");
  }
  let difference = expected.length ^ actual.length;
  for (let i = 0; i < expected.length; i++) difference |= expected[i] ^ (actual[i] ?? 0);
  if (difference !== 0) throw new FacebookError("signed_request_signature");
  if (data.algorithm?.toUpperCase() !== "HMAC-SHA256" || typeof data.user_id !== "string" || !/^\d{1,32}$/.test(data.user_id))
    throw new FacebookError("signed_request_payload");
  return { userId: data.user_id };
}

export function sameState(expected: string | null, received: string | null) {
  if (!expected || !received || !/^[a-f0-9]{64}$/.test(expected) || expected.length !== received.length)
    return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  return difference === 0;
}
