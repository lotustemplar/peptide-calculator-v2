"use strict";

const fs = require("fs");
const path = require("path");
const { allowlistDir, fail, relPosix, repoRoot, walkFiles } = require("./lib");
const { requireBaseRef } = require("./base-ref");
const { assertPathAllowlistNotBroadened } = require("./allowlist-freeze");

const FIX_FILE_RE = /-(?:fix|fixes)\.js$/;

function isRuntimeFixJs(relPath) {
  const base = path.posix.basename(relPath);
  return FIX_FILE_RE.test(base);
}

function main() {
  requireBaseRef();
  const allowPath = path.join(allowlistDir(), "runtime-fix-js.txt");
  if (!fs.existsSync(allowPath)) {
    fail("SR-CI-001: runtime *-fix.js allowlist is missing.", [allowPath]);
  }

  const allowed = assertPathAllowlistNotBroadened("scripts/ci/allowlists/runtime-fix-js.txt");
  const found = walkFiles(repoRoot())
    .map((abs) => relPosix(repoRoot(), abs))
    .filter(isRuntimeFixJs);

  const extra = found.filter((rel) => !allowed.has(rel));
  const missing = [...allowed].filter((rel) => !found.includes(rel)).sort();

  if (extra.length) {
    fail(
      "SR-CI-001: new runtime *-fix.js files are forbidden (AGENTS.md / Spec P0.0).",
      extra.map((rel) => `added ${rel}`)
    );
  }

  console.log(`no-new-*-fix.js gate passed (${found.length} allowlisted runtime patches).`);
  if (missing.length) {
    console.log("Allowlisted files not present (OK if a later slice retires a patch after tests):");
    for (const rel of missing) {
      console.log(`  ${rel}`);
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  FIX_FILE_RE,
  isRuntimeFixJs,
  main,
};
