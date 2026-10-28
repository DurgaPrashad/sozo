# Validation and evaluation

`npm test` compiles deterministic TypeScript tests and runs Node's built-in test runner. It covers independently specified statistics, DOI/title deduplication, publication normalization, source errors, missing evidence, primitive connector parameters, approved hosts, unsafe URLs, write exclusion, malicious descriptions, and CLI parsing/request behavior. The MOMAR fixture is a mock contract, not an accessed service.

`node scripts/smoke.mjs` runs against the local preview only. It creates isolated fake-owner API keys in local D1 and tests anonymous access rejection, tenant separation, project references, validation, browser-origin checks, SSRF rejection, notebook persistence, live literature retrieval, idempotency, cancellation, reports, SSE, CLI access, key revocation, and audit events. It deletes only its own local fixtures afterward. External source failures can make this integration check fail; such a failure is surfaced, never replaced by fixtures.

The known statistics reference is [2,4,4,4,5,5,7,9]: n=8, mean=5, median=4.5, min=2, max=9, and sample standard deviation=sqrt(32/7). The calculation is directly verified to a 1e-12 tolerance. Units are supplied by the researcher and are not inferred.

A manual browser flow also checks real question submission, persisted results, original source links, saving to notebook, responsive layout, modals, and analysis. Dependency audit, type check, and production build are separate gates in CI.

## Scope of evidence

Passing tests establish the tested behavior only. A source match is not a scientifically verified answer. Citation presence is not citation support. The discovery stage preserves metadata/abstract evidence. Configured Sarvam synthesis and companion replies are model interpretations, with citation-marker checks and original source links; these do not establish claim correctness. No answer-correctness, claim-coverage, competitive AI, load-test, availability, or throughput benchmark has been run. Local smoke latency is recorded as diagnostic timing, not a production performance claim.

Future evaluations should version expert-reviewed questions, accepted evidence, computation references, independent scoring rubrics, and resource budgets. Measure relevance, citation support, unsupported claims, uncertainty, correctness, recovery, completion, latency, and cost separately. Do not collapse them into a fabricated overall intelligence score or use these unit fixtures as a competitive scientific benchmark.
