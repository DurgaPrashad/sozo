# SOZO

**Intelligence for life beyond Earth.** An AI space scientist for astronauts and mission teams, built with [MOMAR](https://www.momar.si/), the planetary mission-planning platform for the Moon and Mars.

Live: https://sozo.momar.si · 3D rover simulator: https://sozo3d.momar.si/ (page at `/3dsim`)

SOZO connects scientific literature, NASA archives, exact orbital calculations and a talking 3D companion into one workflow, with every claim traceable to a source and every number computed rather than guessed.

## What it does

- **Cited research.** Searches Crossref, Europe PMC and the NASA Image and Video Library, keeps source timestamps and citations, and stores projects, notebooks and reports.
- **A scientist you can talk to.** A 3D companion answers by text or voice, streams its answers, and calls an exact two-body calculator for orbits, escape velocity, Hohmann and planet-to-planet transfers, and the rocket equation.
- **Scans what you point at.** Ask it to scan a map or panel and the robot flies there, sweeps it top to bottom and side to side, reads the visible text and answers from it.
- **MOMAR integration.** Explains terrain and route metrics, compares up to four alternative routes and keeps limitations visible. The landing page shows six views each of the lunar south pole and Jezero Crater.
- **One API, any website.** A model catalog (`GET /api/companion/models`), a versioned REST API, a CLI, and an embeddable `<sozo-companion>` that works on a static site with a publishable key.
- **Honest by design.** AI explanations are never presented as measurements. Mission decisions stay with people.

## Meta AI in SOZO

SOZO is built to run on more than one model family, and Meta's models are a first-class part of that design.

**Working today**

- **Meta Llama through any OpenAI-compatible host.** Set `META_LLAMA_API_KEY` (optionally `META_LLAMA_MODEL`, default `Llama-4-Maverick-17B-128E-Instruct-FP8`, and `META_LLAMA_BASE_URL`, default `https://api.llama.com/compat/v1`) and SOZO uses it as the primary model, or as an automatic fallback when another provider is slow or down.
- **Choose per request.** Chat accepts `provider: "sarvam" | "meta"`; the answer reports which model produced it. Meta Llama uses the same calculator tool, citations and streaming as every other model.
- **Visible in the product.** The companion shows Meta Llama's connection state, and the Models section on the landing page lists it with an honest status (Ready to connect until a key is set).
- **Open-weight friendly.** Because the integration is plain OpenAI-compatible HTTP, Llama open weights served from Baseten, Modal, Fireworks or your own GPUs work by changing the base URL.

**Where Meta's models take SOZO next** (planned, not yet built)

| Capability | What it would add |
| --- | --- |
| Muse models | Multi-step scientific reasoning over route, terrain and literature context, checked against the exact calculator. |
| SAM 3.1 | Segment craters, boulders, dunes and shadows in Moon and Mars imagery, so a region can be selected, outlined and measured with deterministic terrain tools. |
| Muse Image | Visual explanations and research illustrations of an observation, clearly labelled as illustrations and never as data. |
| Multimodal workflow | Select a region in MOMAR, segment it, ask SOZO about it, retrieve supporting papers and compare exploration options in one place. |

The principle stays the same: Meta's models interpret and explain; sources, citations and deterministic calculations carry the facts.

## Run locally

Requires Node.js 22.13+ and npm. The application uses the supplied Sites/Vinext integration; it does not require an AI-provider account for literature discovery.

```sh
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_icy_husk.sql
npm run dev
```

Apply `drizzle/0001_lumpy_magus.sql` once after the initial migration. Open the printed loopback URL. `/` is public; `/dashboard` requires sign-in. Configure `SOZO_WORKSPACE_EMAIL` and `SOZO_WORKSPACE_PASSWORD_HASH` in ignored `.dev.vars` for local email/password sign-in. The verifier uses `pbkdf2-sha256$100000$<16-byte-salt-hex>$<32-byte-hash-hex>`, PBKDF2 with SHA-256 and 100,000 iterations. Never commit credentials or put them in client code. The optional ChatGPT sign-in in the portable profile uses the isolated local identity `Seedy`; that simulation is excluded from production. Local D1 data survives preview restarts in `.wrangler/state/`. Do not reapply an already applied migration; append new migrations for subsequent schema changes.

```sh
npm run typecheck
npm test
# With the local preview running and its local migration applied:
node scripts/smoke.mjs
# Supply credentials as process environment, never in source:
node scripts/auth-smoke.mjs
```

The smoke script creates two isolated fake tenants, performs real source requests, and removes only its own fixtures from the local database. It refuses non-loopback targets. Tests never use production data.

## Deploy on Vercel

Import the repository in Vercel; `vercel.json` selects Next.js and runs `npm run build:vercel`. Add these environment variables, then redeploy:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Supabase PostgreSQL **transaction pooler** URI, replacing Cloudflare D1. Production builds apply the migrations. (`TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` is the alternative.) |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `GOOGLE_CLIENT_ID` | "Continue with Google" through Supabase Auth; the client ID keeps the supabase.co address hidden. See [Google sign-in](docs/operations.md#google-sign-in-supabase-auth). |
| `SOZO_ALLOWED_EMAILS`, `SOZO_OPEN_SIGNUP` | Who may sign in with Google or Facebook besides the owner. |
| `SOZO_WORKSPACE_EMAIL`, `SOZO_WORKSPACE_PASSWORD_HASH` | Workspace owner; the hash enables the optional password form (PBKDF2 verifier as described above). |
| `SARVAM_API_KEY` | Conversation, voice and synthesis. Optional. |
| `META_LLAMA_API_KEY` | Meta Llama as a primary or fallback conversation model. Optional; also `META_LLAMA_MODEL`, `META_LLAMA_BASE_URL`, `SOZO_CHAT_PROVIDER=meta`. |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | Optional "Continue with Facebook". Access rules and Meta app setup: [Facebook login](docs/operations.md#facebook-login). |

Fill the git-ignored `.env.vercel` (template in `.env.example`) and paste it into Vercel. Generate the password verifier with `npm run auth:hash-password`. Production: https://sozo.momar.si.

ChatGPT sign-in is only available on Sites hosting. See [Deployment and troubleshooting](docs/operations.md#vercel).

## Connect other platforms

External platforms call SOZO from their backend with a workspace API key (`Authorization: Bearer sozo_…`), or from the browser with ten-minute origin-bound sessions. `POST /api/companion/chat` accepts a route, up to four alternative routes, metrics and planner facts, and returns a cited answer with a deterministic route comparison. `POST /api/v1/research` runs longer cited research. See the [companion API guide](docs/COMPANION-INTEGRATION.md), the [OpenAPI contract](public/openapi.json), and the paste-ready [MOMAR integration prompt](docs/MOMAR-INTEGRATION-PROMPT.md).

## Use SOZO

1. Ask a focused scientific question, or select a starter discipline.
2. Choose Crossref and/or Europe PMC. Broad mode requests up to eight records per source; focused mode requests four.
3. Inspect the actual publications and any supplied abstracts. Records are filtered and ranked using body, topic and mission metadata. This is not an assessment of scientific evidence quality. When Sarvam is configured, the saved research record also includes a cited AI synthesis; original metadata remains available.
4. Save useful sources to the notebook, add your own notes, and export a Markdown or JSON report.
5. Create projects and select one in research preferences to associate new questions.
6. Use Analysis lab for a bounded, deterministic numeric analysis. The JSON export includes inputs, method, and computation time.

## API and CLI

The complete versioned contract is in [public/openapi.json](public/openapi.json). Browser writes use an HttpOnly SOZO session or Sites identity. External API clients use a workspace API key created under **API & developers → API keys**. Keys are shown once and stored as SHA-256 hashes.

```sh
export SOZO_BASE_URL="http://localhost:5173"
export SOZO_API_KEY="<create-a-key-in-the-workspace>"
node cli/sozo.mjs research run --question "Mars rover terrain planning"
node cli/sozo.mjs research status <research-run-id>
node cli/sozo.mjs research report <research-run-id>
node cli/sozo.mjs connect list
```

`npm link` optionally exposes the same client as `sozo`. See [CLI reference](docs/cli.md) and [Python, TypeScript, and cURL examples](docs/api.md).

The current Site has a public landing page and app-level authentication on its dashboard and owned API. No hosting service token is needed for the public audience. **If hosting is made private again, it has two boundaries:** the Sites hosting sign-in gate and the application's own identity/key. An API key alone cannot bypass the hosting gate. External clients must separately configure an authorized Sites service token in `OAI-Sites-Authorization: Bearer <token>`; the CLI reads `SOZO_SITE_ACCESS_TOKEN`. SOZO does not generate or rotate that hosting credential.

## Integrations

The native Crossref and Europe PMC adapters perform live, read-only literature discovery. Their health buttons perform actual harmless requests.

Custom OpenAPI 3 JSON specifications can be discovered, explicitly approved, registered, inspected, invoked, and revoked through the API and CLI. Only public GET operations with supported path/query parameters are supported. Configure reviewed hosts in `SOZO_CONNECTOR_HOSTS` through server environment settings, never browser input. Default hosts are `api.crossref.org` and `www.ebi.ac.uk`. Redirects are rejected. See [connector SDK and trust model](docs/connectors.md).

MOMAR coverage and source labels come from the owner-supplied brief in `lib/planetary/manifest.ts`. `/api/planetary` exposes this public provenance catalog. Counts are project-reported, not independently recomputed or ingested by SOZO. The 240 m lunar and 20 m Martian primary grids total ≈5.96 million cells; overlapping lunar grids are excluded. The interactive NASA-image globes are visualizations, not native-resolution DEMs. The six screenshot previews link to the external MOMAR prototype. No MOMAR API endpoint or credentials were supplied. Contract tests use an explicitly labelled mock.

## What is and is not complete

Implemented and tested: public landing page, protected dashboard, server-side email/password verification, hashed opaque eight-hour sessions, sign-in throttling, API token exchange, interactive Moon/Mars globes, searchable provenance catalog, real scientific retrieval, persisted asynchronous run records, partial failure reporting, cancellation, idempotent submission, polling and reconnecting SSE snapshots, per-owner access checks, hashed/revocable API keys, audit events, a bounded connector registry, CLI, source exports, project/notebook workflows, and deterministic numeric statistics.

This is an initial working foundation, **not the full production platform described by the reference brief**. MCP, OAuth, GraphQL, browser adapters, generic file/dataset processing, sandboxed Python, arbitrary JSON Schema validation, granular project roles, resumable durable queues, distributed quotas, retention automation, and large-scale benchmarks are not implemented. Sarvam provides the configured AI and speech models. SOZO does not claim a proprietary foundation model, state-of-the-art performance, or production throughput.

Runs execute with Worker `waitUntil`, bounded source timeouts, and persisted results. This is not a crash-resumable job queue. Interrupted runs are marked failed when queried after 90 seconds and can be retried. Cancellation prevents a late result from overwriting the cancelled state; it does not necessarily interrupt an in-flight upstream request. Collections are currently bounded to 100 projects/runs/integrations and 200 notes per workspace read; pagination is a future improvement.

## Engineering documentation

- [Architecture and delivery plan](docs/architecture.md)
- [API integration examples](docs/api.md)
- [CLI reference](docs/cli.md)
- [Connector SDK, security, and MOMAR](docs/connectors.md)
- [Validation and evaluation](docs/evaluation.md)
- [Deployment and troubleshooting](docs/operations.md)
- [Release notes v0.5](docs/release-v0.5.md) · [v0.6](docs/release-v0.6.md)

Crossref API behavior follows its [official documentation](https://www.crossref.org/documentation/retrieve-metadata/rest-api/). Europe PMC retrieval follows its [REST service documentation](https://europepmc.org/RestfulWebService). Publication metadata may lack abstracts and may include preprints. Follow the original publication links and applicable licensing terms.

## NASA space archive

The authenticated `/api/v1/space-data?q=<query>&media=all` endpoint searches the original NASA Image and Video Library. Results are bounded to 12 per request and preserve NASA identifiers, record dates, original captions, source links, provider, and retrieval time. Query length and media type are validated; remote JSON is time- and size-bounded, and redirects are rejected. This is archive discovery, not live telemetry or terrain computation. The dashboard includes a NASA space archive with search, media filtering, and provenance details.

MOMAR Moon and Mars planners are linked from the Moon and Mars sections and the footer; the navbar links to those sections on the page. A direct routing API and a model provider are still needed for SOZO to compute routes through an AI agent; the UI labels that integration as in development.

## Companion and interaction update — 28 October 2026

The landing page uses the supplied GLB as `public/models/sozo-companion.glb`. Its original mesh is preserved; the viewer supplies ceramic-white and graphite materials, smooth panel masks, a blue light strip, and a top sensor whose lens projects an animated holographic scan grid. It loads near the viewport, disposes GPU resources on unmount, and offers horizontal inspection and a front-view reset. The reference image is a clearly labelled fallback when 3D cannot load.

Moon and Mars globe views now allow horizontal rotation only. Zoom, vertical orbit, panning, and two-finger orbit/zoom gestures are disabled in the shared viewer, including dashboard explorers. The zoom buttons are removed. The opening SOZO title begins at the center and settles at the lower left once per page load; reduced-motion preferences show the settled state immediately. Navbar items are plain text over the film.

## v0.4 — scientific companion and platform integration

- White / graphite GLB companion with black shoulder connections, wrist/base joints, hands and fingers. The supplied single mesh is unrigged: arm motion is intentionally disabled; the whole companion hovers and sways gently when idle. Its blue display shows ring eyes that blink and follow the pointer over falling blue digits; while thinking it types research lines instead, and the eyes return to speak. The top sensor's scanner sweeps a laser sheet from top to bottom. Reduced-motion and visibility support.
- Sarvam conversation (`sarvam-105b-conversations`), voice (`bulbul:v4-flash`), transcription (`saaras:v4`) and explicit screenshot vision (`gemma4`). A pre-generated Sarvam greeting is public; paid interactive operations require workspace authentication or scoped sessions. Provider credentials live only in ignored `.dev.vars` / production runtime secrets.
- Planetary intent classification, scientific metadata relevance rules, duplicate removal, source diagnostics, real Moon/Mars article collections and DOI links. Article records preserve publication type without guessing peer review.
- Portable `<sozo-companion>` SDK, origin-bound ten-minute sessions, revocation, bounded input, usage limits, explicit screen snapshot preview, structured route context and approximate planetary polyline distance.
- Self-hosted licensed WOFF2 fonts, a navy research workspace, text navbar, cinematic title intro and horizontal-only globe rotation.

Set `SARVAM_API_KEY` in local `.dev.vars` and production secrets for conversation and speech. No key belongs in browser code. Model/source failures leave the source discovery record available. The article provider is queried on demand, with refresh and retrieval timestamps; no unattended ingestion scheduler or vector index is claimed.

See [companion integration and single API plan](docs/COMPANION-INTEGRATION.md), [MOMAR backend rebuild plan](docs/unified-api-backend-plan.md), and [release verification](docs/release-v0.4.md). Run `npm run widget:build` after companion UI changes; `npm run build` performs this automatically. The SDK demo is `/embed/demo.html` and the documented OpenAPI file is `/openapi.json`.

MOMAR route endpoints have not been supplied. SOZO can analyse an explicitly shared map image and supplied route geometry/metrics; it does not ingest MOMAR terrain or compute a certified rover route. Model replies are not independently validated scientific conclusions. The saved research workflow polls real pipeline state. Companion answers stream over Server-Sent Events (see the v0.5 and v0.6 release notes).
