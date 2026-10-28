# SOZO v0.4 verification

The research failure came from sending raw questions to broad provider search and relying on provider ranking, without planetary intent, subject matching or entertainment rejection. This release qualifies Moon/Mars queries, filters and ranks actual metadata, deduplicates records, preserves exact user-selected DOI context and reports retrieval diagnostics. It does not implement a semantic vector index or independently validate paper conclusions.

The public landing adds the supplied silver/graphite GLB, decorative green character display, Sarvam greeting, a settling SOZO title, text navigation and live scientific article collections. The shoulder, wrist/base and hand/finger regions use graphite masks in the mesh's original coordinates. Arm motion is disabled because this single, unrigged source mesh stretched during procedural animation. The same component supports voice activity in the authenticated companion and embedded SDK. Globe zoom/pan and vertical rotation are disabled.

The protected workspace includes Sarvam chat, speech, transcription, optional explicitly selected screenshots, cited research synthesis and source records. Screen snapshots are previewed, sent only with the user's next question, and capture tracks stop immediately after capture. Microphone transcripts are drafts for review. Provider keys are server secrets; embedded browsers use hashed, revocable, origin-bound ten-minute tokens. Existing owners, projects, notes and keys are preserved. Local/live use the same endpoint paths.

## Verification completed before packaging

- TypeScript checks passed across application and API code. The final deterministic suite passed80/80tests with0failures.
- Deterministic tests cover research filtering, DOI matching, metadata normalization, statistics, connector constraints, API ownership, widget origin/expiry/revocation boundaries, route distances and CLI behavior. See `npm test` and the separate fixture evaluation report; fixture success is not a live search accuracy benchmark.
- Real Sarvam requests returned HTTP200 for conversation, Bulbul v4 speech, Saaras v4 transcription and Gemma4 reading labels on an owned synthetic map image. No personal desktop capture was used for these tests.
- Local companion API checks passed14/14: authentication, model asset, exact-origin sessions, CORS, revocation, scope restrictions and a real scoped conversation with supplied polyline analysis.
- Live Crossref discovery returned8 records:4 Moon and4 Mars at verification time. The smaller landing collection requests4 records, balancing both worlds when qualifying records are available. Counts change with filters and upstream records.
- Browser verification included login to the protected workspace and a real conversational reply with audio; landing materials, digital face, disabled arm motion, article metadata controls and SDK rendering were inspected. Desktop/mobile checks are recorded in the task; screenshots live in ignored `outputs/`.

## Remaining integration boundaries

MOMAR has not supplied routing backend endpoints or credentials. Routes, terrain sampling, illumination, ice stability, battery and communications remain MOMAR's computation boundary. SOZO currently interprets supplied geometry/metrics, approximates spherical polyline distance, and can inspect explicit screenshots; no screenshot establishes route safety. NASA Image/Video Library remains historical media, separate from scientific terrain ingestion. Article ingestion is on demand; no unattended scheduler, vector search, autonomous hardware control or scientific superiority benchmark is claimed. Conversation replies complete as provider responses, while saved research runs expose real persisted progress events.

Browser research verification preserved the selected DOI as the first record and produced a cited synthesis. It also exposed an equal-resolution comparison error (5 m described as finer than 5 m). A targeted deterministic comparison check now rejects this error, including equivalent metre units, and retains the discovery record if synthesis fails. This narrow guard is not general numerical or scientific fact verification.

Production article checks exposed shared-upstream Crossref rate limiting. Article discovery now caches actual public metadata in D1 for15minutes, retries transient rate limits up to3times and can retain previously retrieved records for up to7days during a provider failure. The UI labels cached/stale evidence and preserves original upstream retrieval timestamps. Cold-start upstream failure still produces an honest partial/empty state; no fictional records are substituted.
