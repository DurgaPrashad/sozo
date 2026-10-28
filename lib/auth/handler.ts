import { eq, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import {
  sessions,
  loginLimits,
  apiKeys,
  audit,
  projects,
  runs,
  notes,
  integrations,
} from "../../db/schema";
import {
  hashSecret,
  verifyPassword,
  createSessionToken,
  sessionToken,
  sessionCookie,
  safeReturnTo,
  SESSION_LIFETIME_MS,
} from "./crypto";
import { getIdentity } from "./identity";
import { clientAddress } from "@/lib/platform";
import {
  FacebookError,
  facebookConfig,
  facebookDialogUrl,
  facebookOwnerId,
  facebookProfile,
  parseSignedRequest,
  sameState,
} from "./facebook";
import { signInAccess, signInPolicy } from "./social";
import {
  SupabaseAuthError,
  exchangeGoogleCredential,
  exchangeSupabaseCode,
  pkcePair,
  supabaseAuthorizeUrl,
  supabaseConfig,
  supabaseOwnerId,
} from "./supabase";
const credentials = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256),
  returnTo: z.string().max(500).optional(),
});
const workspaceOwnerId = async (email: string) =>
  "workspace_" + (await hashSecret(email.trim().toLowerCase())).slice(0, 24);

async function startSession(
  identity: { id: string; email: string; name: string },
  method: string,
) {
  const db = getDb();
  const now = new Date();
  await db.delete(sessions).where(lt(sessions.expiresAt, now.toISOString()));
  await db.insert(audit).values({
    id: crypto.randomUUID(),
    ownerId: identity.id,
    action: "session.signed_in",
    resourceId: method,
    createdAt: now.toISOString(),
  });
  const token = createSessionToken();
  await db.insert(sessions).values({
    hash: await hashSecret(token),
    ownerId: identity.id,
    email: identity.email,
    name: identity.name,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS).toISOString(),
  });
  return token;
}

// Removes everything SOZO stores for a Facebook member's private workspace.
async function deleteWorkspace(ownerId: string) {
  const db = getDb();
  for (const table of [sessions, apiKeys, notes, runs, projects, integrations, audit])
    await db.delete(table).where(eq(table.ownerId, ownerId));
  try {
    await db.run(sql`DELETE FROM sozo_widget_sessions WHERE owner_id = ${ownerId}`);
  } catch {
    // The companion creates this table on first use; nothing to delete otherwise.
  }
}

