"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { allowlistDir, fail, readText, repoRoot, toPosix } = require("./lib");
const { listChangedFiles, requireBaseRef } = require("./base-ref");
const { assertPathAllowlistNotBroadened, parsePathAllowlist } = require("./allowlist-freeze");

const SOURCE_RE = /\.(?:js|cjs|mjs)$/i;
const TYPESCRIPT_RE = /\.(?:ts|tsx)$/i;

function eslintBin() {
  return path.join(repoRoot(), "node_modules", "eslint", "bin", "eslint.js");
}

function runEslint(targets) {
  if (!targets.length) {
    return { status: 0, stdout: "", stderr: "" };
  }
  const result = spawnSync(
    process.execPath,
    [eslintBin(), "--max-warnings", "0", ...targets],
    {
      cwd: repoRoot(),
      encoding: "utf8",
    }
  );
  return result;
}

function loadLegacyPaths() {
  const abs = path.join(allowlistDir(), "legacy-lint-paths.txt");
  return parsePathAllowlist(readText(abs));
}

function collectForwardFiles(legacy) {
  const changed = listChangedFiles().map((rel) => toPosix(rel));
  const typescriptHits = changed.filter((rel) => {
    if (!TYPESCRIPT_RE.test(rel)) {
      return false;
    }
    return fs.existsSync(path.join(repoRoot(), rel));
  });
  if (typescriptHits.length) {
    fail(
      "SR-CI-001: TypeScript/TSX is outside the P0.0 lint surface. Land typed linting (typescript-eslint) before the first .ts/.tsx source PR. See Issue #9.",
      typescriptHits.map((rel) => `blocked ${rel}`)
    );
  }

  return changed.filter((rel) => {
    if (!SOURCE_RE.test(rel)) {
      return false;
    }
    if (legacy.has(rel)) {
      return false;
    }
    if (rel.startsWith("scripts/")) {
      return false;
    }
    return fs.existsSync(path.join(repoRoot(), rel));
  });
}

function main() {
  requireBaseRef();
  assertPathAllowlistNotBroadened("scripts/ci/allowlists/legacy-lint-paths.txt");
  const legacy = loadLegacyPaths();

  if (process.env.FITGEN_CI_SKIP_SCRIPTS !== "1") {
    const scriptsLint = runEslint(["scripts"]);
    if (scriptsLint.status !== 0) {
      if (scriptsLint.stdout) {
        process.stdout.write(scriptsLint.stdout);
      }
      if (scriptsLint.stderr) {
        process.stderr.write(scriptsLint.stderr);
      }
      fail("SR-CI-001: lint failed on scripts/.");
    }
    console.log("lint: scripts/ clean.");
  }

  const extra = collectForwardFiles(legacy);
  if (!extra.length) {
    console.log("lint: no new/changed non-legacy JS/CJS/MJS outside scripts/.");
    return;
  }

  console.log("lint: forward-looking files:");
  for (const rel of extra) {
    console.log(`  ${rel}`);
  }

  const extraLint = runEslint(extra);
  if (extraLint.status !== 0) {
    if (extraLint.stdout) {
      process.stdout.write(extraLint.stdout);
    }
    if (extraLint.stderr) {
      process.stderr.write(extraLint.stderr);
    }
    fail("SR-CI-001: lint failed on changed/new JS/CJS/MJS outside the legacy allowlist.");
  }
  console.log("lint: changed/new non-legacy JS/CJS/MJS files clean.");
}

if (require.main === module) {
  main();
}

module.exports = {
  SOURCE_RE,
  TYPESCRIPT_RE,
  collectForwardFiles,
  loadLegacyPaths,
  main,
};
