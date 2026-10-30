# SOZO companion API and MOMAR integration

SOZO uses the same API paths on `http://localhost:5173` and the deployed Site. Long-lived SOZO keys are created in the authenticated developer workspace. Keep them in the host application's backend. The Sarvam provider key exists only in the SOZO server's `SARVAM_API_KEY` runtime secret; it is never the integration credential.

## Existing platform: one integration boundary

Retain MOMAR's scientific computation services and place an authenticated gateway in front of them. Expose a versioned contract rather than letting the language model operate a map by guessing pixels:

1. `GET /v1/capabilities`: supported bodies, coverage, coordinate reference systems, native/display resolution, algorithm versions and operational status.
2. `POST /v1/routes`: body, start/stops, vehicle, mission time, objective and constraints; return a job ID. Require idempotency keys.
3. `GET /v1/jobs/{id}`: actual progress, success or structured failure, without invented intermediate steps.
4. `GET /v1/routes/{id}`: GeoJSON alternatives, distance/time/energy, slope/roughness/shadow/communications samples, provenance, uncertainty and rejected constraints.
5. `POST /v1/context`: user-approved view bounds, selected layers, current time, route ID and source metadata. Return a compact view snapshot for SOZO.

Use canonical units, explicit planetary body and CRS on every geospatial record, finite-value validation, bounded routes and samples, ownership checks, signed backend requests, timeouts, cancellation, per-owner quotas, audit IDs and source licenses. Preserve native data and derived results separately. Test against known routes and official source products before claiming route suitability. Do not treat published MOMAR counts as a local terrain database.

The current SOZO implementation can inspect user-supplied GeoJSON and metrics, retrieve scientific article metadata, and interpret an explicitly shared image. It does **not** connect to MOMAR's private route solver or ingest its terrain. The gateway above is the next backend adapter once those endpoints and credentials are supplied.

## Browser embedding without exposing the long-lived key

Your authenticated host backend obtains a scoped, ten-minute token:

```js
// Host backend; never send SOZO_API_KEY to the browser.
const response = await fetch(`${SOZO_ORIGIN}/api/companion/sessions`, {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.SOZO_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ allowedOrigin: "https://planner.example" })
});
if (!response.ok) throw new Error("SOZO session creation failed");
const session = await response.json();
// Return only token, expiresAt and allowedOrigin to this authenticated host user.
```

HTTPS origins are supported; HTTP is allowed only for localhost development. Origins cannot contain a path, credentials or query. Store tokens only in memory. A scoped token works only at companion endpoints and only when the browser sends its exact allowed `Origin`. It cannot access projects, research history, API keys, or issue more tokens. The host should refresh through its backend after expiry. Revoke early by sending `DELETE /api/companion/sessions` with owner authentication and JSON `{ "id": "session-id" }`.

The companion endpoints accept same-origin SOZO login cookies or server-to-server SOZO API keys. Foreign browser origins must use scoped sessions. Responses include no provider credential. All requests share owner quotas of 30 per minute and 240 per hour; provider quota and credit limits also apply. Raw conversations, screenshots and recordings are not written to SOZO's database by these endpoints; they are transmitted to Sarvam for processing. Follow the provider's applicable retention policy.

## Conversation and route context

```js
const response = await fetch(`${SOZO_ORIGIN}/api/companion/chat`, {
  method: "POST",
  headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    message: "What observations are missing before we compare this route?",
    retrieve: true,
    history: [],
    context: {
      body: "moon",
      mapLabel: "User-selected south-pole route",
      notes: "Metrics originate from our planner; not independently verified by SOZO.",
      route: { type: "LineString", coordinates: [[0, -89], [0.1, -89.01]] },
      metrics: { terrainResolutionM: 240, maxSlopeDeg: 12, shadowFraction: 0.2 }
    }
  })
});
const result = await response.json();
```

The response contains `reply`, `model`, actual retrieved `citations`, `analysis`, `limitations` and `contextUsed`. `analysis.distanceKm` is a great-circle segment sum using mean spherical radii (Moon 1,737.4 km; Mars 3,389.5 km). It excludes terrain relief, hazards and vehicle dynamics. It is not route optimization or a safety certificate. Input metrics are labeled supplied. Citation numbers refer only to retrieved source records; the system flags unsupported numerical citation markers. Model statements still require scientific review.

To compare candidate routes, send up to four `context.alternatives` (`{ label, route, metrics }`). `analysis.alternatives` returns each polyline length, and `analysis.comparison` lists, per metric reported by at least two routes, each route's value (`"Primary route"` for `context.route`). The model reads values from that table rather than recalling them. `metrics` accepts `distanceKm`, `durationHours`, `maxSlopeDeg`, `meanSlopeDeg`, `shadowFraction`, `sunlitFraction`, `earthVisibilityFraction` (fractions 0–1), `terrainResolutionM`, `energyWh` and `batteryWh`. Anything else the planner knows goes in `context.facts`: up to 40 entries, keys up to 64 characters, values that are numbers, booleans or strings up to 300 characters. All of it is labelled planner-supplied and unverified.

