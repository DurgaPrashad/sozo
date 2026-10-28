# Prompt: connect MOMAR to SOZO

Paste the prompt below into the AI coding agent that works on the MOMAR codebase (www.momar.si). It makes SOZO, the AI space scientist at https://sozo.momar.si, available inside MOMAR's Moon and Mars planners. SOZO answers questions about routes, terrain, operations and research, using MOMAR's own route results as evidence.

Before you paste it:

1. Sign in at https://sozo.momar.si/login, open **API & developers → API keys**, and create a key named `MOMAR backend`. It is shown once.
2. Add these to the MOMAR **backend** environment (never the browser bundle):
   `SOZO_BASE_URL=https://sozo.momar.si` and `SOZO_API_KEY=<the sozo_… key>`.

The machine-readable contract is at https://sozo.momar.si/openapi.json.

````text
You are integrating SOZO into MOMAR. SOZO is an AI space scientist API at
https://sozo.momar.si. MOMAR stays the route solver and source of terrain data;
SOZO interprets MOMAR's results, compares candidate routes, retrieves scientific
literature with citations, and answers planner and astronaut questions. Build the
integration described below, end to end, matching MOMAR's existing stack, style
and UI patterns.

## What SOZO can and cannot do

Can:
- Answer questions grounded in the context MOMAR sends: a route, alternative
  routes, metrics, planner facts, notes, and an explicitly shared screenshot.
- Compute great-circle polyline lengths on the Moon or Mars and return a
  deterministic side-by-side comparison of the metrics MOMAR supplies.
- Retrieve Crossref / Europe PMC publication records and cite them as [1], [2].
- Run longer asynchronous research questions and return a cited report.
- Speak replies (text-to-speech) and transcribe short recordings.

Cannot (never present it as doing these):
- Compute or optimise routes, read MOMAR's terrain grids, or access telemetry.
- Certify safety or replace mission rules. Every answer is decision support and
  must be shown as AI-generated and requiring verification.
- Bodies other than "moon" and "mars".

## Architecture

