#!/usr/bin/env node
"use strict";

/**
 * Stage 5 / Issue #32 — med name CRUD, unknown-state, local autocomplete.
 * Does not execute calculator math or suggest doses.
 */

const fs = require("fs");
const path = require("path");
const { repoRoot, readText } = require("../ci/lib");
const { compileUxModules } = require("./harness");
const { BUNDLE_REL, emitBrowserBundle } = require("./emit-browser");

const { ux } = compileUxModules();

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

function memoryStorage(initial) {
  const data = { ...initial };
  return {
    data,
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    },
  };
}

emitBrowserBundle();
const generated = fs.readFileSync(path.join(repoRoot(), BUNDLE_REL), "utf8");
const bind = readText(path.join(repoRoot(), "p0-ux-bind.js"));
const html = readText(path.join(repoRoot(), "index.html"));

console.log("Stage 5 med names + unknown-state + local autocomplete");

assertEqual(ux.classifyMedName("").nameState, "unknown", "empty name is unknown");
assertEqual(ux.classifyMedName("   ").nameState, "unknown", "whitespace name is unknown");
assertEqual(ux.classifyMedName("unknown").nameState, "unknown", "lowercase unknown is unknown");
assertEqual(ux.classifyMedName("Unknown").displayName, "Unknown", "Unknown display is preserved");
assertEqual(ux.classifyMedName("  Demo   Vial A ").displayName, "Demo Vial A", "internal whitespace collapses");
assertEqual(ux.classifyMedName("  Demo   Vial A ").nameState, "known", "typed name is known");
assertEqual(ux.nameMatchKey("Demo Vial A"), "demo vial a", "match key is case-folded");

const unknownRow = ux.buildMedicationRecord({ id: "syn-1", name: "" });
assertEqual(unknownRow.name, "Unknown", "name-only save with empty input stores Unknown");
assertEqual(unknownRow.nameState, "unknown", "name-only save marks unknown state");
assert(!Object.prototype.hasOwnProperty.call(unknownRow, "dose"), "name-only save does not invent dose");
assert(!Object.prototype.hasOwnProperty.call(unknownRow, "interval"), "name-only save does not invent interval 7");

const known = ux.buildMedicationRecord({
  id: "syn-2",
  name: " Demo Vial A ",
  existing: { id: "syn-2", name: "Old", dose: 2, unit: "mg", interval: 5, extra: "keep" },
});
assertEqual(known.name, "Demo Vial A", "edit normalizes display name");
assertEqual(known.dose, 2, "edit preserves stored dose");
assertEqual(known.interval, 5, "edit preserves stored interval");
assertEqual(known.extra, "keep", "unknown/passthrough fields stay on the row");

const hydratedUnknown = ux.medicationFromUnknown({ id: "syn-3", name: "unknown" });
assertEqual(hydratedUnknown.nameState, "unknown", "legacy unknown name becomes nameState unknown");
assertEqual(hydratedUnknown.name, "Unknown", "legacy unknown name displays Unknown");

assertEqual(
  ux.formatMedicationMeta({}),
  "Dose unknown · interval unknown",
  "missing dose/interval render as unknown"
);
assertEqual(
  ux.formatMedicationMeta({ dose: 2, unit: "mg", interval: 5 }),
  "2 mg · every 5 days",
  "stored user dose/interval are labels, not suggestions"
);

const recent = ux.recentUserNames(
  [
    { id: "a", name: "Unknown", nameState: "unknown" },
    { id: "b", name: "Demo Vial A" },
    { id: "c", name: "demo vial a" },
  ],
  [{ savedId: "f1", name: "Cabinet Fill B" }]
);
assertEqual(recent, ["demo vial a", "Cabinet Fill B"], "recent names are unique, newest casing first, unknown excluded");

assertEqual(ux.matchNameSuggestions("", ["Demo Vial A"]), [], "empty query does not autocomplete");
assertEqual(ux.matchNameSuggestions("unknown", ["Demo Vial A"]), [], "unknown query does not map onto a catalog name");
assertEqual(ux.matchNameSuggestions("demo", ["Demo Vial A", "Other"]), ["Demo Vial A"], "typed query matches recent-user only");
assertEqual(ux.matchNameSuggestions("zzz", ["Demo Vial A"]), [], "no match yields empty suggestions");

