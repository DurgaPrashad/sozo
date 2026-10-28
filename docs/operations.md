# Deployment and troubleshooting

Sites owns the hosted access policy, Worker deployment, and D1 binding. Preserve the project ID and `d1: DB` in `.openai/hosting.json`; retain `sites()` in `vite.config.ts` and the request-scoped bindings in the Worker entrypoint. Production publication uses the Sites source workflow, a pushed source commit, and the matching archive. Generated schema migrations are applied by Sites before the Worker is uploaded. The owner approved a public landing page. Dashboard and owned APIs require application authentication. Preserve that audience unless the owner asks to change it.

For local builds use `npm run build`; for local preview use `npm run dev`. The generated `dist/server/wrangler.json` is the config for local D1 commands. Apply generated SQL once to `.wrangler/state`. A local migration does not modify production. To change the schema, update `db/schema.ts`, run `npm run db:generate`, inspect SQL and metadata, and append the new migration.

## Vercel

Vercel builds with the standard Next.js toolchain (`vercel.json` runs `npm run build:vercel`), not vinext. The same code runs on both hosts through `@/lib/platform`: Next.js resolves `lib/platform/index.ts`, and `vite.config.ts` aliases it to `lib/platform/cloudflare.ts` for the Sites Worker.

- **Database:** Vercel has no D1. Use Supabase PostgreSQL: set `DATABASE_URL` to the **Transaction pooler** URI from Supabase → Connect (port 6543). The direct `db.<ref>.supabase.co` host is IPv6-only and unreachable from Vercel functions. `lib/platform/postgres-d1.ts` runs the existing SQLite-dialect queries on PostgreSQL and keeps SOZO's tables in a private `sozo` schema that Supabase's Data API does not expose, with RLS enabled and the `anon`/`authenticated` roles revoked. Turso (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`) remains an alternative when `DATABASE_URL` is unset. Production builds apply `drizzle/*.sql` once each through `scripts/migrate-db.mjs`; preview builds skip migrations; `npm run db:migrate` applies them by hand. Without a database the landing page, planetary catalog and article discovery still work, but sign-in fails, so the workspace is unreachable.
- **Secrets:** set `SOZO_WORKSPACE_EMAIL`, optionally `SOZO_WORKSPACE_PASSWORD_HASH`, and `SARVAM_API_KEY` for conversation and speech in the project's environment variables, then redeploy.
- **Identity:** ChatGPT sign-in depends on headers that only the Sites edge sets and strips. On Vercel those headers are ignored and the ChatGPT button is hidden; use workspace email/password or API keys.
- **Background runs:** research runs continue after the response through Next.js `after()`, within the function's maximum duration.

## Google sign-in (Supabase Auth)

Supabase manages the Google identity; SOZO turns a Supabase user into its own eight-hour session, with the same access rules as Facebook (`SOZO_WORKSPACE_EMAIL`, `SOZO_ALLOWED_EMAILS`, `SOZO_OPEN_SIGNUP`). Members get the workspace `supabase_<user id>`. Only Supabase-confirmed emails can match the owner or the allow list. SOZO does not store Supabase or Google tokens.

- **Environment:** `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (public values from Supabase → Project Settings → API). With only these, "Continue with Google" uses Supabase's redirect flow (PKCE via `/api/auth/supabase` and `/api/auth/supabase/callback`). Google's account chooser then names the project's `….supabase.co` address.
- **Hide the supabase.co address:** also set `GOOGLE_CLIENT_ID` to the Web client ID already configured in Supabase's Google provider. The login page then shows Google's own button, Google's popup names `sozo.momar.si`, and the server exchanges Google's ID token with Supabase (`/api/auth/google`, with a SHA-256 nonce). If Google's script is blocked, the page falls back to the redirect flow. A Supabase custom domain (paid add-on) is the other way to hide the address.
- **Supabase dashboard:** Authentication → URL Configuration: Site URL `https://sozo.momar.si`; Redirect URLs add `https://sozo.momar.si/api/auth/supabase/callback` (and `http://localhost:5173/api/auth/supabase/callback` for local tests). Authentication → Providers → Google: enabled; its Client ID field must include the ID used in `GOOGLE_CLIENT_ID`; leave the nonce check on.
- **Google Cloud console:** for that OAuth Web client, add `https://sozo.momar.si` (and `http://localhost:5173`) under **Authorized JavaScript origins**. Keep Supabase's `https://<ref>.supabase.co/auth/v1/callback` under Authorized redirect URIs for the redirect flow. Publishing the consent screen with SOZO's name, logo and domains lets Google show "SOZO" to users.

## Facebook login

SOZO uses Facebook's server-side OAuth code flow (no JavaScript SDK, no Meta page-view tracking). `/api/auth/facebook` sends the visitor to Facebook with a one-time `state` cookie. `/api/auth/facebook/callback` checks that state, exchanges the code with the app secret, reads `id,name,email` with an `appsecret_proof`, and starts a normal SOZO session. Facebook access tokens are not stored.

- **Access:** a Facebook email equal to `SOZO_WORKSPACE_EMAIL` opens the owner workspace. Emails in `SOZO_ALLOWED_EMAILS`, or anyone when `SOZO_OPEN_SIGNUP=true`, get a private workspace (`facebook_<app-scoped id>`). Everyone else sees "does not have access". Open sign-up lets the public use the shared Sarvam quota.
- **Meta app (developers.facebook.com):** create a Consumer app, add **Facebook Login**, and set **Valid OAuth Redirect URIs** to `https://sozo.momar.si/api/auth/facebook/callback` (add `http://localhost:5173/api/auth/facebook/callback` for local tests). In **App settings → Basic** set App Domains `sozo.momar.si`, a Privacy Policy URL, and **Data deletion callback URL** `https://sozo.momar.si/api/auth/facebook/data-deletion` (instructions page: `/data-deletion`). Copy the App ID and App Secret into `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` and redeploy.
- **Going live:** in Development mode only people with a role on the Meta app can sign in. Switch the app to Live for everyone; Meta may require `email` advanced access, App Review or Business Verification. Follow the dashboard's prompts.
- **Data deletion:** when someone removes SOZO from their Facebook settings, Meta posts a signed request. SOZO verifies its HMAC with the app secret and deletes that member's workspace (projects, runs, notes, integrations, API keys, audit events, sessions, companion sessions). The owner workspace is never deleted this way.

## Symptoms

- **Sign-in prompt:** use `/login`. Production needs the secret runtime values `SOZO_WORKSPACE_EMAIL` and `SOZO_WORKSPACE_PASSWORD_HASH`. The latter is a salted PBKDF2-SHA256 verifier, never the plaintext password. Updating runtime secrets requires a new deployment. If hosting is changed back to private, external clients additionally need hosting service access.
- **Workspace 500 locally:** build and apply the local migration; ensure `DB` is enabled. Do not create tables at request time.
- **Unavailable source:** the report preserves a source-level error. Retry later, shorten the query, or select another source. No fake publications are substituted.
- **Interrupted run:** the background task is not crash-resumable. Runs queried after 90 seconds are marked failed; submit a new question to retry.
- **Connector rejected:** approve the exact public host server-side; use an OpenAPI 3 JSON specification with public GET operations and supported parameters. Do not weaken host checks to accept an internal URL.
- **No model output:** expected in v0.2. Source retrieval works independently; there is no configured synthesis provider.
- **Wrong research in a project:** select the project in the research source/preferences dialog before starting. Deleting a project preserves its research under personal history.
- **Source missing an abstract:** this is missing upstream metadata. SOZO never invents the text.

No production SLA, throughput target, or cost estimate has been established. Source requests use 12-second timeouts; generic connector reads use 10 seconds. Worker background execution is bounded by platform limits. UI polling is 1300 ms while the selected run is active. Data lives in D1; browser storage is not the research database. Retention, deletion recovery, pagination, job resumption, and storage backup policy require additional production engineering.
