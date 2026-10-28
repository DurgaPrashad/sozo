import { eq, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import { sessions, loginLimits, apiKeys, audit } from "../../db/schema";
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
const credentials = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256),
  returnTo: z.string().max(500).optional(),
});
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
    const ownerId =
      "workspace_" +
      (await hashSecret(configuredEmail.trim().toLowerCase())).slice(0, 24);
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
