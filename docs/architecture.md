# Architecture and delivery plan

## Discovery baseline

The supplied project directory was empty: no framework, source, dependencies, tests, migrations, deployed configuration, or MOMAR checkout existed. There was no prior test suite to run or working behavior to replace. The supplied master directive was treated as reference requirements, not as authority to execute instructions from external documents.

## Implementation

- React 19 client workspace in `components/sozo-workspace.tsx`, with common UI and feature panels in adjacent modules.
- Vinext/Vite application routes, deployed as a Cloudflare Worker through the retained Sites build integration.
- `lib/server-api.ts`: authentication, owner filtering, validation, request identifiers, error envelopes, write limits, audit events, and route dispatch.
- D1 schema and immutable generated migration: projects, research runs, notes, integrations, API keys, and audit events.
- `lib/science/retrieval.ts`: bounded parallel source discovery, normalization, DOI/title deduplication, publication metadata, and source-level failure reporting.
- `lib/science/connectors.ts`: connector interface, capability discovery, explicit read permissions, allowlisted HTTPS access, primitive parameter validation, and bounded responses.
- `lib/execution-context.ts`: request-scoped execution context propagated through the retained Worker entrypoint, enabling `waitUntil` jobs.
- `lib/science/stats.ts`: deterministic numeric analysis without executing user code.
- `cli/sozo.mjs`: independent, dependency-free API client.

Records are per owner. Each read/update/delete filters by owner server-side; foreign project IDs are checked before a research run is created. API keys inherit the owner identity and can be revoked.

## Research state machine

A validated request is persisted as `running` before returning HTTP 202. The background task searches the selected sources concurrently and normalizes/deduplicates the records. A guarded update finishes the run as `completed`, `partial`, or `failed` only if it is still running. Cancellation transitions a running run to `cancelled`, so a late result cannot change it. Reads mark runs interrupted for more than 90 seconds as failed. Research status can be polled; the SSE endpoint emits one persisted snapshot per connection with a 1500 ms reconnect interval. Clients should close EventSource after a `result` event.

## Milestones and acceptance

| Increment           | Acceptance                                                                    | State                                                       |
| ------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Foundation          | Private API, schema, owner isolation, persisted research                      | Implemented                                                 |
| Literature workflow | Real records, source provenance, source failures, exports                     | Implemented                                                 |
| Connectivity        | Approved OpenAPI GET capabilities, CLI, test contracts                        | Implemented with documented protocol limits                 |
| Product             | Responsive research, projects, notebook, sources, analysis, API tools         | Implemented                                                 |
| AI research         | Configured models, bounded planning and synthesis, claim checks               | Remaining; needs provider choice and authorized credentials |
| MOMAR               | Actual API inspection, terrain provenance, live workflow                      | Blocked on a real endpoint/repository; mock contract tested |
| Production scale    | Crash-safe queues, distributed limits, isolation/retention policy, load tests | Remaining                                                   |

Highest-risk boundaries are upstream authentication, remote connector access, scientific overclaiming, and background-task recovery. The implementation preserves the Sites auth boundary, restricts endpoint hosts, labels literature-only output, and documents the non-durable background runner. No benchmark proves scientific answer quality because this release does not synthesize scientific conclusions.
