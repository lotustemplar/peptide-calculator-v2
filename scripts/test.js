#!/usr/bin/env node
"use strict";

/**
 * Minimal test-runner invoked by CI (SR-CI-001).
 * P0.0 wires the harness. Calculator goldens / FR-CALC-010 land in P0.1.
 */
const { spawnSync } = require("child_process");
const path = require("path");

const selftest = path.join(__dirname, "ci", "gate-selftest.js");
console.log("Running P0.0 CI gate self-tests via scripts/test.js");

const result = spawnSync(process.execPath, [selftest], {
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
