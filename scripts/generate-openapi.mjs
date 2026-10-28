import { writeFileSync, copyFileSync } from "node:fs";
const paths = {};
const add = (path, method, summary, body, status = "200") => {
  (paths["/api/v1" + path] ??= {})[method] = {
    summary,
    operationId: method + "_" + path.replace(/[^a-zA-Z0-9]/g, "_"),
    ...(path.includes("{id}")
      ? {
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
        }
      : {}),
    ...(body
      ? {
          requestBody: {
            required: true,
            content: { "application/json": { schema: body } },
          },
        }
      : {}),
    responses: {
      [status]: {
        description:
          status === "202"
            ? "Research accepted; poll the returned run ID"
            : "Success",
        content: {
          "application/json": {
            schema: { type: "object", additionalProperties: true },
          },
        },
      },
      400: { $ref: "#/components/responses/Error" },
      401: { $ref: "#/components/responses/Error" },
      404: { $ref: "#/components/responses/Error" },
      429: { $ref: "#/components/responses/Error" },
    },
  };
};
const object = (properties, required = []) => ({
  type: "object",
  properties,
  required,
});
const str = { type: "string" };
const id = { type: "string", format: "uuid" };
add("/health", "get", "Health and actual research engine mode");
paths["/api/v1/health"].get.security = [];
add("/space-data", "get", "Search original NASA archive media with provenance");
paths["/api/v1/space-data"].get.parameters = [
  {
    name: "q",
    in: "query",
    schema: { type: "string", minLength: 2, maxLength: 160 },
    description:
      "Scientific term, mission, or instrument; defaults to lunar south pole.",
  },
  {
    name: "media",
    in: "query",
    schema: { type: "string", enum: ["all", "image", "video"], default: "all" },
  },
];
paths["/api/v1/space-data"].get.responses["502"] = {
  description:
    "NASA archive unavailable; no substitute records are fabricated.",
};
add("/workspace", "get", "Authenticated personal workspace");
add("/projects", "get", "List owned projects");
add(
  "/projects",
  "post",
  "Create a project",
  object(
    {
      name: { type: "string", minLength: 1, maxLength: 100 },
      description: { type: "string", maxLength: 500 },
      color: { type: "string", enum: ["lime", "blue", "purple", "orange"] },
    },
    ["name"],
  ),
  "201",
);
add("/projects/{id}", "delete", "Delete a project; preserve its research");
add("/research", "get", "List owned research runs");
add(
  "/research",
  "post",
  "Start bounded literature discovery",
  object(
    {
      question: { type: "string", minLength: 5, maxLength: 1500 },
      domain: { type: "string", maxLength: 80 },
      mode: { type: "string", enum: ["broad", "focused"], default: "broad" },
      sources: {
        type: "array",
        items: { type: "string", enum: ["crossref", "europepmc"] },
        minItems: 1,
        maxItems: 2,
        uniqueItems: true,
      },
      projectId: { ...id, nullable: true },
    },
    ["question"],
  ),
  "202",
);
paths["/api/v1/research"].post.parameters = [
  {
    name: "Idempotency-Key",
    in: "header",
    schema: { type: "string", maxLength: 120 },
    description: "Reuse a key to retrieve an already-created run.",
  },
];
for (const [suffix, summary] of [
  [
    "",
    "Retrieve run status, citations, progress, limitations, and source usage",
  ],
  ["/report", "Retrieve full JSON research report"],
])
  add("/research/{id}" + suffix, "get", summary);
