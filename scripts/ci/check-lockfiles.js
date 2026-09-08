"use strict";

const fs = require("fs");
const path = require("path");
const { fail, repoRoot } = require("./lib");

const REQUIRED = [
  "package-lock.json",
  "backend/package-lock.json",
];

function main() {
  const root = repoRoot();
  const missing = [];
  const present = [];

  for (const rel of REQUIRED) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      missing.push(rel);
      continue;
    }
    present.push(rel);
  }

  if (missing.length) {
    fail("SR-CI-001: required lockfiles are missing.", missing.map((rel) => `missing ${rel}`));
  }

  console.log("Lockfiles present:");
  for (const rel of present) {
    console.log(`  ${rel}`);
  }
}

main();
