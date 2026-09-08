"use strict";

/**
 * P0.1 dual-path calculator tests (Issue #5).
 *
 * FR-CALC-001 — lock both live calculator paths as legacy-evidence snapshots.
 * FR-CALC-010 — reject invalid / impossible domains; no success options list.
 *
 * These tests are not target correctness oracles and do not pick DEC-FORMULA.
 * Production calculator math is loaded from app.js and runtime-fixes.js.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  APP_JS,
  RUNTIME_FIXES_JS,
  loadAppWaterStepPath,
  loadRuntimeDrawTargetPath,
  readProductionSource,
} = require("./harness");

const FIXTURE_DIR = path.join(__dirname, "fixtures");
const MATRIX_PATH = path.join(FIXTURE_DIR, "legacy-evidence-matrix.json");
const DOMAIN_PATH = path.join(FIXTURE_DIR, "fr-calc-010-domain.json");
const GOLDENS_PATH = path.join(FIXTURE_DIR, "legacy-evidence-goldens.json");

const UPDATE_GOLDENS = process.env.FITGEN_UPDATE_CALC_GOLDENS === "1";

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

function readJson(absPath) {
  return JSON.parse(fs.readFileSync(absPath, "utf8"));
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function normalizeOption(option, pathName) {
  const snapshot = {
    vialAmount: option.vialAmount,
    doseAmount: option.doseAmount,
    syringeMax: option.syringeMax,
    maxWaterMl: option.maxWaterMl,
    waterMl: option.waterMl,
    doseMl: option.doseMl,
    concentrationPerMl: option.concentrationPerMl,
    unitLabel: option.unitLabel,
    score: option.score,
    guidance: option.guidance,
  };
  if (pathName === "app-js-water-step") {
    snapshot.insulinUnits = option.insulinUnits;
  }
  if (pathName === "runtime-fixes-draw-target") {
    snapshot.isPrecisionFallback = Boolean(option.isPrecisionFallback);
    snapshot.kind = String(option.id || "").endsWith("-precision") ? "precision" : "clean";
  }
  return snapshot;
}

function normalizeResult(result) {
  return {
    path: result.path,
    label: result.label,
    minDrawMl: result.minDrawMl,
    mode: result.mode || null,
    error: result.error,
    emptyState: Boolean(result.emptyState),
    hasSuccessOptionsList: Boolean(result.hasSuccessOptionsList),
    options: (result.options || []).map((option) => normalizeOption(option, result.path)),
  };
}

function decodeInputs(inputs) {
  const decoded = { ...inputs };
  for (const [key, value] of Object.entries(decoded)) {
    if (value === "NaN") {
      decoded[key] = NaN;
    } else if (value === "Infinity") {
      decoded[key] = Infinity;
    } else if (value === "-Infinity") {
      decoded[key] = -Infinity;
    }
  }
  return decoded;
}

function loadPaths() {
  return {
    "app-js-water-step": loadAppWaterStepPath(),
    "runtime-fixes-draw-target": loadRuntimeDrawTargetPath(),
  };
}

function captureGoldens(paths, matrix) {
  const appSource = readProductionSource(APP_JS);
  const runtimeSource = readProductionSource(RUNTIME_FIXES_JS);
  const cases = {};

  for (const fixture of matrix.cases) {
    cases[fixture.id] = {};
    for (const [pathName, loaded] of Object.entries(paths)) {
      cases[fixture.id][pathName] = normalizeResult(loaded.run(fixture.inputs));
    }
  }

  return {
    label: "legacy-evidence",
    requirement: "FR-CALC-001",
    notATargetOracle: true,
    notes: [
      "Captured from live app.js water-step and runtime-fixes.js draw-target paths.",
      "These numbers are legacy-evidence snapshots only, not a correctness oracle.",
      "Regenerate only with FITGEN_UPDATE_CALC_GOLDENS=1 after an intentional evidence recapture.",
    ],
    capturedFrom: {
      "app.jsSha256": sha256(appSource),
      "runtime-fixes.jsSha256": sha256(runtimeSource),
    },
    cases,
  };
}

function testHarnessLoadsLiveFiles(paths) {
  console.log("legacy-evidence harness");
  assert(paths["app-js-water-step"].sourceFile === APP_JS, "legacy-evidence water-step path loads live app.js");
  assert(
    paths["runtime-fixes-draw-target"].sourceFile === RUNTIME_FIXES_JS,
    "legacy-evidence draw-target path loads live runtime-fixes.js"
  );
  assert(paths["app-js-water-step"].label === "legacy-evidence", "water-step loader is labeled legacy-evidence");
  assert(paths["runtime-fixes-draw-target"].label === "legacy-evidence", "draw-target loader is labeled legacy-evidence");
}

function testGoldens(paths, matrix, goldens) {
  console.log("FR-CALC-001 legacy-evidence goldens");
  assert(goldens.label === "legacy-evidence", "golden file is labeled legacy-evidence");
  assert(goldens.notATargetOracle === true, "golden file declares it is not a target oracle");
  assert(Array.isArray(matrix.cases) && matrix.cases.length > 0, "legacy-evidence fixture matrix is non-empty");

  const unitLabels = new Set(matrix.cases.map((item) => item.inputs.unitLabel));
  assert(unitLabels.has("mg") && unitLabels.has("IU"), "legacy-evidence matrix covers mg and IU labels");

  const syringeValues = new Set(matrix.cases.map((item) => item.inputs.syringeMax));
  const waterValues = new Set(matrix.cases.map((item) => item.inputs.maxWaterMl));
  assert(syringeValues.size > 1, "legacy-evidence matrix covers more than one syringe capacity");
  assert(waterValues.size > 1, "legacy-evidence matrix covers more than one water ceiling");

  const split = goldens.cases["syringe-below-app-min-draw-mg-30-3-0.04-3"];
  assert(
    Boolean(split) &&
      split["app-js-water-step"].options.length === 0 &&
      split["runtime-fixes-draw-target"].options.length > 0,
    "legacy-evidence records the current min-draw 0.05 vs 0.10 path split"
  );

  for (const fixture of matrix.cases) {
    assert(String(fixture.label).includes("legacy-evidence"), `matrix case ${fixture.id} is labeled legacy-evidence`);
    const expectedCase = goldens.cases[fixture.id];
    assert(Boolean(expectedCase), `legacy-evidence golden exists for ${fixture.id}`);
    if (!expectedCase) {
      continue;
    }

    for (const pathName of Object.keys(paths)) {
      const actual = normalizeResult(paths[pathName].run(fixture.inputs));
      const expected = expectedCase[pathName];
      assert(Boolean(expected), `legacy-evidence golden exists for ${fixture.id} ${pathName}`);
      if (!expected) {
        continue;
      }
      const same = stableStringify(actual) === stableStringify(expected);
      assert(same, `legacy-evidence ${pathName} snapshot matches for ${fixture.id}`);
      if (!same) {
        console.error(`         expected options: ${expected.options.length}`);
        console.error(`         actual options:   ${actual.options.length}`);
      }
    }
  }
}

function testDomainFixtures(paths, domain) {
  console.log("FR-CALC-010 domain fixtures");
  assert(domain.label === "legacy-evidence", "domain fixture file is labeled legacy-evidence");

  const reasons = new Set(domain.cases.map((item) => item.reason));
  assert(reasons.has("non-finite-or-non-positive"), "domain fixtures cover NaN/Infinity/<=0");
  assert(reasons.has("dose-exceeds-vial"), "domain fixtures cover dose > vial");
  assert(reasons.has("impossible-config"), "domain fixtures cover impossible configs");

  const fields = new Set(
    domain.cases.filter((item) => item.reason === "non-finite-or-non-positive").map((item) => item.field)
  );
  assert(fields.has("vialAmount"), "domain fixtures reject invalid vial amount");
  assert(fields.has("doseAmount"), "domain fixtures reject invalid desired dose when provided");
  assert(fields.has("maxWaterMl"), "domain fixtures reject invalid water ceilings");
  assert(fields.has("syringeMax"), "domain fixtures reject invalid syringe capacity");

  for (const fixture of domain.cases) {
    assert(String(fixture.label).includes("legacy-evidence"), `domain case ${fixture.id} is labeled legacy-evidence`);
    const inputs = decodeInputs(fixture.inputs);

    for (const [pathName, loaded] of Object.entries(paths)) {
      const result = loaded.run(inputs);
      const name = `legacy-evidence FR-CALC-010 ${pathName} ${fixture.id}`;
      assert(Array.isArray(result.options) && result.options.length === 0, `${name} generates no options`);
      assert(result.hasSuccessOptionsList === false, `${name} does not show a success options list`);
      assert(result.emptyState === true || Boolean(result.error), `${name} uses inline error / empty-state`);

      if (fixture.reason === "dose-exceeds-vial") {
        const text = `${result.error || ""}`.toLowerCase();
        assert(text.includes("larger than the total amount"), `${name} rejects dose > vial in the shared unit`);
      }
    }
  }
}

function testNoTherapeuticOracles(matrix, domain, goldens) {
  console.log("legacy-evidence oracle boundary");
  const payload = {
    matrixCases: matrix.cases.map((item) => ({ id: item.id, inputs: item.inputs })),
    domainCases: domain.cases.map((item) => ({ id: item.id, inputs: item.inputs, reason: item.reason })),
    goldenOptions: goldens.cases,
  };
  const blob = stableStringify(payload).toLowerCase();
  assert(!/therapeutic/.test(blob), "captured cases do not encode therapeutic-dose oracles");
  assert(!/dose-advice/.test(blob) && !/\btarget dose\b/.test(blob), "captured cases do not encode a dose-advice oracle");
  assert(!/\bwinner\b/.test(blob), "captured cases do not embed a formula winner");
}

function main() {
  console.log("P0.1 calculator legacy-evidence + FR-CALC-010 (both live paths).\n");

  const matrix = readJson(MATRIX_PATH);
  const domain = readJson(DOMAIN_PATH);
  const paths = loadPaths();

  testHarnessLoadsLiveFiles(paths);

  let goldens;
  if (UPDATE_GOLDENS) {
    goldens = captureGoldens(paths, matrix);
    fs.writeFileSync(GOLDENS_PATH, stableStringify(goldens));
    console.log(`Wrote ${path.relative(process.cwd(), GOLDENS_PATH)}`);
  } else {
    goldens = readJson(GOLDENS_PATH);
  }

  testGoldens(paths, matrix, goldens);
  testDomainFixtures(paths, domain);
  testNoTherapeuticOracles(matrix, domain, goldens);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    process.exitCode = 1;
  }
}

main();
