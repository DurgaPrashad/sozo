# Connector SDK and security boundaries

`ScientificConnector` and `Capability` are exported from `lib/science/connectors.ts`. An adapter exposes `name`, `version`, `discover`, `health`, and `execute`. Capabilities carry an ID, name, description, GET method/path, primitive path/query parameter schemas, version, and read classification. This is an internal TypeScript contract, not a published npm package or a claim that arbitrary plugin code is sandboxed. Custom code must be reviewed and deployed as application code.

## Onboarding

1. An administrator reviews the endpoint's host and configures `SOZO_CONNECTOR_HOSTS` server-side.
2. `POST /connectors/discover` retrieves a bounded OpenAPI 3 JSON specification. HTTPS, exact host allowlisting, no embedded credentials, no nonstandard ports, no fragments, no redirects, and response time/size limits apply.
3. The caller reviews candidate GET capabilities. Authenticated operations, referenced parameters, header/cookie parameters, and write methods are excluded.
4. Registration refetches the specification and stores only explicitly approved IDs. The registry stores no upstream secret.
5. Invocation checks owner and approved capability, validates supported primitive inputs, builds an encoded same-origin URL, executes a bounded read, and stores an audit event.
6. Deletion revokes the registration immediately. No arbitrary discovered capability is executed during discovery.

Descriptions and output are data. They cannot grant permissions. The UI renders publication metadata, abstracts, and descriptions as React text, never executable HTML.

## Current constraints

This is deliberately limited OpenAPI support. External/local schema references, arbitrary JSON Schema constraints, complex input/output schemas, response-schema validation, authenticated connectors, OAuth, MCP, GraphQL, browser tools, webhook execution, and arbitrary code packages are not supported. Only supported primitive parameter types and enums are checked at invocation. Do not advertise a fully compliant OpenAPI runtime.

Exact-host allowlisting avoids accepting arbitrary user-controlled destinations. Administrators must never approve a hostname that resolves to an internal service or can be rebound by an untrusted party. This release does not perform independent DNS resolution or IP pinning. Upstream redirects are never followed. Native source domains are fixed in code.

## MOMAR

No real MOMAR endpoint or source repository was available. The test fixture labeled `MOMAR mock contract (not a real API)` exercises read discovery, write exclusion, parameter typing, and malicious-description isolation. It does not represent actual MOMAR operation names, terrain products, or scientific results. Replace configuration only after inspecting the actual API. A real integration must preserve units, coordinates, coverage, resolution, source version, and provenance before terrain science is advertised.

## Application security

Sites authenticates hosted visitors and supplies trusted identity headers. Never expose the Worker directly behind a proxy that accepts spoofable `oai-authenticated-*` headers. Portable mock identity exists only in development. API keys use 256 bits of random secret material and SHA-256 hashes, with metadata-only list responses and immediate revocation. Keys currently have owner-wide access.

Every owned read/write is filtered by owner. Project references are checked. Requests and responses are bounded. Writes reject cross-origin browser origins, enforce JSON, and create audit metadata without logging secrets or question text. Computation accepts numbers, not code. Error responses mask database internals. Audit metadata is per owner; rate limiting is best effort (30 audited writes/minute and three recent active runs), not a distributed security perimeter.
