#!/usr/bin/env node
"use strict";

/**
 * Copy only the current-main static web assets into www/ for Capacitor.
 * Rebuild this list from index.html / Stage 2 icons — do not restore
 * retired runtime *-fix.js patches or stale pre-recovery assets.
 * Does not rewrite calculator, reminder, or UI files.
 */
const fs = require("fs");
const path = require("path");

const DEFAULT_ROOT = path.resolve(__dirname, "../..");

const FILES = [
  "index.html",
  "styles.css",
  "app.js",
  "config.js",
  "config.example.js",
  "peptide-list.js",
  "src/ux/p0-ux.browser.js",
  "p0-ux-bind.js",
  "runtime-fixes.js",
  "manifest.webmanifest",
  "icon.svg",
  "icon.png",
  "icon-192.png",
  "icon-512.png",
];

const DIRECTORIES = ["assets"];

const RETIRED_RUNTIME_PATCHES = [
  "export-fix.js",
  "mobile-polish-fix.js",
  "ui-polish-fix.js",
  "native-backup-fix.js",
  "notification-fix.js",
  "native-reminder-fix.js",
];

function repoRoot() {
  return process.env.FITGEN_ANDROID_ROOT || DEFAULT_ROOT;
}

function copyFile(root, rel) {
  const from = path.join(root, rel);
  const to = path.join(root, "www", rel);
  if (!fs.existsSync(from) || !fs.statSync(from).isFile()) {
    throw new Error(`Missing required web asset: ${rel}`);
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyDir(root, rel) {
  const from = path.join(root, rel);
  const to = path.join(root, "www", rel);
  if (!fs.existsSync(from)) {
    return;
  }
  fs.cpSync(from, to, { recursive: true });
}

function prepareWww(root = repoRoot()) {
  const www = path.join(root, "www");
  fs.rmSync(www, { recursive: true, force: true });
  fs.mkdirSync(www, { recursive: true });
  for (const rel of FILES) {
    copyFile(root, rel);
  }
  for (const rel of DIRECTORIES) {
    copyDir(root, rel);
  }
  return { www, files: FILES.slice(), directories: DIRECTORIES.slice() };
}

function main() {
  const result = prepareWww();
  console.log(`Prepared ${path.relative(repoRoot(), result.www) || "www"} with ${result.files.length} files.`);
}

if (require.main === module) {
  main();
}

module.exports = {
  DEFAULT_ROOT,
  DIRECTORIES,
  FILES,
  RETIRED_RUNTIME_PATCHES,
  main,
  prepareWww,
  repoRoot,
};
