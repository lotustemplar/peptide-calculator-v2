#!/usr/bin/env node
"use strict";

/**
 * CI test-runner (SR-CI-001).
 * P0.0: gate self-tests.
 * P0.1: dual-path calculator legacy-evidence goldens + FR-CALC-010 domain fixtures.
 * P0.6: MED-FLAG measurement/planner copy replacements on loaded surfaces.
 * P0.OCC: FR-SCH-000 occurrence identity + atomic Taken/Undo writer.
 * Stage 2: chrome/assets allowlist checks (Issue #26).
 * Stage 3: persist import safety for both data generations (Issue #28).
 * Stage 4: shell/IA + existing P0 Back/Cancel/Taken/Undo chrome (Issue #30).
 * Stage 5: med names + classified non-therapeutic chips (Issue #32).
 * Stage 6a: unused orphan *-fix.js retirement (Issue #34).
 * Stage 6b.1: retire superseded export-fix.js; Stage 3 export path owns #export-data.
 * Stage 6b.2: absorb mobile-polish-fix.js into src/ux + bind (edit-fill + suggestion typing).
 * Stage 6b.3: absorb ui-polish-fix.js accordion + duplicate banner; no reminder stubs.
 * Stage 6b.4: retire superseded native-backup-fix.js; Stage 3 export path owns #export-data.
 * Stage 6c-B1: absorb runtime-fixes.js injectFallbackStyles into styles.css.
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
  {
    name: "Stage 3 persist import safety (both generations)",
    file: path.join(__dirname, "persist", "persist-test.js"),
  },
  {
    name: "Stage 4 shell/IA + P0 chrome wiring",
    file: path.join(__dirname, "ci", "stage4-shell-test.js"),
  },
  {
    name: "Stage 4 tab aria-current restore/click/programmatic",
    file: path.join(__dirname, "ux", "stage4-tab-aria-test.js"),
  },
  {
    name: "Stage 5 med names + unknown-state + local autocomplete",
    file: path.join(__dirname, "ux", "stage5-meds-test.js"),
  },
  {
    name: "Stage 5 Load gate — no stale calculator dose",
    file: path.join(__dirname, "ux", "stage5-load-test.js"),
  },
  {
    name: "Stage 5 chip inventory + MED-FLAG freeze",
    file: path.join(__dirname, "ci", "stage5-chips-test.js"),
  },
  {
    name: "Stage 6a orphan *-fix.js unused + retired",
    file: path.join(__dirname, "ci", "stage6a-orphan-fix-test.js"),
  },
  {
    name: "Stage 6b.1 export-fix.js retired; Stage 3 export owns #export-data",
    file: path.join(__dirname, "ci", "stage6b1-export-fix-test.js"),
  },
  {
    name: "Stage 6b.2 mobile-polish-fix.js absorbed into src/ + bind",
    file: path.join(__dirname, "ci", "stage6b2-mobile-polish-test.js"),
  },
  {
    name: "Stage 6b.3 ui-polish-fix.js absorbed accordion + banner; no reminder stubs",
    file: path.join(__dirname, "ci", "stage6b3-ui-polish-test.js"),
  },
  {
    name: "Stage 6b.4 native-backup-fix.js retired; Stage 3 export owns #export-data",
    file: path.join(__dirname, "ci", "stage6b4-native-backup-test.js"),
  },
  {
    name: "Stage 6c-B1 RF-B-003 CSS injector absorbed into styles.css",
    file: path.join(__dirname, "ci", "stage6c-b1-css-test.js"),
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
