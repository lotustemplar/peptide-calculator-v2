"use strict";

const fs = require("fs");
const path = require("path");
const { allowlistDir, fail, relPosix, repoRoot, walkFiles } = require("./lib");

const FIX_FILE_RE = /-(?:fix|fixes)\.js$/;

function loadAllowlist(absPath) {
  const text = fs.readFileSync(absPath, "utf8");
  return new Set(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
  );
}

function isRuntimeFixJs(relPath) {
  const base = path.posix.basename(relPath);
  return FIX_FILE_RE.test(base);
}

function main() {
  const root = repoRoot();
  const allowPath = path.join(allowlistDir(), "runtime-fix-js.txt");
  if (!fs.existsSync(allowPath)) {
    fail("SR-CI-001: runtime *-fix.js allowlist is missing.", [allowPath]);
  }

  const allowed = loadAllowlist(allowPath);
  const found = walkFiles(root)
    .map((abs) => relPosix(root, abs))
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

main();