add(
  "/research/{id}/events",
  "get",
  "SSE snapshot: progress or result event, reconnect after 1500 ms",
);
paths["/api/v1/research/{id}/events"].get.responses["200"].content = {
  "text/event-stream": { schema: { type: "string" } },
};
add(
  "/research/{id}/cancel",
  "post",
  "Cancel a running research job",
  object({}),
);
add("/research/{id}", "delete", "Delete a terminal research run");
add("/notes", "get", "List owned notebook entries");
add(
  "/notes",
  "post",
  "Save a source or research note",
  object(
    {
      title: { type: "string", minLength: 1, maxLength: 300 },
      content: { type: "string", maxLength: 20000 },
      sourceUrl: { type: "string", format: "uri", nullable: true },
    },
    ["title", "content"],
  ),
  "201",
);
add("/notes/{id}", "delete", "Delete an owned note");
add("/connectors", "get", "List registered integrations");
add(
  "/connectors/discover",
  "post",
  "Discover public read capabilities from an approved-host OpenAPI 3 JSON document",
  object({ url: { type: "string", format: "uri" } }, ["url"]),
);
add(
  "/connectors",
  "post",
  "Register explicitly approved public read operations",
  object(
    {
      name: { type: "string", minLength: 1, maxLength: 100 },
      url: { type: "string", format: "uri" },
      approved: { type: "array", items: str, minItems: 1, maxItems: 100 },
    },
    ["name", "url", "approved"],
  ),
  "201",
);
add(
  "/connectors/test",
  "post",
  "Test a native scientific source with a live harmless request",
  object({ provider: { type: "string", enum: ["crossref", "europepmc"] } }, [
    "provider",
  ]),
);
add("/connectors/{id}", "get", "Inspect registered capabilities");
add("/connectors/{id}", "delete", "Revoke an integration");
add(
  "/connectors/{id}/invoke",
  "post",
  "Invoke an approved GET capability",
  object(
    { capability: str, input: { type: "object", additionalProperties: true } },
    ["capability"],
  ),
);
add("/keys", "get", "List API key metadata (never raw secrets)");
add(
  "/keys",
  "post",
  "Create a key shown once",
  object({ name: { type: "string", minLength: 1, maxLength: 100 } }, ["name"]),
  "201",
);
add("/keys/{id}", "delete", "Revoke an API key");
add("/audit", "get", "Latest 100 owned audit events");
for (const action of ["login", "token"])
  paths["/api/auth/" + action] = {
    post: {
      summary:
        action === "login"
          ? "Sign in and create an HttpOnly workspace session"
          : "Exchange workspace credentials for a revocable API key",
      operationId: "auth_" + action,
      security: [],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: object(
              {
                email: { type: "string", format: "email" },
                password: { type: "string", format: "password" },
                ...(action === "login" ? { returnTo: { type: "string" } } : {}),
              },
              ["email", "password"],
            ),
          },
        },
      },
      responses: {
        [action === "login" ? "200" : "201"]: {
          description:
            action === "login"
              ? "Authenticated; Set-Cookie contains the session"
              : "Bearer access_token and user identity",
        },
        400: { description: "Invalid input" },
        401: { description: "Invalid credentials" },
        429: { description: "Sign-in rate limit" },
        503: { description: "Workspace sign-in not configured" },
      },
    },
  };
paths["/api/auth/session"] = {
  get: {
    summary: "Current authenticated identity",
    operationId: "auth_session",
    responses: {
      200: { description: "Current identity" },
      401: { description: "Not authenticated" },
    },
  },
};
paths["/api/auth/logout"] = {
  post: {
    summary: "Revoke current browser session",
    operationId: "auth_logout",
    responses: { 200: { description: "Session revoked and cookie expired" } },
  },
};
paths["/api/planetary"] = {
  get: {
    summary: "Public project-reported Moon and Mars metadata and provenance",
    operationId: "planetary_metadata",
    security: [],
    responses: {
      200: {
        description: "Reported metrics and source catalog, without user data",
      },
    },
  },
};
const spec = {
  openapi: "3.0.3",
  info: {
    title: "SOZO Research API",
    version: "0.4.0",
    description:
      "Scientific literature discovery and live NASA archive search with source provenance. Sarvam supports grounded conversation, speech and explicitly shared screenshots. Live MOMAR route computation, MCP, OAuth, and arbitrary code execution are not configured. Browser identity uses an HttpOnly SOZO session or optional Sites sign-in. API clients use a SOZO bearer key; the current landing page is public.",
  },
  servers: [{ url: "/" }],
  security: [{ SozoKey: [] }, { SozoSession: [] }],
  paths,
  components: {
    securitySchemes: {
      SozoSession: {
        type: "apiKey",
        in: "cookie",
        name: "sozo_session",
        description:
          "Opaque eight-hour session issued by POST /api/auth/login.",
      },
      SozoKey: {
        type: "http",
        scheme: "bearer",
        description:
          "sozo_ API key created in the workspace. Private Sites additionally require OAI-Sites-Authorization at the hosting boundary.",
      },
    },
    responses: {
      Error: {
        description: "Structured error with request_id",
        content: {
          "application/json": {
            schema: object(
              {
                request_id: str,
                error: object({ code: str, message: str }, ["code", "message"]),
              },
              ["request_id", "error"],
            ),
          },
        },
      },
    },
  },
};
for (const [path,method,summary] of [
 ["/api/companion/status","get","Companion configuration, without credentials"],
 ["/api/companion/sessions","post","Issue a 10-minute origin-bound companion session"],
 ["/api/companion/sessions","delete","Revoke an owned companion session"],
 ["/api/companion/chat","post","Grounded conversation with optional explicit screen snapshot"],
 ["/api/companion/text-to-speech","post","Sarvam spoken audio"],
 ["/api/companion/speech-to-text","post","Transcribe an explicit microphone recording"],
 ["/api/articles","get","Relevant Moon and Mars publication metadata"]
]) {
 (paths[path]??={})[method]={summary,operationId:method+path.replace(/[^a-zA-Z0-9]/g,"_"),security:path.endsWith("status")||path==="/api/articles"?[]:[{SozoKey:[]}],responses:{200:{description:"Success; see companion integration guide for exact payloads"},400:{$ref:"#/components/responses/Error"},401:{$ref:"#/components/responses/Error"}},externalDocs:{url:"/docs/companion-integration.md"}};
}
writeFileSync("public/openapi.json", JSON.stringify(spec, null, 2) + "\n");
copyFileSync("cli/sozo.mjs", "public/cli/sozo.mjs");
