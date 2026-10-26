# CLI reference

Run `node cli/sozo.mjs --help`, or `npm link` and use `sozo`. Requires Node 22+.

Environment: `SOZO_BASE_URL`, `SOZO_API_KEY`, and optionally `SOZO_SITE_ACCESS_TOKEN` for a private hosted Site. HTTPS is required outside loopback. Tokens are sent in headers, never URLs, and redirects are rejected.

```sh
sozo project list
sozo project create --name planetary-research
sozo research run --question "Mars rover terrain planning" --project <project-uuid> --sources crossref,europepmc --mode broad
sozo research status <research-run-id>
sozo research report <research-run-id>
sozo research cancel <research-run-id>
sozo connect list
sozo connect test crossref
sozo connect test europepmc
sozo connect add --name momar --type openapi --url https://<your-momar-host>/openapi.json
# Review the returned capabilities; registration requires exact approved IDs:
sozo connect add --name momar --type openapi --url https://<your-momar-host>/openapi.json --approve <read-operation-id>
sozo connect inspect momar
sozo connect capabilities momar
sozo connect invoke momar --capability <read-operation-id> --input '{"region":"<real-region-id>"}'
sozo connect remove momar
```

The MOMAR URL and IDs above are placeholders, not production endpoints. The host must be reviewed and configured by the administrator first. Discovery alone never registers or executes an operation. Custom `connect test` checks registration only and explicitly reports that no harmless remote health operation is defined. Use `invoke` with a deliberately selected read capability to test the actual API.

JSON is written to stdout; errors to stderr, with nonzero exit status. CLI output can include your research or a newly created key if the invoked endpoint returns one: handle output as workspace data. Unsupported protocols fail explicitly.
