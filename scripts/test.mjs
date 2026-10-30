import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const build = spawnSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "-p", "tsconfig.tests.json"],
  { stdio: "inherit" },
);
if (build.status) process.exit(build.status);
mkdirSync(".sites-runtime/tests", { recursive: true });
writeFileSync(".sites-runtime/tests/package.json", '{"type":"commonjs"}');
const result = spawnSync(
  process.execPath,
  ["--test", ".sites-runtime/tests/tests/core.test.js", ".sites-runtime/tests/tests/relevance.test.js", ".sites-runtime/tests/tests/companion.test.js", ".sites-runtime/tests/tests/claim-checks.test.js", ".sites-runtime/tests/tests/article-cache.test.js", ".sites-runtime/tests/tests/facebook.test.js", ".sites-runtime/tests/tests/supabase.test.js", ".sites-runtime/tests/tests/diagnostics.test.js", ".sites-runtime/tests/tests/companion-reliability.test.js", ".sites-runtime/tests/tests/astro.test.js", "tests/cli.test.mjs", "tests/postgres.test.mjs"],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
