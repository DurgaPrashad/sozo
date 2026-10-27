# SOZO v0.2 — Moon + Mars workspace

The landing page introduces both planetary workspaces with the SOZO mark, NASA-source globe visualizations, and MOMAR prototype previews. The supplied coverage metrics and source inventory live in a typed provenance manifest. They remain labelled as project-reported and are not presented as ingested SOZO terrain.

The public entry points are `/`, `/login`, `/api/planetary`, and the OpenAPI document. `/dashboard` checks identity on the server. Owned research API routes continue to filter by owner. Email/password access uses a server-only salted PBKDF2 verifier and hashed opaque sessions; cookies expire after eight hours. A separately authenticated token exchange enables API access. The configured account's workspace is distinct from existing Sites identities, preserving their private records.

The dashboard adds Moon and Mars explorers, a research overview driven by the owner's actual records, and a searchable 36-label provenance catalog. The globes support orbit, zoom, reset, wireframe, and pause with reduced-motion support and a CSS fallback. Region selection supplies research context; it does not load native DEMs. The catalog distinguishes streamed, derived, archived, integrated, and unspecified integration states in the source project.

Existing literature discovery, source exports, notebooks, projects, API keys, CLI, connector registry, and statistics remain available. MOMAR terrain routing, JPL ephemeris computation, AI synthesis, and native-resolution terrain ingestion are not connected to SOZO. Links open the external MOMAR prototype where those features are reported.

Validation: 44 unit/contract/CLI tests, 24 existing local integration checks with real source retrieval, and 15 new authentication boundary checks. Browser checks cover sign-in, the overview, explorer controls, responsive navigation, catalog search/details, and a real literature investigation. Upstream source failures are retained in the resulting research record. Local checks are not throughput or scientific-validation benchmarks.
