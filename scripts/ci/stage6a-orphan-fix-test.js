#!/usr/bin/env node
"use strict";

/**
 * Stage 6a orphan *-fix.js retirement locks (Issue #34).
 * Does not execute calculator math or change reminder architecture.
 *
 * Characterization: the five allowlisted patches are not loaded by
 * index.html and are not referenced by any runtime-loaded script.
 * Deletion lock: those files are gone from disk and from
 * scripts/ci/allowlists/runtime-fix-js.txt. Remaining loaded patches stay
 * put except later Stage 6b loaded-patch retirements.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { parsePathAllowlist } = require("./allowlist-freeze");
const { readText, repoRoot } = require("./lib");

const ROOT = repoRoot();

const STAGE6A_ORPHANS = [
  "fill-name-suggestions-fix.js",
  "native-reminder-fix.js",
  "native-reminder-ux-fix.js",
  "notification-fix.js",
  "settings-fix.js",
];

const LOADED_PATCHES = [
  "native-backup-fix.js",
  "runtime-fixes.js",
];

const FROZEN_GOLDENS = "659c1865da95c3197395c931e154c4267c802d8aaf7842aee83345962d013acd";
const FROZEN_APP = "489cd7b88b90e00bd2a700518312577cf5a65cf12cacc003d9a181422606a537";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${message}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL  ${message}`);
}

function sha256File(rel) {
  const abs = path.join(ROOT, rel);
  return crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
}

function extractScriptSrcs(html) {
  const srcs = [];
  const re = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
  let match = re.exec(html);
  while (match) {
    srcs.push(match[1].replace(/^\.\//, "").replace(/^\//, ""));
    match = re.exec(html);
  }
  return srcs;
}

function mentionsBasename(text, basename) {
  const escaped = basename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\w./-])${escaped}(?:$|[^\\w-])`).test(text);
}

function parseFixAllowlist() {
  const abs = path.join(ROOT, "scripts/ci/allowlists/runtime-fix-js.txt");
  return parsePathAllowlist(readText(abs));
}

function main() {
  console.log("Stage 6a orphan *-fix.js unused + retired");

  const html = readText(path.join(ROOT, "index.html"));
  const loadedSrcs = extractScriptSrcs(html);
  assert(loadedSrcs.length > 0, "index.html declares at least one script src");

  for (const orphan of STAGE6A_ORPHANS) {
    assert(
      !loadedSrcs.includes(orphan),
      `${orphan} is not a script src in index.html`
    );
    assert(!mentionsBasename(html, orphan), `${orphan} is not mentioned in index.html`);
  }

  for (const patch of LOADED_PATCHES) {
    assert(loadedSrcs.includes(patch), `${patch} remains loaded by index.html`);
  }

  for (const src of loadedSrcs) {
    const abs = path.join(ROOT, src);
    assert(fs.existsSync(abs), `loaded script ${src} exists on disk`);
    const body = readText(abs);
    for (const orphan of STAGE6A_ORPHANS) {
      assert(
        !mentionsBasename(body, orphan),
        `loaded ${src} does not reference ${orphan}`
      );
    }
  }

  for (const orphan of STAGE6A_ORPHANS) {
    assert(
      !fs.existsSync(path.join(ROOT, orphan)),
      `${orphan} is deleted from the repository root`
    );
  }

  const allowed = parseFixAllowlist();
  for (const orphan of STAGE6A_ORPHANS) {
    assert(!allowed.has(orphan), `runtime-fix-js allowlist no longer lists ${orphan}`);
  }
  for (const patch of LOADED_PATCHES) {
    assert(allowed.has(patch), `runtime-fix-js allowlist still lists loaded ${patch}`);
  }

  const copyAllow = JSON.parse(readText(path.join(ROOT, "scripts/ci/allowlists/forbidden-copy.json")));
  const copyFiles = (copyAllow.entries || []).map((entry) => entry.file);
  for (const orphan of STAGE6A_ORPHANS) {
    assert(
      !copyFiles.includes(orphan),
      `forbidden-copy allowlist has no leftover ${orphan} exception`
    );
  }

  assert(sha256File("app.js") === FROZEN_APP, "app.js SHA-256 unchanged (no formula-builder edits)");
  assert(
    sha256File("scripts/calc/fixtures/legacy-evidence-goldens.json") === FROZEN_GOLDENS,
    "calc goldens SHA-256 unchanged vs Stage 5 freeze"
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    process.exit(1);
  }
}

main();
