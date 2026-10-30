# SOZO v0.5: reliable answers

## Changelog

- Provider errors name the failing service (conversation, voice, speech recognition, image) and separate timeouts (`provider_timeout`, 504) from connection failures (`provider_unreachable`, 502). Sarvam statuses map to `provider_auth`, `provider_credits`, `provider_rate_limited` (with `Retry-After`), `provider_error` and `provider_rejected`.
- One error shape everywhere: `{error: {code, message, retryable, retryAfterSeconds?, requestId, fields?}}`, with `X-Request-ID` and `Retry-After` headers.
- Chat runs within a 50 s budget: literature at most 8 s in parallel, the model at most 40 s; transient failures retry once; Meta Llama (optional) answers when Sarvam fails.
- `Accept: text/event-stream` streams the answer (`status`, `delta`, `calculations`, `citations`, `analysis`, `limitations`, `done`, `error`).
- `style: brief | standard | detailed`; `timings` and `requestId` in every answer; `facts` up to 60.
- Exact astrodynamics calculator (orbits, escape velocity, Hohmann and planet-to-planet transfers, rocket equation, surface gravity) used as a model tool for numeric questions.
- `GET /api/companion/health` (real provider checks) and `GET /api/companion/whoami` (key label and remaining quota).
- Provider keys pasted with hidden characters, quotes or a `NAME=`/`Bearer` prefix are cleaned before use; a key that is still unusable reports `provider_key_invalid` (previously every such failure read "the speech provider could not be reached"). `/api/companion/health` describes each key's format without revealing it.
- `GET /api/companion/model` no longer forwards a `Content-Encoding` the body does not have (fixes `ERR_CONTENT_DECODING_FAILED`).
- The 3D companion's scanner runs while SOZO researches and occasionally at random, in any direction (replaced in v0.6 by scanning on demand).

## Migration note for MOMAR (`src/lib/sozo/server.ts`)

1. **Errors.** Read `error.code`, `error.retryable` and `error.retryAfterSeconds` instead of parsing `message`. Retry only when `retryable` is true, after `retryAfterSeconds`. Show `error.message` to users: it now names the right service.
2. **Answer length.** Send `"style": "brief"` instead of appending "(Answer briefly…)" to the question.
3. **Facts.** Up to 60 `context.facts` are accepted.
4. **Timeout.** Use a 60 s client timeout for JSON chat.
5. **Streaming (optional).** Send `Accept: text/event-stream` and forward `delta` events to the browser for answers that appear as they are written; keep the JSON path as a fallback.
6. **Status line (optional).** Call `GET /api/companion/whoami` to show "Connected as …" and the quota left, and `GET /api/companion/health` before showing SOZO as available.
7. **Calculations.** Numeric answers now include `calculations`; show them next to the reply if useful.

No request field was removed; existing MOMAR requests keep working unchanged.