const chips = ux.stage5NameChips(["Demo Vial A"]);
assert(
  chips.every((chip) => chip.selected === false && chip.defaultSelection === "none"),
  "name chips never preselect"
);
assert(
  chips.every((chip) => chip.class === "safe-MED-FLAG"),
  "rendered name chips are safe-MED-FLAG only"
);
assertEqual(
  chips.map((chip) => chip.copy),
  ["Custom", "Unknown", "Demo Vial A"],
  "shipped chip copy is Custom, Unknown, then recent-user"
);
assert(
  chips.every((chip) => !ux.forbiddenChipFraming(chip.copy)),
  "shipped chip copy has no forbidden MED-FLAG framing"
);

const storage = memoryStorage({});
ux.hydrateLegacyMirrors(storage);
const added = ux.buildMedicationRecord({ id: "syn-live", name: "Demo Vial A" });
ux.writeMedicationsFromUi(storage, [added]);
const envelope = JSON.parse(storage.getItem(ux.ENVELOPE_STORAGE_KEY));
assert(
  envelope.medications.some((row) => row.id === "syn-live" && row.name === "Demo Vial A"),
  "live name add writes the Stage 3 envelope"
);
assertEqual(
  JSON.parse(storage.getItem(ux.MEDICATIONS_STORAGE_KEY))[0].id,
  "syn-live",
  "live name add mirrors after the envelope"
);
const unknownAdd = ux.buildMedicationRecord({ id: "syn-unk", name: "  " });
ux.writeMedicationsFromUi(storage, [added, unknownAdd]);
const afterUnknown = ux.readMedications(storage);
assert(
  afterUnknown.some((row) => row.id === "syn-unk" && row.nameState === "unknown"),
  "unknown name remains first-class in the envelope"
);

const removed = ux.removeMedication(afterUnknown, "syn-live");
ux.writeMedicationsFromUi(storage, removed);
assertEqual(
  ux.readMedications(storage).some((row) => row.id === "syn-live"),
  false,
  "remove name deletes from the envelope"
);

assert(generated.includes("writeMedicationsFromUi"), "browser bundle exports writeMedicationsFromUi");
assert(generated.includes("stage5NameChips"), "browser bundle exports stage5NameChips");
assert(generated.includes("classifyMedName"), "browser bundle exports classifyMedName");
assert(/writeMedicationsFromUi/.test(bind), "bind writes medications through writeMedicationsFromUi");
assert(/handleMedFormSubmit/.test(bind), "bind intercepts the medications form");
assert(/revealMedicationsCard/.test(bind), "bind reveals the medications card hidden by ui-polish-fix");
assert(/data-action="edit-med"/.test(bind), "bind renders edit-name control");
assert(/canLoadMedication/.test(bind), "bind gates Load on a complete stored dose+unit");
assert(/MED_LOAD_UNAVAILABLE/.test(bind), "bind omits Load when no saved dose exists");
assert(/aria-pressed", "false"/.test(bind) || /aria-pressed", "false"/.test(bind), "bind never presses a chip");
assert(/autocompleteIndex = -1/.test(bind), "autocomplete starts with no highlighted option");
assert(!/PEPTIDE_LIST/.test(bind), "bind does not read the static PEPTIDE_LIST catalog");
assert(/id="med-name-chips"/.test(html), "med name chip host exists");
assert(/id="save-fill-name-chips"/.test(html), "save-fill name chip host exists");
assert(/type="hidden"/.test(html) && /id="med-dose"/.test(html), "med dose is not a visible suggestion field");
assert(!/value="7"/.test(html.match(/id="med-interval"[\s\S]{0,80}/)?.[0] || ""), "med interval is not prefilled with 7");
assert(!/fill-name-suggestions-fix\.js/.test(html), "dormant static-suggestion patch is not loaded");

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
