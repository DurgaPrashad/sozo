import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  FacebookError,
  facebookConfig,
  facebookDialogUrl,
  facebookProfile,
  parseSignedRequest,
  sameState,
} from "../lib/auth/facebook";
import { signInAccess, signInPolicy } from "../lib/auth/social";

const config = { appId: "1234567890", appSecret: "fixture-secret", version: "v26.0" };

test("Facebook sign-in is configured only with a numeric app ID and a secret", () => {
  assert.equal(facebookConfig({}), null);
  assert.equal(facebookConfig({ FACEBOOK_APP_ID: "abc", FACEBOOK_APP_SECRET: "s" }), null);
  assert.equal(facebookConfig({ FACEBOOK_APP_ID: "1234567890", FACEBOOK_APP_SECRET: "s", FACEBOOK_GRAPH_VERSION: "latest" })!.version, "v26.0");
  assert.equal(facebookConfig({ FACEBOOK_APP_ID: "1234567890", FACEBOOK_APP_SECRET: "s", FACEBOOK_GRAPH_VERSION: "v27.0" })!.version, "v27.0");
});

test("only the owner, allowed emails or open sign-up get access", () => {
  const closed = signInPolicy({ SOZO_WORKSPACE_EMAIL: "Owner@Example.com ", SOZO_ALLOWED_EMAILS: "crew@example.com, ops@example.com" });
  assert.equal(signInAccess("owner@example.com", closed), "owner");
  assert.equal(signInAccess("OPS@example.com", closed), "member");
  assert.equal(signInAccess("stranger@example.com", closed), null);
  assert.equal(signInAccess(null, closed), null);
  const open = signInPolicy({ SOZO_OPEN_SIGNUP: "true" });
  assert.equal(signInAccess(null, open), "member");
  assert.equal(signInAccess("owner@example.com", signInPolicy({})), null);
});

test("the login dialog requests a code with state for the registered redirect", () => {
  const url = new URL(facebookDialogUrl(config, "https://sozo.momar.si/api/auth/facebook/callback", "a".repeat(64)));
  assert.equal(url.origin + url.pathname, "https://www.facebook.com/v26.0/dialog/oauth");
  assert.equal(url.searchParams.get("client_id"), "1234567890");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("state"), "a".repeat(64));
  assert.equal(url.searchParams.get("scope"), "public_profile,email");
  assert.equal(url.searchParams.get("client_secret"), null);
});

test("the code is exchanged server-side and the profile is read with an app secret proof", async () => {
  const calls: { url: URL; init?: RequestInit }[] = [];
  const fetcher = (async (input: URL, init?: RequestInit) => {
    calls.push({ url: input, init });
    if (input.pathname.endsWith("/oauth/access_token")) return Response.json({ access_token: "user-token", token_type: "bearer" });
    return Response.json({ id: "998877", name: " Ada Lovelace ", email: "Ada@Example.com" });
  }) as typeof fetch;
  const result = await facebookProfile(config, "the-code", "https://sozo.momar.si/api/auth/facebook/callback", fetcher);
  assert.deepEqual(result, { id: "998877", name: "Ada Lovelace", email: "ada@example.com" });
  assert.equal(calls[0].url.searchParams.get("client_secret"), "fixture-secret");
  assert.equal(calls[0].url.searchParams.get("code"), "the-code");
  assert.equal(calls[0].url.searchParams.get("redirect_uri"), "https://sozo.momar.si/api/auth/facebook/callback");
  assert.equal(calls[1].url.searchParams.get("access_token"), null);
  assert.equal((calls[1].init?.headers as Record<string, string>).Authorization, "Bearer user-token");
  assert.equal(calls[1].url.searchParams.get("appsecret_proof"), createHmac("sha256", "fixture-secret").update("user-token").digest("hex"));
});

test("Graph errors and malformed profiles are rejected", async () => {
  const failing = (async () => new Response("{}", { status: 400 })) as typeof fetch;
  await assert.rejects(facebookProfile(config, "c", "https://x.test/cb", failing), (error: unknown) => error instanceof FacebookError && error.code === "graph_400");
  const badProfile = (async (input: URL) => input.pathname.endsWith("/oauth/access_token") ? Response.json({ access_token: "t" }) : Response.json({ id: "../../me", name: "x" })) as typeof fetch;
  await assert.rejects(facebookProfile(config, "c", "https://x.test/cb", badProfile), (error: unknown) => error instanceof FacebookError && error.code === "profile_invalid");
});

function signedRequest(payload: object, secret = "fixture-secret") {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${createHmac("sha256", secret).update(body).digest("base64url")}.${body}`;
}

test("data deletion requests must carry Meta's signature", async () => {
  assert.deepEqual(await parseSignedRequest(signedRequest({ algorithm: "HMAC-SHA256", user_id: "998877" }), "fixture-secret"), { userId: "998877" });
  await assert.rejects(parseSignedRequest(signedRequest({ algorithm: "HMAC-SHA256", user_id: "998877" }, "other"), "fixture-secret"), FacebookError);
  await assert.rejects(parseSignedRequest(signedRequest({ algorithm: "none", user_id: "998877" }), "fixture-secret"), FacebookError);
  await assert.rejects(parseSignedRequest(signedRequest({ algorithm: "HMAC-SHA256", user_id: "1 OR 1=1" }), "fixture-secret"), FacebookError);
  await assert.rejects(parseSignedRequest("not-a-signed-request", "fixture-secret"), FacebookError);
});

test("the OAuth state must match exactly", () => {
  const state = "b".repeat(64);
  assert.equal(sameState(state, state), true);
  assert.equal(sameState(state, "c".repeat(64)), false);
  assert.equal(sameState(null, state), false);
  assert.equal(sameState("short", "short"), false);
});
