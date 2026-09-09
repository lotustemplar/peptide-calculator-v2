#!/usr/bin/env node
"use strict";

/**
 * Stage 5 / Issue #32 — Load must not present a stale calculator dose
 * for name-only / Unknown rows (Codex review on PR #33 / 6cdb644).
 *
 * Behavioral DOM regression: seed a prior calculator dose, attempt Load
 * on a name-only row, prove fields and navigation stay put.
 */

const path = require("path");
const { repoRoot, readText } = require("../ci/lib");
const { compileUxModules } = require("./harness");
const { emitBrowserBundle } = require("./emit-browser");

const { ux } = compileUxModules();
emitBrowserBundle();

const bind = readText(path.join(repoRoot(), "p0-ux-bind.js"));

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${message}`);
}

function assertEqual(actual, expected, message) {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  assert(left === right, `${message} (actual=${left} expected=${right})`);
}

function createCalculatorDom(prior) {
  const fields = {
    "dose-unit": { id: "dose-unit", value: prior.doseUnit },
    "dose-mg": { id: "dose-mg", value: prior.doseAmount },
  };
  let activeView = "cabinet-view";
  let calculatorRendered = false;
  return {
    getElementById(id) {
      return fields[id] || null;
    },
    renderCalculator() {
      calculatorRendered = true;
    },
    setActiveView(viewId) {
      activeView = viewId;
    },
    snapshot() {
      return {
        doseUnit: fields["dose-unit"].value,
        doseAmount: fields["dose-mg"].value,
        activeView,
        calculatorRendered,
      };
    },
  };
}

/** Codex-cited 6cdb644 bind path: assign only when present, always navigate + render. */
function legacyLoadMedication(med, dom) {
  const unit = ux.optionalUnitLabel(med.unit);
  const dose = ux.optionalPositiveNumber(med.dose);
  const unitEl = dom.getElementById("dose-unit");
  const doseEl = dom.getElementById("dose-mg");
  if (unit && unitEl) {
    unitEl.value = unit;
  }
  if (dose !== null && doseEl) {
    doseEl.value = String(dose);
  }
  dom.renderCalculator();
  dom.setActiveView("calculator-view");
}

/** Production bind contract after the Load gate. */
function gatedLoadMedication(med, dom) {
  const unitEl = dom.getElementById("dose-unit");
  const doseEl = dom.getElementById("dose-mg");
  const result = ux.loadMedicationIntoCalculator(med, {
    doseUnit: unitEl ? String(unitEl.value || "") : "",
    doseAmount: doseEl ? String(doseEl.value || "") : "",
  });
  if (!result.applied) {
    return result;
  }
  if (unitEl) {
    unitEl.value = result.next.doseUnit;
  }
  if (doseEl) {
    doseEl.value = result.next.doseAmount;
  }
  dom.renderCalculator();
  dom.setActiveView("calculator-view");
  return result;
}

function actionMarkup(med) {
  if (ux.canLoadMedication(med)) {
    return `<button type="button" data-action="load-med" data-id="${med.id}">Load</button>`;
  }
  return `<span class="med-load-unavailable" role="status">${ux.MED_LOAD_UNAVAILABLE}</span>`;
}

console.log("Stage 5 Load gate — no stale calculator dose for name-only / Unknown");

const nameOnly = ux.buildMedicationRecord({ id: "syn-name-only", name: "Demo Vial A" });
const unknown = ux.buildMedicationRecord({ id: "syn-unknown", name: "" });
const legacyComplete = ux.buildMedicationRecord({
  id: "syn-legacy",
  name: "Demo Vial A",
  dose: 2,
  unit: "mg",
});
const doseWithoutUnit = { id: "syn-partial", name: "Demo Vial A", dose: 2 };
const unitWithoutDose = { id: "syn-unit-only", name: "Demo Vial A", unit: "mg" };

assertEqual(ux.canLoadMedication(nameOnly), false, "name-only row is not loadable");
assertEqual(ux.canLoadMedication(unknown), false, "Unknown row is not loadable");
assertEqual(ux.canLoadMedication(doseWithoutUnit), false, "dose without unit is not a complete payload");
assertEqual(ux.canLoadMedication(unitWithoutDose), false, "unit without dose is not a complete payload");
assertEqual(ux.canLoadMedication(legacyComplete), true, "legacy row with stored dose+unit remains loadable");

const prior = { doseUnit: "mg", doseAmount: "3" };

const legacyDom = createCalculatorDom(prior);
legacyLoadMedication(unknown, legacyDom);
assertEqual(legacyDom.snapshot().doseAmount, "3", "legacy path leaves the prior dose in the field");
assertEqual(legacyDom.snapshot().activeView, "calculator-view", "legacy path still navigates (the Codex bug)");
assertEqual(legacyDom.snapshot().calculatorRendered, true, "legacy path still recalculates (the Codex bug)");

const unknownDom = createCalculatorDom(prior);
const unknownResult = gatedLoadMedication(unknown, unknownDom);
assertEqual(unknownResult.applied, false, "gated Load does not apply an Unknown row");
assertEqual(unknownDom.snapshot().doseAmount, "3", "Unknown Load cannot present the prior dose as loaded");
assertEqual(unknownDom.snapshot().doseUnit, "mg", "Unknown Load cannot present the prior unit as loaded");
assertEqual(unknownDom.snapshot().activeView, "cabinet-view", "Unknown Load does not navigate to the calculator");
assertEqual(unknownDom.snapshot().calculatorRendered, false, "Unknown Load does not recalculate");

const nameOnlyDom = createCalculatorDom(prior);
const nameOnlyResult = gatedLoadMedication(nameOnly, nameOnlyDom);
assertEqual(nameOnlyResult.applied, false, "gated Load does not apply a name-only row");
assertEqual(nameOnlyDom.snapshot().doseAmount, "3", "name-only Load cannot present the prior dose as loaded");
assertEqual(nameOnlyDom.snapshot().activeView, "cabinet-view", "name-only Load does not navigate to the calculator");
assertEqual(nameOnlyDom.snapshot().calculatorRendered, false, "name-only Load does not recalculate");

const clickHtml = actionMarkup(unknown) + actionMarkup(nameOnly);
assert(!/data-action="load-med"/.test(clickHtml), "name-only/Unknown rows omit the Load control so it cannot be clicked");
assert(/role="status"/.test(actionMarkup(unknown)), "unavailable Load has an accessible status");
assertEqual(actionMarkup(unknown).includes(ux.MED_LOAD_UNAVAILABLE), true, "unavailable copy is No saved dose");

const legacyDomOk = createCalculatorDom(prior);
const legacyResult = gatedLoadMedication(legacyComplete, legacyDomOk);
assertEqual(legacyResult.applied, true, "legacy complete row still loads");
assertEqual(legacyDomOk.snapshot().doseAmount, "2", "legacy Load writes the stored user dose");
assertEqual(legacyDomOk.snapshot().doseUnit, "mg", "legacy Load writes the stored user unit");
assertEqual(legacyDomOk.snapshot().activeView, "calculator-view", "legacy Load may navigate");
assert(/data-action="load-med"/.test(actionMarkup(legacyComplete)), "legacy complete row still shows Load");

assert(/canLoadMedication/.test(bind), "bind consults canLoadMedication before rendering Load");
assert(/loadMedicationIntoCalculator/.test(bind), "bind applies Load through loadMedicationIntoCalculator");
assert(/!result\.applied/.test(bind), "bind returns before navigate/render when Load is not applied");
assert(/MED_LOAD_UNAVAILABLE/.test(bind), "bind renders the no-saved-dose status");
assert(/loadMedication,/.test(bind), "bind exposes loadMedication for the regression surface");

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
