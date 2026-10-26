# SOZO

**Big questions. Brighter discoveries.**

SOZO v0.1 is a working, private scientific-literature workspace. It searches Crossref and Europe PMC, stores research records in Cloudflare D1, preserves citations and source timestamps, and provides projects, a source library, a notebook, reproducible descriptive statistics, a versioned API, and a command-line client.

The supplied SOZO symbol has been recreated as vector artwork, with transparent and dark-background SVG and PNG exports in `public/`.

## Run locally

Requires Node.js 22.13+ and npm. The application uses the supplied Sites/Vinext integration; it does not require an AI-provider account for literature discovery.

```sh
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_icy_husk.sql
npm run dev
```

Open the printed loopback URL, then click **Sign in**. The portable development profile uses the isolated local identity `Seedy`. This identity simulation is excluded from production. Local D1 data survives preview restarts in `.wrangler/state/`. Do not reapply an already applied migration; append new migrations for subsequent schema changes.

```sh
npm run typecheck
npm test
# With the local preview running and its local migration applied:
node scripts/smoke.mjs
```

The smoke script creates two isolated fake tenants, performs real source requests, and removes only its own fixtures from the local database. It refuses non-loopback targets. Tests never use production data.

## Use SOZO

1. Ask a focused scientific question, or select a starter discipline.
2. Choose Crossref and/or Europe PMC. Broad mode requests up to eight records per source; focused mode requests four.
3. Inspect the actual publications and any supplied abstracts. Results are database-ranked, not an assessment of evidence quality.
4. Save useful sources to the notebook, add your own notes, and export a Markdown or JSON report.
5. Create projects and select one in research preferences to associate new questions.
6. Use Analysis lab for a bounded, deterministic numeric analysis. The JSON export includes inputs, method, and computation time.

## API and CLI

The complete versioned contract is in [public/openapi.json](public/openapi.json). Browser writes use Sites identity. External API clients use a workspace API key created under **API & developers → API keys**. Keys are shown once and stored as SHA-256 hashes.

```sh
export SOZO_BASE_URL="http://localhost:5173"
export SOZO_API_KEY="<create-a-key-in-the-workspace>"
node cli/sozo.mjs research run --question "Mars rover terrain planning"
node cli/sozo.mjs research status <research-run-id>
node cli/sozo.mjs research report <research-run-id>
node cli/sozo.mjs connect list
```

`npm link` optionally exposes the same client as `sozo`. See [CLI reference](docs/cli.md) and [Python, TypeScript, and cURL examples](docs/api.md).

**A private hosted Site has two boundaries:** the Sites hosting sign-in gate and the application's own identity/key. An API key alone cannot bypass the hosting gate. External clients must separately configure an authorized Sites service token in `OAI-Sites-Authorization: Bearer <token>`; the CLI reads `SOZO_SITE_ACCESS_TOKEN`. SOZO does not generate or rotate that hosting credential.

## Integrations

The native Crossref and Europe PMC adapters perform live, read-only literature discovery. Their health buttons perform actual harmless requests.

Custom OpenAPI 3 JSON specifications can be discovered, explicitly approved, registered, inspected, invoked, and revoked through the API and CLI. Only public GET operations with supported path/query parameters are supported. Configure reviewed hosts in `SOZO_CONNECTOR_HOSTS` through server environment settings, never browser input. Default hosts are `api.crossref.org` and `www.ebi.ac.uk`. Redirects are rejected. See [connector SDK and trust model](docs/connectors.md).

MOMAR is a reference contract fixture in the tests, clearly labeled as a mock. No MOMAR repository, production endpoint, terrain data, or credentials were supplied. The UI provides onboarding without claiming a live connection.

## What is and is not complete

Implemented and tested: real scientific retrieval, persisted asynchronous run records, partial failure reporting, cancellation, idempotent submission, polling and reconnecting SSE snapshots, per-owner access checks, hashed/revocable API keys, audit events, a bounded connector registry, CLI, source exports, project/notebook workflows, and deterministic numeric statistics.

This is an initial working foundation, **not the full production platform described by the reference brief**. AI answer synthesis and model-provider configuration, MCP, OAuth, GraphQL, browser adapters, generic file/dataset processing, sandboxed Python, arbitrary JSON Schema validation, granular project roles, resumable durable queues, distributed quotas, retention automation, and large-scale benchmarks are not implemented. No foundation model, state-of-the-art performance, or production throughput is claimed.

Runs execute with Worker `waitUntil`, bounded source timeouts, and persisted results. This is not a crash-resumable job queue. Interrupted runs are marked failed when queried after 90 seconds and can be retried. Cancellation prevents a late result from overwriting the cancelled state; it does not necessarily interrupt an in-flight upstream request. Collections are currently bounded to 100 projects/runs/integrations and 200 notes per workspace read; pagination is a future improvement.

## Engineering documentation

- [Architecture and delivery plan](docs/architecture.md)
- [API integration examples](docs/api.md)
- [CLI reference](docs/cli.md)
- [Connector SDK, security, and MOMAR](docs/connectors.md)
- [Validation and evaluation](docs/evaluation.md)
- [Deployment and troubleshooting](docs/operations.md)

Crossref API behavior follows its [official documentation](https://www.crossref.org/documentation/retrieve-metadata/rest-api/). Europe PMC retrieval follows its [REST service documentation](https://europepmc.org/RestfulWebService). Publication metadata may lack abstracts and may include preprints. Follow the original publication links and applicable licensing terms.
