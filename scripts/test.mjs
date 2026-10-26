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
  ["--test", ".sites-runtime/tests/tests/core.test.js", "tests/cli.test.mjs"],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
