# Deployment and troubleshooting

Sites owns the hosted access policy, Worker deployment, and D1 binding. Preserve the project ID and `d1: DB` in `.openai/hosting.json`; retain `sites()` in `vite.config.ts` and the request-scoped bindings in the Worker entrypoint. Production publication uses the Sites source workflow, a pushed source commit, and the matching archive. Generated schema migrations are applied by Sites before the Worker is uploaded. The Site is private unless its owner explicitly changes access.

For local builds use `npm run build`; for local preview use `npm run dev`. The generated `dist/server/wrangler.json` is the config for local D1 commands. Apply generated SQL once to `.wrangler/state`. A local migration does not modify production. To change the schema, update `db/schema.ts`, run `npm run db:generate`, inspect SQL and metadata, and append the new migration.

## Symptoms

- **Sign-in prompt:** use the normal top-level sign-in link. External clients additionally need private hosting service access; an application key alone is insufficient.
- **Workspace 500 locally:** build and apply the local migration; ensure `DB` is enabled. Do not create tables at request time.
- **Unavailable source:** the report preserves a source-level error. Retry later, shorten the query, or select another source. No fake publications are substituted.
- **Interrupted run:** the background task is not crash-resumable. Runs queried after 90 seconds are marked failed; submit a new question to retry.
- **Connector rejected:** approve the exact public host server-side; use an OpenAPI 3 JSON specification with public GET operations and supported parameters. Do not weaken host checks to accept an internal URL.
- **No model output:** expected in v0.1. Source retrieval works independently; there is no configured synthesis provider.
- **Wrong research in a project:** select the project in the research source/preferences dialog before starting. Deleting a project preserves its research under personal history.
- **Source missing an abstract:** this is missing upstream metadata. SOZO never invents the text.

No production SLA, throughput target, or cost estimate has been established. Source requests use 12-second timeouts; generic connector reads use 10 seconds. Worker background execution is bounded by platform limits. UI polling is 1300 ms while the selected run is active. Data lives in D1; browser storage is not the research database. Retention, deletion recovery, pagination, job resumption, and storage backup policy require additional production engineering.