MOMAR can use the ready-made [MOMAR integration prompt](MOMAR-INTEGRATION-PROMPT.md) (also served at `/docs/momar-integration-prompt.md`).

Optional `context.screenshot` accepts a JPEG, PNG or WebP inline data URL under 2 MB. The request switches from `sarvam-105b-conversations` to the documented image-capable `gemma4` model at Sarvam's V2 endpoint. Actual access depends on provider credentials, credits and model availability. Do not claim image analysis if this request fails. Screenshots cannot reveal hidden map layers, source resolutions or measurements absent from visible pixels.

Load `/embed/sozo-context.js` to use `window.SozoContext.captureScreen()` from a user's explicit button click. It opens the browser's native selection dialog, captures one image and immediately stops all media tracks. It sends nothing. Show a local preview, allow Remove, and obtain an explicit Send action before including that image in a chat request. Alternatively let the user upload a map image. Never scrape unrelated browser tabs, capture silently, or continually transmit the desktop. Prefer structured map layers/route metadata over screenshots when available.

## Answers, streaming and errors

**Request fields.** Besides `message`, `retrieve`, `history` and `context`, chat accepts `style`: `brief` (two to four sentences with the key figures), `standard` (default) or `detailed` (structured explanation). A brief question that asks to explain or derive something is answered as `standard`; the response's `style` says which was used. `context.facts` holds up to 60 entries.

**Time budget.** Each chat request finishes within 50 s. Literature retrieval (`retrieve: true`) gets at most 8 s, with Crossref and Europe PMC queried in parallel; a source that does not answer in time is skipped and named in `limitations`. The model gets what remains, at most 40 s. Recommended client timeout: 60 s for JSON chat, none for SSE.

**Streaming.** Send `Accept: text/event-stream` to receive Server-Sent Events: `status` (`{stage: "retrieving" | "reading" | "answering"}`), `calculations`, `citations`, `analysis`, `delta` (`{text}`, repeated), `limitations`, then `done` (`{model, provider, usage, style, contextUsed, timings, requestId}`). A failure after the stream starts arrives as an `error` event with the error object below. Clients that do not ask for SSE get one JSON response with the same fields plus `reply`.

**Calculations.** Numeric astrodynamics questions (orbits, escape velocity, Hohmann and planet-to-planet transfers, the rocket equation, surface gravity) go through SOZO's exact two-body calculator (`lib/science/astro.ts`) as a model tool; results are returned in `calculations` and quoted in the answer. They are idealised two-body values, not mission-certified figures.

**Successful responses** include `timings` (`retrievalMs`, `modelMs`, `totalMs`) and `requestId`.

**Errors** always have this shape, with `X-Request-ID` and (when retryable) `Retry-After` headers:

```json
{ "error": { "code": "provider_timeout", "message": "SOZO's conversation model took too long to answer. Please retry.", "retryable": true, "retryAfterSeconds": 5, "requestId": "…", "fields": ["only for invalid_request"] } }
```

| Code | HTTP | Retry? | Meaning |
| --- | --- | --- | --- |
| `invalid_request` | 400 | no | Input failed validation; `fields` lists the paths. |
| `payload_too_large` / `unsupported_media_type` | 413 / 415 | no | Body too big or wrong content type. |
| `unauthorized` / `session_invalid` | 401 | no | Missing or wrong key, or an expired/foreign-origin session. |
| `forbidden_origin` / `session_forbidden` | 403 | no | Long-lived key from a browser origin, or a session trying to manage sessions. |
| `rate_limited` | 429 | yes | Workspace quota (30/min, 240/hour); wait `retryAfterSeconds`. |
| `provider_rate_limited` | 429 | yes | The model provider's quota; wait `retryAfterSeconds`. |
| `provider_timeout` | 504 | yes | The model did not answer within the budget. |
| `provider_unreachable` | 502 | yes | DNS, TLS or connection failure to the provider (already retried once). |
| `provider_error` / `provider_bad_response` | 502 | yes | Provider 5xx or unreadable reply. |
| `provider_auth` | 502 | no | The provider rejected SOZO's key or model access: fix the server key. |
| `provider_credits` | 503 | no | The provider account needs credits. |
| `provider_rejected` | 502 | no | The provider refused this specific request. |
| `provider_unconfigured` / `storage_unconfigured` | 503 | no | A server setting is missing. |
| `internal_error` | 500 | yes | Unexpected failure; report the `requestId`. |

Messages name the service that failed: "SOZO's conversation model", "SOZO's voice", "SOZO's speech recognition" or "SOZO's image model".

**Models.** Sarvam (`sarvam-105b-conversations`) answers first. Transient failures are retried once with jitter when at least 15 s remain. If Meta Llama is configured (`META_LLAMA_API_KEY`, optional `META_LLAMA_MODEL`, default `Llama-4-Maverick-17B-128E-Instruct-FP8`, and `META_LLAMA_BASE_URL`, default `https://api.llama.com/compat/v1`; any OpenAI-compatible Llama host works), it answers when Sarvam fails, with fewer tokens. `SOZO_CHAT_PROVIDER=meta` makes Meta Llama primary. `model` and `provider` in the response say which answered.

