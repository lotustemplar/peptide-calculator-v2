"use strict";

const path = require("path");
const { allowlistDir, fail, readText } = require("./lib");
const { readBaseFile } = require("./base-ref");

function parsePathAllowlist(text) {
  return new Set(
    String(text)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
  );
}

function normalizeContext(text) {
  return String(text).replace(/\r\n|\r/g, "\n").trim();
}

function copyEntryKey(entry) {
  return `${entry.file}\n${entry.patternId}\n${normalizeContext(entry.context)}`;
}

function parseCopyAllowlist(text) {
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.entries)) {
    throw new Error("forbidden-copy allowlist must contain an entries array");
  }
  return new Set(parsed.entries.map(copyEntryKey));
}

function assertPathAllowlistNotBroadened(relFromRepo) {
  const headPath = path.join(allowlistDir(), path.basename(relFromRepo));
  const headText = readText(headPath);
  const baseRel = path.posix.join("scripts/ci/allowlists", path.basename(relFromRepo));
  const baseText = readBaseFile(baseRel);

  if (baseText === null) {
    console.log(`${path.basename(relFromRepo)}: not on CI base (introduction); freeze skipped.`);
    return parsePathAllowlist(headText);
  }

  const head = parsePathAllowlist(headText);
  const base = parsePathAllowlist(baseText);
  const added = [...head].filter((entry) => !base.has(entry)).sort();
  if (added.length) {
    fail(
      `SR-CI-001: ${path.basename(relFromRepo)} gained new exceptions versus the PR base. Removals are allowed; additions are not.`,
      added.map((entry) => `added ${entry}`)
    );
  }
  console.log(`${path.basename(relFromRepo)}: no new exceptions versus CI base.`);
  return head;
}

function assertCopyAllowlistNotBroadened() {
  const headPath = path.join(allowlistDir(), "forbidden-copy.json");
  const headText = readText(headPath);
  const baseText = readBaseFile("scripts/ci/allowlists/forbidden-copy.json");

  if (baseText === null) {
    console.log("forbidden-copy.json: not on CI base (introduction); freeze skipped.");
    return;
  }

  const head = parseCopyAllowlist(headText);
  const base = parseCopyAllowlist(baseText);
  const added = [...head].filter((entry) => !base.has(entry)).sort();
  if (added.length) {
    fail(
      "SR-CI-002: forbidden-copy allowlist gained new or broadened exceptions versus the PR base. Removals are allowed; additions are not.",
      added.map((entry) => `added ${entry.replace(/\n/g, " | ")}`)
    );
  }
  console.log("forbidden-copy.json: no new exceptions versus CI base.");
}

module.exports = {
  assertCopyAllowlistNotBroadened,
  assertPathAllowlistNotBroadened,
  copyEntryKey,
  normalizeContext,
  parseCopyAllowlist,
  parsePathAllowlist,
};
