import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  SupabaseAuthError,
  exchangeGoogleCredential,
  exchangeSupabaseCode,
  pkcePair,
  profileFromUser,
  supabaseAuthorizeUrl,
  supabaseConfig,
} from "../lib/auth/supabase";

const config = { url: "https://project.supabase.co", key: "sb_publishable_fixture", googleClientId: null };
const user = { id: "0b6f3c1e-2d4a-4c8e-9f10-1a2b3c4d5e6f", email: "Ada@Example.com", email_confirmed_at: "2026-10-28T00:00:00Z", user_metadata: { full_name: "Ada Lovelace" } };

test("Supabase is configured from its URL and publishable key", () => {
  assert.equal(supabaseConfig({}), null);
  assert.equal(supabaseConfig({ SUPABASE_URL: "http://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "k" }), null);
  const configured = supabaseConfig({ SUPABASE_URL: "https://project.supabase.co/", SUPABASE_PUBLISHABLE_KEY: "k", GOOGLE_CLIENT_ID: "123-abc.apps.googleusercontent.com" })!;
  assert.equal(configured.url, "https://project.supabase.co");
  assert.equal(configured.googleClientId, "123-abc.apps.googleusercontent.com");
  assert.equal(supabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://p.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k", GOOGLE_CLIENT_ID: "not a client id" })!.googleClientId, null);
});

test("the redirect flow uses an S256 PKCE challenge", async () => {
  const { verifier, challenge } = await pkcePair();
  assert.match(verifier, /^[a-f0-9]{64}$/);
  assert.equal(challenge, createHash("sha256").update(verifier).digest("base64url"));
  const url = new URL(supabaseAuthorizeUrl(config, "https://sozo.momar.si/api/auth/supabase/callback", challenge));
  assert.equal(url.origin + url.pathname, "https://project.supabase.co/auth/v1/authorize");
  assert.equal(url.searchParams.get("provider"), "google");
  assert.equal(url.searchParams.get("code_challenge"), challenge);
  assert.equal(url.searchParams.get("code_challenge_method"), "s256");
  assert.equal(url.searchParams.get("redirect_to"), "https://sozo.momar.si/api/auth/supabase/callback");
});

test("codes and Google ID tokens are exchanged with Supabase server-side", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = (async (input: string, init: RequestInit) => {
    calls.push({ url: input, init });
    return Response.json({ access_token: "jwt", user });
  }) as typeof fetch;
  assert.deepEqual(await exchangeSupabaseCode(config, "the-code", "v".repeat(64), fetcher), { id: user.id, email: "ada@example.com", name: "Ada Lovelace" });
  assert.equal(calls[0].url, "https://project.supabase.co/auth/v1/token?grant_type=pkce");
  assert.equal((calls[0].init.headers as Record<string, string>).apikey, "sb_publishable_fixture");
  assert.deepEqual(JSON.parse(calls[0].init.body as string), { auth_code: "the-code", code_verifier: "v".repeat(64) });
  await exchangeGoogleCredential(config, "a.b.c", "n".repeat(64), fetcher);
  assert.equal(calls[1].url, "https://project.supabase.co/auth/v1/token?grant_type=id_token");
  assert.deepEqual(JSON.parse(calls[1].init.body as string), { provider: "google", id_token: "a.b.c", nonce: "n".repeat(64) });
});

test("only a confirmed email is used, and bad replies are rejected", async () => {
  assert.equal(profileFromUser({ ...user, email_confirmed_at: null }).email, null);
  assert.equal(profileFromUser({ id: user.id, user_metadata: {} }).name, "SOZO member");
  assert.throws(() => profileFromUser({ id: "../admin" }), SupabaseAuthError);
  const rejected = (async () => Response.json({ error: "invalid_grant" }, { status: 400 })) as typeof fetch;
  await assert.rejects(exchangeSupabaseCode(config, "c", "v".repeat(64), rejected), (error: unknown) => error instanceof SupabaseAuthError && error.code === "auth_400");
});
