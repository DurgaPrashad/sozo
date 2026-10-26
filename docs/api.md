# API guide

See `/openapi.json` for exact routes and request properties. All routes except health require Sites browser identity or an application bearer key. All owned resources are filtered by owner. Writes require JSON and reject foreign browser origins. Errors use `{request_id,error:{code,message}}`; successful JSON includes `request_id`.

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