1. Server-side proxy (required). Add authenticated MOMAR backend routes under
   /api/sozo/* that call SOZO with `Authorization: Bearer ${SOZO_API_KEY}` and
   no Origin header. Read SOZO_BASE_URL and SOZO_API_KEY from the server
   environment. The key must never reach the browser, logs, analytics or error
   messages. SOZO rejects its API keys from browser origins (HTTP 403).
2. Only signed-in MOMAR users may use the proxy. Add a per-user limit in MOMAR
   (for example 10 requests/minute), because all MOMAR users share one SOZO
   quota: 30 requests/minute and 240/hour.
3. Optional browser-direct mode (for voice or low latency): the backend
   requests a 10-minute token with POST /api/companion/sessions and
   {"allowedOrigin":"https://www.momar.si"}; the browser calls
   /api/companion/* with `Authorization: Bearer <token>`. Keep tokens in
   memory only and refresh after expiresAt. Tokens work only from that exact
   origin and only for companion endpoints.
4. Use a 60-second timeout. Retry 429/502/503 with exponential backoff (max 2
   retries). Never retry 400/401/403/413.

## Endpoint 1: POST /api/companion/chat  (main integration)

Request (JSON, strict: unknown fields are rejected with 400):
- message: string, 1–3000 chars (required)
- retrieve: boolean. true = fetch literature and cite it. Use true for
  scientific questions, false for quick follow-ups.
- history: up to 10 prior turns [{ "role": "user"|"assistant", "content": ≤4000 chars }]
- context (all optional):
  - body: "moon" | "mars"   (required for distances)
  - mapLabel: ≤300 chars, e.g. "South-pole planner: Site A → Shackleton rim"
  - notes: ≤6000 chars of planner notes (say where metrics come from)
  - route: GeoJSON LineString, coordinates [[lon, lat], …] in degrees,
    2–2000 points. Downsample longer routes, keeping endpoints.
  - metrics: only these keys, in these units
      distanceKm, durationHours, maxSlopeDeg, meanSlopeDeg (0–90),
      shadowFraction, sunlitFraction, earthVisibilityFraction (0–1, not %),
      terrainResolutionM, energyWh, batteryWh
  - alternatives: up to 4 other candidate routes
      [{ "label": ≤120 chars, "route": LineString, "metrics": {same keys} }]
  - facts: up to 40 other planner values, key ≤64 chars, value number,
    string ≤300 chars or boolean. Use this for anything without a metrics
    key (mission time window, dataset, vehicle class, round-trip budget,
    simulation time, hazards, science targets).
  - screenshot: "data:image/png|jpeg|webp;base64,…" under 2 MB. Send only
    after the user explicitly chooses to share the current map view and has
    seen a preview.

Response 200:
- reply: answer text (Markdown-style emphasis possible)
- citations: [{ id, title, url, doi?, provider?, year? }] matching [n] markers
- analysis: null, or { distanceKm, body, method, suppliedMetrics,
    alternatives?: [{ label, distanceKm, suppliedMetrics }],
    comparison?: { <metric>: { "Primary route": n, "<label>": n } } }
- limitations: string[]  (always show these)
- contextUsed: { screenshot, route, alternatives, facts, literature }
- model, usage

Errors: { "error": { "message", "code"?, "fields"? } } with 400 (fields lists
the invalid paths), 401, 403, 413, 429, 502/503 (provider). Show the message.

Example (comparing two MOMAR routes):
{
  "message": "Compare these traverses and recommend one for a 2-hour EVA support rover.",
  "retrieve": true,
  "context": {
    "body": "moon",
    "mapLabel": "MOMAR south-pole planner: Site A → Shackleton rim",
    "notes": "Metrics computed by MOMAR on LOLA 5 m slopes.",
    "route": { "type": "LineString", "coordinates": [[0.0, -89.70], [2.0, -89.75], [4.5, -89.80]] },
    "metrics": { "distanceKm": 7.66, "durationHours": 1.8, "maxSlopeDeg": 14.7,
                 "sunlitFraction": 0.57, "earthVisibilityFraction": 0.57, "terrainResolutionM": 5 },
    "alternatives": [{ "label": "Ridge detour",
      "route": { "type": "LineString", "coordinates": [[0.0, -89.70], [6.0, -89.72], [4.5, -89.80]] },
      "metrics": { "distanceKm": 9.1, "durationHours": 2.3, "maxSlopeDeg": 9.8,
                   "sunlitFraction": 0.81, "earthVisibilityFraction": 0.74 } }],
    "facts": { "roundTripBudget": "3.7 h of 7 h", "vehicle": "LRV-class (illustrative)",
               "simulationTimeUTC": "2026-10-28T04:00Z" }
  }
}

## Mapping MOMAR results to SOZO context

Build one function, e.g. toSozoContext(plan, alternatives), and unit-test it:
- Route geometry → route (planetocentric lon/lat degrees, downsampled).
- DISTANCE → metrics.distanceKm; MISSION TIME → metrics.durationHours;
  STEEPEST CELL → metrics.maxSlopeDeg; terrain grid → metrics.terrainResolutionM.
- Map a value to a metrics key only when its definition matches. "Sunlit on
  arrival" is not a route-average sunlit fraction, so send it as
  facts.sunlitOnArrivalPercent. Percentages become 0–1 only for true
  fractions along the route.
- EARTH IN SIGHT (route fraction) → metrics.earthVisibilityFraction;
  ROUND TRIP, timeline, vehicle, datasets, sources → facts.
- Other solver candidates → alternatives (max 4), labelled as MOMAR shows them.
- Always set body, mapLabel and a notes line naming MOMAR as the metric source.
- Drop NaN/Infinity, clamp nothing silently: if a value is out of range, omit
  it and add a facts entry explaining why.

## Endpoint 2: research reports (deeper questions)

- POST /api/v1/research with header `Idempotency-Key: <uuid>` and
  { "question": 5–1500 chars, "mode": "focused"|"broad",
    "sources": ["crossref","europepmc"] } → 202 { research_run_id, run }.
- Poll GET /api/v1/research/{id} every 2–3 s until run.status is not
  "running" (completed | partial | failed | cancelled). Runs older than
  90 s that are still running are reported failed; offer a retry.
- Show run.result.answer (when present), run.result.citations,
  run.result.limitations and run.result.providerStatus. "partial" means
  one literature source was unavailable; still show the results.
- POST /api/v1/research/{id}/cancel to cancel.

## Other endpoints

- GET /api/companion/status: { configured } tells whether SOZO's AI is
  available; hide or disable "Ask SOZO" when false.
- GET /api/v1/health: liveness.
- POST /api/companion/text-to-speech { text ≤2500, language "en-IN" … }
  → { audio (base64 mp3), mimeType }.
- POST /api/companion/speech-to-text: multipart "file" (audio ≤3 MB, ≤30 s)
  → { transcript }.

## MOMAR user experience

Add an "Ask SOZO" panel to the Moon and Mars planners:
- Quick actions that pre-fill the message and attach the current plan:
  "Explain this route", "Compare routes", "What are the risks?",
  "What data is missing?", "Find research for this site".
- Free-text questions with the last 10 turns kept in memory per planner view.
- Render reply as plain text or sanitised Markdown (no raw HTML), with
  citation markers linked to citations[].url.
- Show analysis.comparison as a table (bold the better value per metric
  only when "better" is unambiguous, e.g. lower maxSlopeDeg).
- Always show limitations and a label: "AI-generated decision support.
  Verify against MOMAR data and mission rules before operational use."
- A "Share map view" toggle that previews the screenshot before sending.
- Loading, error and quota-exceeded states with clear retry guidance.
- SOZO output never triggers an action by itself. Applying a suggested
  route, waypoint or plan change requires an explicit user confirmation.

## If MOMAR has its own AI assistant

Expose SOZO as a tool instead of copying its logic:
- Tool name ask_sozo; parameters { message, retrieve, includeCurrentPlan,
  includeAlternatives }. The tool handler builds context with
  toSozoContext() and calls the backend proxy.
- Assistant instruction: "For scientific, terrain, illumination, route
  comparison or mission-operations questions, call ask_sozo with the
  current plan. Quote SOZO's numbers from analysis.comparison, keep its
  citations, pass on its limitations, and never claim a route is safe or
  certified."

## Security checklist

- SOZO_API_KEY only on the server; verify it is absent from the built client
  bundle (search the build output for "sozo_").
- Proxy requires MOMAR authentication and validates/limits input sizes before
  forwarding. Do not forward MOMAR cookies or user tokens to SOZO.
- Do not log message bodies or screenshots; log request IDs and status codes.
- Treat SOZO replies as untrusted text.

## Acceptance tests

1. Health and status calls succeed through the proxy.
2. "Explain this route" on a saved plan returns analysis.distanceKm and the
   reply references the supplied metrics.
3. "Compare routes" with two candidates returns analysis.comparison with both
   labels, and the table renders.
4. An invalid metric (e.g. sunlitFraction 57) is caught by MOMAR's mapper, or
   SOZO's 400 fields[] message is shown.
5. Signed-out users cannot call /api/sozo/*; the key never appears in the
   browser network tab or bundle.
6. A 429 shows a friendly "SOZO is busy, retry in a minute" state.
7. A research report completes (or reports partial) and shows citations.

Deliver: the proxy routes, the context mapper with unit tests, the planner UI,
environment documentation for SOZO_BASE_URL and SOZO_API_KEY, and a short
summary of what was verified.
````
