import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, runCLI } from "../cli/sozo.mjs";
test("parse exact CLI shapes", () =>
  assert.deepEqual(parse(["research", "run", "--question", "Mars terrain"]), {
    group: "research",
    command: "run",
    target: undefined,
    options: { question: "Mars terrain" },
  }));
test("reject unknown or missing CLI options", () => {
  assert.throws(() => parse(["connect", "add", "--password", "secret"]));
  assert.throws(() => parse(["research", "run", "--question"]));
});
test("help works without credentials", async () =>
  assert.ok((await runCLI(["--help"])).usage.length > 0));
test("require explicit API configuration", async () =>
  assert.rejects(
    () => runCLI(["connect", "list"], { baseURL: undefined, token: undefined }),
    /Set SOZO_BASE_URL/,
  ));
test("CLI sends exact request and authentication", async () => {
  let calls = 0;
  const d = await runCLI(
    ["research", "run", "--question", "Mars terrain", "--sources", "crossref"],
    {
      baseURL: "https://example.org",
      token: "test-only",
      fetcher: async (url, o) => {
        calls++;
        assert.equal(url, "https://example.org/api/v1/research");
        assert.equal(o.method, "POST");
        assert.equal(o.headers.Authorization, "Bearer test-only");
        assert.deepEqual(JSON.parse(o.body).sources, ["crossref"]);
        return Response.json({ research_run_id: "test" });
      },
    },
  );
  assert.equal(calls, 1);
  assert.equal(d.research_run_id, "test");
});
test("connector add discovers without registering unapproved operations", async () => {
  let calls = 0;
  await runCLI(
    [
      "connect",
      "add",
      "--name",
      "momar",
      "--type",
      "openapi",
      "--url",
      "https://example.org/openapi.json",
    ],
    {
      baseURL: "https://example.org",
      token: "test",
      fetcher: async (url) => {
        calls++;
        assert.match(url, /discover$/);
        return Response.json({ capabilities: [{ id: "terrain" }] });
      },
    },
  );
  assert.equal(calls, 1);
});
test("CLI surfaces API errors and private hosting gates", async () => {
  await assert.rejects(
    () =>
      runCLI(["connect", "list"], {
        baseURL: "https://example.org",
        token: "test",
        fetcher: async () =>
          Response.json({ error: { message: "Denied" } }, { status: 403 }),
      }),
    /Denied/,
  );
  await assert.rejects(
    () =>
      runCLI(["connect", "list"], {
        baseURL: "https://example.org",
        token: "test",
        fetcher: async () =>
          new Response("<html>Sign in</html>", {
            headers: { "Content-Type": "text/html" },
          }),
      }),
    /requires sign-in/,
  );
});
