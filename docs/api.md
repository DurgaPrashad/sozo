# API guide

See `/openapi.json` for exact routes and request properties. All `/api/v1` routes except health require a SOZO browser session, Sites identity, or an application bearer key. `/api/planetary` is public and contains only project-reported planetary metadata. All owned resources are filtered by owner. Writes require JSON and reject foreign browser origins. Errors use `{request_id,error:{code,message}}`; successful JSON includes `request_id`.

## cURL

```sh
curl "$SOZO_BASE_URL/api/v1/research" \
  -H "Authorization: Bearer $SOZO_API_KEY" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: your-unique-question-id' \
  -d '{"question":"Mars rover terrain slope planning","sources":["crossref"],"mode":"broad"}'
```

HTTP 202 returns `research_run_id` and a persisted `run`. Poll `GET /api/v1/research/{id}` until status is completed, partial, failed, or cancelled. Repeating the same Idempotency-Key and input returns the original run. Reusing it for different input returns 409. Concurrent submissions sharing a key are protected by a unique database index; conflict recovery is not automatically retried.

## Python (standard library)

```python
import json, os, urllib.request
base = os.environ['SOZO_BASE_URL']
headers = {'Authorization': 'Bearer ' + os.environ['SOZO_API_KEY'],
           'Content-Type': 'application/json'}
if os.getenv('SOZO_SITE_ACCESS_TOKEN'):
    headers['OAI-Sites-Authorization'] = 'Bearer ' + os.environ['SOZO_SITE_ACCESS_TOKEN']
request = urllib.request.Request(base + '/api/v1/research',
    data=json.dumps({'question': 'Ocean circulation climate change',
                     'sources': ['crossref', 'europepmc']}).encode(), headers=headers)
with urllib.request.urlopen(request, timeout=25) as response:
    submitted = json.load(response)
print(submitted['research_run_id'])
```

## TypeScript (server-side)

```typescript
const response = await fetch(`${process.env.SOZO_BASE_URL}/api/v1/research`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.SOZO_API_KEY}`,
    "Content-Type": "application/json",
    ...(process.env.SOZO_SITE_ACCESS_TOKEN
      ? {
          "OAI-Sites-Authorization": `Bearer ${process.env.SOZO_SITE_ACCESS_TOKEN}`,
        }
      : {}),
  },
  body: JSON.stringify({
    question: "Mars rover terrain planning",
    sources: ["crossref"],
  }),
  signal: AbortSignal.timeout(25000),
});
if (!response.ok) throw new Error(`SOZO returned ${response.status}`);
const submitted = await response.json();
```

Keep both application and hosting tokens out of browser code. Private hosted Sites need the separate service-access header in all three examples. This permission is not provisioned by SOZO.

## Research records

A record includes question, project, domain (organizational metadata, not an automatic query filter), selected sources, search depth, status, progress, timestamps, error, and a result containing metadata/abstract citations, findings tied to source IDs, limitations, source health, retrieval duration, source count, request count, and `model: null`.

`GET /api/v1/research/{id}/events` returns an authenticated SSE snapshot. Reconnect interval is 1500 ms; events are `progress` while running and `result` when terminal. This is a reconnecting snapshot protocol, not an indefinitely open stream. `POST /research/{id}/cancel` prevents result persistence after cancellation.

API keys currently inherit complete owner access; project-specific roles and narrow token scopes are future work. Write and active-run limits are best-effort checks, not atomic distributed quotas.

## Workspace sign-in

`POST /api/auth/login` accepts JSON `{email, password, returnTo?}` and sets an opaque HttpOnly, SameSite=Lax cookie (Secure over HTTPS), valid for eight hours. `returnTo` is constrained to the dashboard. `GET /api/auth/session` returns the authenticated identity. `POST /api/auth/logout` revokes the session. Foreign browser origins are rejected. Repeated failures are throttled per client IP in ten-minute windows. The account is configured through server secrets, with a salted PBKDF2 verifier; credentials are never bundled into the UI.

Server-side clients can exchange those same credentials with `POST /api/auth/token`, using JSON `{email, password}`. HTTP 201 returns `{access_token, token_type: "Bearer", user}`. Store the returned token securely and send `Authorization: Bearer <access_token>` to `/api/v1` routes. Revoke it under API keys or with `DELETE /api/v1/keys/{id}`. These owner-level keys do not expire automatically. Never expose them in public browser code.