// Short-lived HttpOnly cookie that ties an OAuth callback to the browser that
// started it. SameSite=Lax still sends it on the top-level return redirect.
const flowCookie = (name: string, path: string, value: string, secure: boolean, maxAge = 600) =>
  `${name}=${value}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;

function readCookie(request: Request, name: string) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(name + "="))
    ?.slice(name.length + 1);
}

function savedReturnTo(encoded?: string) {
  try {
    return safeReturnTo(decodeURIComponent(encoded || ""));
  } catch {
    return "/dashboard";
  }
}

function redirectResponse(origin: string, location: string, requestId: string, cookies: string[] = []) {
  const headers = new Headers({
    Location: new URL(location, origin).toString(),
    "Cache-Control": "no-store",
    "X-Request-ID": requestId,
  });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

// Applies the sign-in policy to a provider-verified identity and starts a
// SOZO session. Returns null when the identity has no access.
async function externalSignIn(
  identity: { email: string | null; name: string; memberId: string },
  method: string,
) {
  const access = signInAccess(identity.email, signInPolicy());
  if (!access) return null;
  const id = access === "owner" ? await workspaceOwnerId(identity.email!) : identity.memberId;
  return startSession({ id, email: identity.email ?? "", name: identity.name }, method);
}

const FACEBOOK_STATE_COOKIE = "sozo_facebook_state";

async function handleFacebook(
  request: Request,
  step: string | undefined,
  secure: boolean,
  requestId: string,
) {
  const url = new URL(request.url);
  const config = facebookConfig();
  const stateCookie = (value: string, maxAge?: number) =>
    flowCookie(FACEBOOK_STATE_COOKIE, "/api/auth/facebook", value, secure, maxAge);
  const redirect = (location: string, cookies: string[] = []) =>
    redirectResponse(url.origin, location, requestId, cookies);
  const fail = (code: string) => redirect(`/login?error=${code}`, [stateCookie("", 0)]);

  if (step === "data-deletion") {
    if (request.method !== "POST")
      return Response.json({ error: { message: "Method not allowed." } }, { status: 405 });
    if (!config)
      return Response.json({ error: { message: "Facebook sign-in is not configured." } }, { status: 503 });
    const raw = await request.text();
    if (raw.length > 8192)
      return Response.json({ error: { message: "Request is too large." } }, { status: 413 });
    try {
      const { userId } = await parseSignedRequest(
        new URLSearchParams(raw).get("signed_request") || "",
        config.appSecret,
      );
      await deleteWorkspace(facebookOwnerId({ id: userId, name: "", email: null }));
      const confirmation = createSessionToken().slice(0, 16);
      return Response.json({
        url: `${url.origin}/data-deletion?code=${confirmation}`,
        confirmation_code: confirmation,
      });
    } catch (error) {
      if (error instanceof FacebookError)
        return Response.json({ error: { message: "Invalid signed request." } }, { status: 400 });
      throw error;
    }
  }

  if (request.method !== "GET")
    return Response.json({ error: { message: "Method not allowed." } }, { status: 405 });
  if (!config) return redirect("/login?error=facebook_unavailable");
  const redirectUri = `${url.origin}/api/auth/facebook/callback`;

  if (!step) {
    const state = createSessionToken();
    const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
    return redirect(facebookDialogUrl(config, redirectUri, state), [
      stateCookie(`${state}.${encodeURIComponent(returnTo)}`),
    ]);
  }
  if (step !== "callback")
    return Response.json({ error: { message: "Not found." } }, { status: 404 });

  const [expectedState, returnTo] = readCookie(request, FACEBOOK_STATE_COOKIE)?.split(".") ?? [];
  if (url.searchParams.get("error")) return fail("facebook_cancelled");
  if (!sameState(expectedState ?? null, url.searchParams.get("state")))
    return fail("facebook_expired");
  const code = url.searchParams.get("code");
  if (!code || code.length > 2048) return fail("facebook_failed");
  try {
    const profile = await facebookProfile(config, code, redirectUri);
    const token = await externalSignIn(
      { email: profile.email, name: profile.name, memberId: facebookOwnerId(profile) },
      "facebook",
    );
    if (!token) return fail("facebook_not_allowed");
    return redirect(savedReturnTo(returnTo), [sessionCookie(token, secure), stateCookie("", 0)]);
  } catch (error) {
    console.error(
      JSON.stringify({
        requestId,
        code: error instanceof FacebookError ? `FACEBOOK_${error.code}` : "FACEBOOK_ERROR",
      }),
    );
    return fail("facebook_failed");
  }
}

const SUPABASE_PKCE_COOKIE = "sozo_supabase_pkce";

// Supabase's redirect flow (PKCE). The browser passes through the project's
// supabase.co address; /api/auth/google avoids that when GOOGLE_CLIENT_ID is set.
async function handleSupabase(
  request: Request,
  step: string | undefined,
  secure: boolean,
  requestId: string,
) {
  const url = new URL(request.url);
  const config = supabaseConfig();
  const pkceCookie = (value: string, maxAge?: number) =>
    flowCookie(SUPABASE_PKCE_COOKIE, "/api/auth/supabase", value, secure, maxAge);
  const redirect = (location: string, cookies: string[] = []) =>
    redirectResponse(url.origin, location, requestId, cookies);
  const fail = (code: string) => redirect(`/login?error=${code}`, [pkceCookie("", 0)]);

  if (request.method !== "GET")
    return Response.json({ error: { message: "Method not allowed." } }, { status: 405 });
  if (!config) return redirect("/login?error=google_unavailable");
  if (!step) {
    const { verifier, challenge } = await pkcePair();
    const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
    return redirect(
      supabaseAuthorizeUrl(config, `${url.origin}/api/auth/supabase/callback`, challenge),
      [pkceCookie(`${verifier}.${encodeURIComponent(returnTo)}`)],
    );
  }
  if (step !== "callback")
    return Response.json({ error: { message: "Not found." } }, { status: 404 });

  const [verifier, returnTo] = readCookie(request, SUPABASE_PKCE_COOKIE)?.split(".") ?? [];
  const error = url.searchParams.get("error");
  if (error) return fail(error === "access_denied" ? "google_cancelled" : "google_failed");
  if (!verifier || !/^[a-f0-9]{64}$/.test(verifier)) return fail("google_expired");
  const code = url.searchParams.get("code");
  if (!code || code.length > 2048) return fail("google_failed");
  try {
    const profile = await exchangeSupabaseCode(config, code, verifier);
    const token = await externalSignIn(
      { email: profile.email, name: profile.name, memberId: supabaseOwnerId(profile) },
      "google",
    );
    if (!token) return fail("google_not_allowed");
    return redirect(savedReturnTo(returnTo), [sessionCookie(token, secure), pkceCookie("", 0)]);
  } catch (error) {
    console.error(
      JSON.stringify({
        requestId,
        code: error instanceof SupabaseAuthError ? `SUPABASE_${error.code}` : "SUPABASE_ERROR",
      }),
    );
    return fail("google_failed");
  }
}

const googleCredential = z
  .object({
    credential: z.string().min(20).max(8192).regex(/^[\w-]+\.[\w-]+\.[\w-]+$/),
    nonce: z.string().regex(/^[a-f0-9]{64}$/),
    returnTo: z.string().max(500).optional(),
  })
  .strict();

// Google's button on SOZO's own domain posts its ID token here; Supabase
// verifies it (and the nonce) and returns the user.
async function handleGoogle(request: Request, secure: boolean, requestId: string) {
  const reply = (data: unknown, status = 200, cookie?: string) =>
    Response.json(data, {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-ID": requestId,
        ...(cookie ? { "Set-Cookie": cookie } : {}),
      },
    });
  if (request.method !== "POST") return reply({ error: { message: "Method not allowed." } }, 405);
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    return reply({ error: { message: "Cross-origin requests are not permitted." } }, 403);
  const config = supabaseConfig();
  if (!config?.googleClientId)
    return reply({ error: { message: "Google sign-in is not configured." } }, 503);
  const raw = await request.text();
  if (raw.length > 16384) return reply({ error: { message: "Request is too large." } }, 413);
  let data: z.infer<typeof googleCredential>;
  try {
    data = googleCredential.parse(JSON.parse(raw));
  } catch {
    return reply({ error: { message: "Google did not return a usable sign-in." } }, 400);
  }
  try {
    const profile = await exchangeGoogleCredential(config, data.credential, data.nonce);
    const token = await externalSignIn(
      { email: profile.email, name: profile.name, memberId: supabaseOwnerId(profile) },
      "google",
    );
    if (!token)
      return reply(
        { error: { message: "This Google account does not have access to this workspace. Ask the workspace owner to add your email." } },
        403,
      );
    return reply({ redirect: safeReturnTo(data.returnTo) }, 200, sessionCookie(token, secure));
  } catch (error) {
    console.error(
      JSON.stringify({
        requestId,
        code: error instanceof SupabaseAuthError ? `SUPABASE_${error.code}` : "SUPABASE_ERROR",
      }),
    );
    return reply({ error: { message: "Google sign-in could not complete. Please try again." } }, 502);
  }
}

export async function handleAuth(request: Request) {
  const requestId = crypto.randomUUID();
  const action = new URL(request.url).pathname
    .split("/")
    .filter(Boolean)
    .at(-1);
  const secure = new URL(request.url).protocol === "https:";
  const response = (data: unknown, status = 200, cookie?: string) =>
    Response.json(data, {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-ID": requestId,
        "X-Content-Type-Options": "nosniff",
        ...(cookie ? { "Set-Cookie": cookie } : {}),
      },
    });
  try {
    const [area, step] = new URL(request.url).pathname
      .replace(/^\/api\/auth\/?/, "")
      .split("/")
      .filter(Boolean);
    if (area === "facebook")
      return await handleFacebook(request, step, secure, requestId);
    if (area === "supabase")
      return await handleSupabase(request, step, secure, requestId);
    if (area === "google" && !step) return await handleGoogle(request, secure, requestId);
    if (request.method === "GET" && action === "session") {
      const identity = await getIdentity(request);
      return identity
        ? response({ user: identity })
        : response({ error: { message: "Sign in to continue." } }, 401);
    }
    if (request.method !== "POST")
      return response({ error: { message: "Method not allowed." } }, 405);
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      return response(
        { error: { message: "Cross-origin requests are not permitted." } },
        403,
      );
    const db = getDb();
    if (action === "logout") {
      const token = sessionToken(request.headers.get("cookie"));
      if (token)
        await db
          .delete(sessions)
          .where(eq(sessions.hash, await hashSecret(token)));
      return response({ ok: true }, 200, sessionCookie("", secure, 0));
    }
    if (!["login", "token"].includes(action || ""))
      return response({ error: { message: "Not found." } }, 404);
    if (!request.headers.get("content-type")?.includes("application/json"))
      return response({ error: { message: "Use application/json." } }, 415);
    const reader = request.body?.getReader();
    if (!reader)
      return response(
        { error: { message: "Email and password are required." } },
        400,
      );
    let raw = "";
    let bytes = 0;
    const decoder = new TextDecoder();
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 8192)
          return response({ error: { message: "Request is too large." } }, 413);
        raw += decoder.decode(part.value, { stream: true });
      }
    } finally {
      await reader.cancel();
    }
    const data = credentials.parse(JSON.parse(raw + decoder.decode()));
    const configuredEmail = process.env.SOZO_WORKSPACE_EMAIL;
    const verifier = process.env.SOZO_WORKSPACE_PASSWORD_HASH;
    if (!configuredEmail || !verifier)
      return response(
        {
          error: {
            message:
              "Workspace sign-in is currently unavailable. Please contact the workspace owner.",
          },
        },
        503,
      );
    const now = new Date();
    const ip = clientAddress(request) || "local";
    const bucket = Math.floor(now.getTime() / 600000);
    const limitKey = await hashSecret(`${ip}|${bucket}`);
    const [limit] = await db
      .insert(loginLimits)
      .values({
        key: limitKey,
        attempts: 1,
        expiresAt: new Date((bucket + 1) * 600000).toISOString(),
      })
      .onConflictDoUpdate({
        target: loginLimits.key,
        set: { attempts: sql`${loginLimits.attempts}+1` },
      })
      .returning();
    if (limit.attempts > 5)
      return response(
        {
          error: {
            message: "Too many sign-in attempts. Try again in ten minutes.",
          },
        },
        429,
      );
    const valid = await verifyPassword(data.password, verifier);
    if (
      !valid ||
      data.email.trim().toLowerCase() !== configuredEmail.trim().toLowerCase()
    )
      return response(
        { error: { message: "The email or password is incorrect." } },
        401,
      );
    const ownerId = await workspaceOwnerId(configuredEmail);
    const identity = {
      id: ownerId,
      email: configuredEmail,
      name: "Mission Researcher",
      method: "session",
    };
    await db.delete(loginLimits).where(eq(loginLimits.key, limitKey));
    await db.delete(sessions).where(lt(sessions.expiresAt, now.toISOString()));
    await db
      .delete(loginLimits)
      .where(lt(loginLimits.expiresAt, now.toISOString()));
    await db
      .insert(audit)
      .values({
        id: crypto.randomUUID(),
        ownerId,
        action: "session.signed_in",
        createdAt: now.toISOString(),
      });
    if (action === "token") {
      const token = "sozo_" + createSessionToken();
      await db
        .insert(apiKeys)
        .values({
          id: crypto.randomUUID(),
          ownerId,
          name: "Workspace API access",
          hash: await hashSecret(token),
          prefix: token.slice(0, 13),
          createdAt: now.toISOString(),
        });
      return response(
        { access_token: token, token_type: "Bearer", user: identity },
        201,
      );
    }
    const token = createSessionToken();
    await db
      .insert(sessions)
      .values({
        hash: await hashSecret(token),
        ownerId,
        email: identity.email,
        name: identity.name,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS).toISOString(),
      });
    return response(
      { user: identity, redirect: safeReturnTo(data.returnTo) },
      200,
      sessionCookie(token, secure),
    );
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return response(
        { error: { message: "Enter a valid email address and password." } },
        400,
      );
    console.error(JSON.stringify({ requestId, code: "AUTH_ERROR" }));
    return response(
      { error: { message: "Sign-in could not complete. Please try again." } },
      500,
    );
  }
}
