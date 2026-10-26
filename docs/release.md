# SOZO v0.1 — engineering report

Validation: 27 October 2026, Asia/Kolkata.

## Delivered

A responsive scientific research workspace; recreated SOZO symbol and wordmark with SVG/PNG brand kit; live Crossref/Europe PMC retrieval; D1-backed projects, runs, sources, notebook, and audit; asynchronous job records and cancellation; authenticated reports and SSE snapshots; API key generation/revocation; approved public-GET OpenAPI capabilities; a typed connector interface; the standalone SOZO CLI; deterministic numeric analysis; OpenAPI documentation, setup, security, operations, and CI.

## Evidence

- 40 deterministic unit, connector, and CLI tests passed.
- 24 local API integration checks passed with two isolated tenants, including access rejection, project isolation, source retrieval, idempotency, cancellation, report/SSE retrieval, CLI access, key revocation, and audit records.
- TypeScript check passed.
- Full dependency audit: 0 known vulnerabilities, including development/build dependencies after patching the starter stack.
- Production build passed; the framework emits non-fatal source-map/chunk-analysis warnings.
- Manual browser workflow: question submission → real publication results → source saved → persisted notebook entry visible in a separate browser session.
- Browser numeric reference: n=8, mean=5, median=4.5, range 2–9, sample standard deviation≈2.13809.
- Responsive check: desktop and 390×844 mobile; mobile document width equals viewport width, and navigation opens/closes correctly.

A live broad Mars query returned 16 unique publications with 9 supplied abstracts in approximately 1.1 seconds of source retrieval. This is one diagnostic observation, not a performance benchmark or scientific correctness score. The focused integration query retrieved real publications independently; provider counts and latency can vary.

## Remaining capabilities

No model credentials or MOMAR endpoint/repository were provided. AI synthesis, model orchestration, live MOMAR terrain access, MCP/OAuth/GraphQL/browser adapters, sandboxed Python, generic JSON Schema validation, granular project roles, crash-resumable queues, distributed quotas, pagination, retention/backup policy, and production load/quality benchmarking remain to be implemented. The application labels its current literature discovery mode and never represents these missing capabilities as connected or tested.

Start locally with the commands in README. To extend: choose and authorize a model provider; inspect the real MOMAR API and configure a reviewed host; then add durable workflow execution and scientific-answer evaluation before claiming a production scientific research agent.
