// Local auth boundary checks. Credentials are supplied at execution, never stored here.
import assert from "node:assert/strict";
const base = process.env.SOZO_TEST_URL || "http://localhost:5173";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Auth smoke tests require the local preview.");
const email = process.env.SOZO_TEST_EMAIL,
  password = process.env.SOZO_TEST_PASSWORD;
if (!email || !password)
  throw new Error(
    "Set SOZO_TEST_EMAIL and SOZO_TEST_PASSWORD in the test process.",
  );
let passed = 0,
  cookie = "",
  apiToken = "";
function check(label, fn) {
  fn();
  passed++;
  console.log("PASS " + label);
}
async function request(path, method = "GET", data, headers = {}) {
  const response = await fetch(base + path, {
    method,
    redirect: "manual",
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const raw = await response.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    body = raw;
  }
  return { status: response.status, headers: response.headers, body };
}
const landing = await request("/");
check("landing is public and identifies both worlds", () => {
  assert.equal(landing.status, 200);
  assert.match(landing.body, /Moon/);
  assert.match(landing.body, /Mars/);
  assert.ok(!landing.body.includes(email));
  assert.ok(!landing.body.includes(password));
});
const anonymous = await request("/dashboard?view=moon");
check("dashboard requires sign-in and retains destination", () => {
  assert.equal(anonymous.status, 307);
  assert.match(anonymous.headers.get("location"), /view%3Dmoon/);
});
const noSession = await request("/api/v1/workspace");
check("workspace API rejects anonymous access", () =>
  assert.equal(noSession.status, 401),
);
const metadata = await request("/api/planetary");
check("public planetary metadata contains reported counts only", () => {
  assert.equal(metadata.status, 200);
  assert.equal(metadata.body.metrics.combinedPrimaryCells, 5960000);
  assert.equal(metadata.body.datasets.length, 36);
  assert.equal(metadata.body.user, undefined);
});
const foreign = await request(
  "/api/auth/login",
  "POST",
  { email, password },
  { Origin: "https://foreign.example" },
);
check("foreign browser sign-in is rejected", () =>
  assert.equal(foreign.status, 403),
);
const invalid = await request("/api/auth/login", "POST", {
  email,
  password: "incorrect-fixture-password",
});
check("invalid credentials return a generic error", () => {
  assert.equal(invalid.status, 401);
  assert.equal(
    invalid.body.error.message,
    "The email or password is incorrect.",
  );
});
const signed = await request("/api/auth/login", "POST", {
  email,
  password,
  returnTo: "/dashboard?view=moon",
});
cookie = signed.headers.get("set-cookie")?.split(";")[0] || "";
check("supplied credentials create an opaque HttpOnly session", () => {
  assert.equal(signed.status, 200, JSON.stringify(signed.body));
  assert.match(signed.headers.get("set-cookie"), /HttpOnly; SameSite=Lax/);
  assert.match(cookie, /^sozo_session=[a-f0-9]{64}$/);
  assert.equal(signed.body.redirect, "/dashboard?view=moon");
  assert.equal(signed.body.access_token, undefined);
});
const dashboard = await request("/dashboard", "GET", undefined, {
  Cookie: cookie,
});
check("session opens dashboard", () => assert.equal(dashboard.status, 200));
const workspace = await request("/api/v1/workspace", "GET", undefined, {
  Cookie: cookie,
});
check("session opens isolated workspace API", () => {
  assert.equal(workspace.status, 200);
  assert.equal(workspace.body.user.email, email);
  assert.match(workspace.body.user.id, /^workspace_/);
});
const invalidBearer = await request("/api/v1/workspace", "GET", undefined, {
  Cookie: cookie,
  Authorization: "Bearer invalid",
});
check("invalid explicit API key cannot fall back to browser session", () =>
  assert.equal(invalidBearer.status, 401),
);
const token = await request("/api/auth/token", "POST", { email, password });
apiToken = token.body.access_token;
check("credentials can obtain a real API bearer key", () => {
  assert.equal(token.status, 201);
  assert.match(apiToken, /^sozo_[a-f0-9]{64}$/);
});
try {
  const api = await request("/api/v1/workspace", "GET", undefined, {
    Authorization: "Bearer " + apiToken,
  });
  check("API key accesses the same owner", () => {
    assert.equal(api.status, 200);
    assert.equal(api.body.user.id, workspace.body.user.id);
  });
  const logout = await request(
    "/api/auth/logout",
    "POST",
    {},
    { Cookie: cookie },
  );
  check("logout expires the cookie", () => {
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);
  });
  const expired = await request("/api/v1/workspace", "GET", undefined, {
    Cookie: cookie,
  });
  check("logged-out session is rejected server-side", () =>
    assert.equal(expired.status, 401),
  );
} finally {
  const keys = await request("/api/v1/keys", "GET", undefined, {
    Authorization: "Bearer " + apiToken,
  });
  const key = keys.body.keys?.find((k) => k.prefix === apiToken.slice(0, 13));
  if (key)
    await request("/api/v1/keys/" + key.id, "DELETE", undefined, {
      Authorization: "Bearer " + apiToken,
    });
}
const isolatedIp = { "CF-Connecting-IP": "192.0.2.37" };
for (let i = 0; i < 5; i++) {
  const failure = await request(
    "/api/auth/login",
    "POST",
    { email, password: "rate-fixture" },
    isolatedIp,
  );
  assert.equal(failure.status, 401);
}
const throttled = await request(
  "/api/auth/login",
  "POST",
  { email, password },
  isolatedIp,
);
check("repeated failures throttle further sign-in attempts", () =>
  assert.equal(throttled.status, 429),
);
console.log(`${passed} authentication integration checks passed.`);
