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

Optional `context.screenshot` accepts a JPEG, PNG or WebP inline data URL under 2 MB. The request switches from `sarvam-105b-conversations` to the documented image-capable `gemma4` model at Sarvam's V2 endpoint. Actual access depends on provider credentials, credits and model availability. Do not claim image analysis if this request fails. Screenshots cannot reveal hidden map layers, source resolutions or measurements absent from visible pixels.

Load `/embed/sozo-context.js` to use `window.SozoContext.captureScreen()` from a user's explicit button click. It opens the browser's native selection dialog, captures one image and immediately stops all media tracks. It sends nothing. Show a local preview, allow Remove, and obtain an explicit Send action before including that image in a chat request. Alternatively let the user upload a map image. Never scrape unrelated browser tabs, capture silently, or continually transmit the desktop. Prefer structured map layers/route metadata over screenshots when available.

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
<script src="https://sozo-research-lab.sharpscarf8.chatgpt.site/embed/sozo-widget.js"></script>
<sozo-companion
  api-base="https://sozo-research-lab.sharpscarf8.chatgpt.site"
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
