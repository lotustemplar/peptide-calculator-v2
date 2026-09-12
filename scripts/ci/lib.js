"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_ROOT = path.resolve(__dirname, "../..");

const SKIP_DIR_NAMES = new Set([
  ".git",
  "node_modules",
  "data",
  "coverage",
  "dist",
  "build",
  // Generated Capacitor trees. Copied web assets include grandfathered
  // runtime-fixes.js that must not look like a new runtime patch to SR-CI-001.
  "www",
  "android",
  "ios",
]);

function repoRoot() {
  return process.env.FITGEN_CI_ROOT || DEFAULT_ROOT;
}

function allowlistDir() {
  return process.env.FITGEN_CI_ALLOWLIST_DIR || path.join(__dirname, "allowlists");
}

function toPosix(relPath) {
  return relPath.split(path.sep).join("/");
}

function walkFiles(rootDir, options = {}) {
  const extensions = options.extensions || null;
  const skipDirs = options.skipDirs || SKIP_DIR_NAMES;
  const results = [];

  function visit(absDir) {
    let entries;
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch (error) {
      throw new Error(`Unable to read directory ${absDir}: ${error.message}`, {
        cause: error,
      });
    }

    for (const entry of entries) {
      const abs = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) {
          continue;
        }
        visit(abs);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (extensions) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!extensions.has(ext)) {
          continue;
        }
      }
      results.push(abs);
    }
  }

  visit(rootDir);
  return results.sort();
}

function readText(absPath) {
  return fs.readFileSync(absPath, "utf8");
}

function relPosix(rootDir, absPath) {
  return toPosix(path.relative(rootDir, absPath));
}

function fail(message, details) {
  console.error(message);
  if (Array.isArray(details) && details.length) {
    for (const line of details) {
      console.error(`  ${line}`);
    }
  }
  process.exit(1);
}

module.exports = {
  DEFAULT_ROOT,
  SKIP_DIR_NAMES,
  allowlistDir,
  fail,
  readText,
  relPosix,
  repoRoot,
  toPosix,
  walkFiles,
};
