import { headers } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../../db";
import { apiKeys, sessions } from "../../db/schema";
import { getChatGPTUser } from "../../app/chatgpt-auth";
import { hashSecret, sessionToken } from "./crypto";
export type Identity = {
  id: string;
  name: string;
  email: string;
  method: "session" | "chatgpt" | "api_key";
};
export async function getIdentity(request?: Request): Promise<Identity | null> {
  const h = request?.headers ?? (await headers());
  const authorization = h.get("authorization");
  if (authorization) {
    const token = authorization.match(/^Bearer (sozo_[a-f0-9]{64})$/)?.[1];
    if (!token) return null;
    const [key] = await getDb()
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.hash, await hashSecret(token)))
      .limit(1);
    return key
      ? { id: key.ownerId, name: "API client", email: "", method: "api_key" }
      : null;
  }
  const token = sessionToken(h.get("cookie"));
  if (token) {
    const [session] = await getDb()
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.hash, await hashSecret(token)),
          gt(sessions.expiresAt, new Date().toISOString()),
        ),
      )
      .limit(1);
    if (session)
      return {
        id: session.ownerId,
        name: session.name,
        email: session.email,
        method: "session",
      };
  }
  const user = await getChatGPTUser();
  return user
    ? {
        id: user.userId,
        name: user.fullName || user.email.split("@")[0],
        email: user.email,
        method: "chatgpt",
      }
    : null;
}
