// Local-only verification of original NASA records and supplied film assets.
import assert from "node:assert/strict";
const base = process.env.SOZO_TEST_URL || "http://localhost:5173";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Use the local preview for smoke tests.");
const email = process.env.SOZO_TEST_EMAIL,
  password = process.env.SOZO_TEST_PASSWORD;
if (!email || !password)
  throw new Error("Supply test credentials through the process environment.");
let passed = 0;
const check = (label, fn) => {
  fn();
  passed++;
  console.log("PASS " + label);
};
const denied = await fetch(base + "/api/v1/space-data?q=Moon");
check("NASA proxy requires authentication", () =>
  assert.equal(denied.status, 401),
);
const login = await fetch(base + "/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
assert.equal(login.status, 200);
const cookie = login.headers.get("set-cookie").split(";")[0];
try {
  for (const q of ["q=x", "q=Moon&media=audio"]) {
    const r = await fetch(base + "/api/v1/space-data?" + q, {
      headers: { Cookie: cookie },
    });
    check("invalid NASA query rejected: " + q, () =>
      assert.equal(r.status, 400),
    );
  }
  const r = await fetch(
    base + "/api/v1/space-data?q=Mars%20rover&media=image",
    { headers: { Cookie: cookie } },
  );
  const data = await r.json();
  check("NASA returns original records", () => {
    assert.equal(r.status, 200);
    assert.equal(data.provider, "NASA Image and Video Library");
    assert.ok(data.records.length > 0 && data.records.length <= 12);
    assert.ok(data.retrievedAt);
  });
  check("NASA records preserve source provenance and HTTPS previews", () => {
    for (const item of data.records) {
      assert.ok(item.id);
      assert.ok(item.date);
      assert.ok(item.sourceUrl.startsWith("https://images.nasa.gov/details/"));
      assert.ok(
        !item.thumbnail ||
          item.thumbnail.startsWith("https://images-assets.nasa.gov/"),
      );
    }
    assert.ok(data.limitations.length);
  });
  console.log(
    JSON.stringify({
      provider: data.provider,
      records: data.records.length,
      firstTitle: data.records[0].title,
    }),
  );
  for (const name of [
    "orbital-assistance",
    "lunar-fieldwork",
    "martian-frontier",
  ]) {
    const asset = await fetch(`${base}/films/sozo-${name}.mp4`, {
      headers: { Range: "bytes=0-63" },
    });
    check("video supports efficient range playback: " + name, () => {
      assert.equal(asset.status, 206);
      assert.match(asset.headers.get("content-type"), /video\/mp4/);
      assert.match(asset.headers.get("content-range"), /^bytes 0-63\//);
    });
    const poster = await fetch(`${base}/films/sozo-${name}.jpg`, {
      method: "HEAD",
    });
    check("video poster is available: " + name, () =>
      assert.equal(poster.status, 200),
    );
  }
} finally {
  await fetch(base + "/api/auth/logout", {
    method: "POST",
    headers: { Cookie: cookie },
  });
}
console.log(`${passed} space-data and media checks passed.`);
