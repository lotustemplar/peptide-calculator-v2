#!/usr/bin/env node
"use strict";

/**
 * CI test-runner (SR-CI-001).
 * P0.0: gate self-tests.
 * P0.1: dual-path calculator legacy-evidence goldens + FR-CALC-010 domain fixtures.
 * P0.6: MED-FLAG measurement/planner copy replacements on loaded surfaces.
 * P0.OCC: FR-SCH-000 occurrence identity + atomic Taken/Undo writer.
 * Stage 2: chrome/assets allowlist checks (Issue #26).
 */
const { spawnSync } = require("child_process");
const path = require("path");

const jobs = [
  { name: "P0.0 CI gate self-tests", file: path.join(__dirname, "ci", "gate-selftest.js") },
  {
    name: "P0.1 calculator legacy-evidence + FR-CALC-010",
    file: path.join(__dirname, "calc", "legacy-evidence-test.js"),
  },
  {
    name: "P0.6 MED-FLAG copy replacements",
    file: path.join(__dirname, "ci", "med-flag-copy-test.js"),
  },
  {
    name: "P0.OCC FR-SCH-000 occurrence identity + atomic writer",
    file: path.join(__dirname, "occ", "occurrence-test.js"),
  },
  {
    name: "P0.UX wizard/cabinet confirms + Taken/Undo adapter",
    file: path.join(__dirname, "ux", "ux-test.js"),
  },
  {
    name: "Stage 2 chrome/assets allowlist checks",
    file: path.join(__dirname, "ci", "stage2-chrome-test.js"),
  },
];

let failed = false;

for (const job of jobs) {
  console.log(`Running ${job.name} via scripts/test.js`);
  const result = spawnSync(process.execPath, [job.file], {
    stdio: "inherit",
  });
  if (result.error) {
    console.error(result.error.message);
    failed = true;
    continue;
  }
  if (result.status !== 0) {
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
