export const SESSION_COOKIE = "sozo_session";
export const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;
const encoder = new TextEncoder();
export async function hashSecret(value: string): Promise<string> {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
  ]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
function fromHex(value: string) {
  return new Uint8Array(
    value.match(/.{2}/g)?.map((n) => parseInt(n, 16)) ?? [],
  );
}
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [algorithm, iterations, salt, expected] = stored.split("$");
  if (
    algorithm !== "pbkdf2-sha256" ||
    iterations !== "100000" ||
    !/^[a-f0-9]{32}$/.test(salt || "") ||
    !/^[a-f0-9]{64}$/.test(expected || "")
  )
    return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const result = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: fromHex(salt),
        iterations: 100000,
      },
      key,
      256,
    ),
  );
  const reference = fromHex(expected);
  let difference = 0;
  for (let i = 0; i < result.length; i++)
    difference |= result[i] ^ reference[i];
  return difference === 0;
}
export function createSessionToken() {
  return [...crypto.getRandomValues(new Uint8Array(32))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export function sessionToken(cookie: string | null) {
  const token = cookie
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(SESSION_COOKIE + "="))
    ?.slice(SESSION_COOKIE.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export function sessionCookie(
  token: string,
  secure: boolean,
  maxAge = SESSION_LIFETIME_MS / 1000,
) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}
export function safeReturnTo(value?: string | null) {
  if (
    !value ||
    !value.startsWith("/dashboard") ||
    value.startsWith("//") ||
    value.includes("\\")
  )
    return "/dashboard";
  const url = new URL(value, "https://sozo.local");
  return url.pathname === "/dashboard"
    ? url.pathname + url.search
    : "/dashboard";
}