**Health and identity.**
- `GET /api/companion/health` (public, cached 60 s) makes the cheapest real provider calls: a one-token chat per configured model, a two-word voice clip and a silent transcription. It returns `{chat, chatProviders, speech, transcription, checkedAt}`, each `{status: "ok" | "degraded" | "down" | "unconfigured", latencyMs?, code?}`. `GET /api/companion/status` only reports configuration.
- `GET /api/companion/whoami` (key or session) returns `{method, workspace: {name}, key?: {label}, quotas: {minute: {limit, remaining}, hour: {limit, remaining}}}` without using quota.

## Speech

- `POST /api/companion/text-to-speech`, JSON `{ "text": "Hello from SOZO", "language": "en-IN" }`: returns `{audio, mimeType, model}`. `audio` is base64 MP3 (`audio/mpeg`), generated by `bulbul:v4-flash`. Text is limited to 2,500 characters. Browser playback requires a user gesture and should provide Stop.
- `POST /api/companion/speech-to-text`, multipart field `file`: returns `{transcript, languageCode, model}` from `saaras:v4`. Record only after the user presses a microphone button; display recording state and stop at 30 seconds. Send audio under 3 MB. Release microphone tracks on stop, error and unmount. Allow transcript review before sending a question.
- `GET /api/companion/status`: public configuration flags and model IDs only. A configured key is not proof of current credits or successful model access.
- `GET /api/companion/model`: public, fixed SOZO GLB asset with permissive CORS, for the 3D companion renderer. No arbitrary remote asset URL is accepted.

Provider errors are redacted and distinguish missing configuration, unavailable credentials/model access, quota exhaustion and unavailable service. Do not log Authorization headers or provider response bodies.

## Scientific data boundaries

Literature retrieval uses Crossref and Europe PMC through the same relevance pipeline as research. DOI/metadata availability is not full-text validation or peer-review verification. NASA media search is an archive search, separate from terrain computation. MOMAR metrics remain attributed published figures. New live routing requires the gateway described above and validated scientific datasets; it is not enabled by attaching a screenshot.

## Provider references

- [Sarvam Chat V1](https://docs.sarvam.ai/api-reference/chat/chat-completions-v1)
- [Sarvam Chat V2 and inline image input](https://docs.sarvam.ai/api-reference/chat/chat-completions-v2)
- [Sarvam text to speech](https://docs.sarvam.ai/api-reference/text-to-speech/convert)
- [Sarvam speech to text](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe)
- [Authentication](https://docs.sarvam.ai/api-reference/authentication)

## Ready-to-use 3D component

Load the classic-script bundle, then add the component. Use your exact live origin (or `http://localhost:5173` locally):

```html
<script src="https://sozo.momar.si/embed/sozo-widget.js"></script>
<sozo-companion
  api-base="https://sozo.momar.si"
  session-endpoint="/api/sozo/session">
</sozo-companion>
```

Your `/api/sozo/session` belongs to your existing platform, must authenticate its visitor, and makes the server-to-server session request shown above. Pin `allowedOrigin` to your own deployment origin on the backend; never trust a browser-supplied origin or expose an unrestricted token broker. Return only `token`, `expiresAt`, and `allowedOrigin` with `Cache-Control: no-store`. The widget refreshes the token before expiry and retains it only in memory. Configure its attributes before mounting it.

```js
const companion = document.querySelector("sozo-companion");
companion.setContext({
  body: "moon",
  mapLabel: "Your selected map feature",
  notes: "Include your data source URL, timestamp, CRS and uncertainty.",
  route: {type: "LineString", coordinates: selectedRoute.geometry.coordinates},
  metrics: {terrainResolutionM: terrainLayer.nativeResolutionM}
});
// Sends no network request until the user asks a question.
// Clear context when the user changes map or signs out:
companion.clearContext();
```

The current route input requires longitude/latitude degrees. Reproject polar-stereographic or other projected coordinates on your validated backend first; never pass projected metres as degrees. Geometry is not sampled against terrain by SOZO. Extra undeclared context fields are rejected. `setContext` supplies the next conversation request, without recording the host screen. `clearContext()` clears supplied map metadata; start a new component/conversation when changing users because the existing visible dialogue is retained by the component.

Try `/embed/demo.html` while signed in to SOZO to see the same SDK running on its own platform. The demo uses a protected, same-origin session endpoint and contains no long-lived key. For an external host, the classic-script SDK and public model proxy support loading the companion; interactive requests use exact-origin CORS and scoped session tokens. Your site's CSP must allow this SOZO script origin, its API in `connect-src`, and `blob:` audio playback. Host CSS does not cross the component's shadow root. The standalone component uses a system font fallback; the SOZO app self-hosts licensed DM Sans and IBM Plex Mono WOFF2 fonts.
