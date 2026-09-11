#!/usr/bin/env node
"use strict";

/**
 * P0.UX tests — wizard, save confirm, cabinet cascade, Taken/Undo adapter, a11y contract.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
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

const TODAY = "2026-09-09";
const LATER = "2026-09-09T15:00:00.000Z";
const TZ = "America/New_York";

function sampleFill(overrides) {
  return {
    savedId: "fill-1",
    name: "User Peptide",
    vialAmount: 30,
    waterMl: 2,
    unitLabel: "mg",
    recommendedDoseAmount: 3,
    depletionRemaining: 30,
    depletionUnit: "mg",
    lifecycle: "active",
    ...overrides,
  };
}

function sampleSchedule(overrides) {
  return {
    id: "sched-1",
    fillSavedId: "fill-1",
    doseAmount: 3,
    unitLabel: "mg",
    takenDates: [],
    ...overrides,
  };
}

function memoryStore(initial) {
  let current = JSON.parse(JSON.stringify(initial));
  return {
    read() {
      return JSON.parse(JSON.stringify(current));
    },
    write(next) {
      current = JSON.parse(JSON.stringify(next));
    },
    raw() {
      return current;
    },
  };
}

function makeAdapter(store, options) {
  return ux.createTakenAdapter({
    readAppState: () => store.read(),
    writeAppState: (next) => {
      if (options?.throwWrite) {
        throw new Error("persist boom");
      }
      store.write(next);
    },
    timeZone: TZ,
    nowIso: () => options?.nowIso || LATER,
  });
}

(function wizardBackAndDirtyCancel() {
  const baseline = ux.characterizedDefaults();
  const typed = {
    ...baseline,
    vialAmount: "40",
    doseAmount: "2.5",
    syringeMax: "0.5",
    maxWaterMl: "2",
    doseUnit: "IU",
  };

  assert(ux.isWizardDirty(typed, baseline) === true, "UX-WIZ-002 dirty when values change");
  assert(ux.isWizardDirty(baseline, baseline) === false, "UX-WIZ-002 clean at characterized values");

  const afterBack = { ...typed };
  assertEqual(afterBack, typed, "UX-WIZ-001 Back preserves every entered value");

  const keepEditing = { ...typed };
  assertEqual(keepEditing, typed, "UX-WIZ-002 Keep editing changes nothing");

  const discarded = ux.discardWizardDraft();
  assertEqual(discarded, baseline, "UX-WIZ-002 Discard restores characterized current values");
  assert(
    !JSON.stringify(discarded).toLowerCase().includes("recommend" + "ed"),
    "Discard values are not labeled as a target dose"
  );
})();

(function wizardValidateNext() {
  const empty = {
    doseUnit: "mg",
    vialAmount: "",
    doseAmount: "0",
    syringeMax: "",
    maxWaterMl: "-1",
  };
  const step1 = ux.validateWizardStep(1, empty);
  assert(step1.ok === false, "UX-WIZ-003 invalid vial blocks Next");
  assertEqual(ux.firstInvalidField(step1), "vialAmount", "UX-WIZ-003 focuses first invalid field");
  assertEqual(step1.errors[0].message, ux.FIELD_NUMBER_ERROR, "UX-SYS-001 inline number error");

  const step2Empty = ux.validateWizardStep(2, { ...empty, vialAmount: "30" });
  assert(step2Empty.ok === false, "UX-WIZ-003 invalid dose blocks Next");

  const step2GtVial = ux.validateWizardStep(2, {
    ...empty,
    vialAmount: "10",
    doseAmount: "12",
  });
  assert(step2GtVial.ok === false, "UX-WIZ-003 dose > vial blocks Next");
  assertEqual(step2GtVial.errors[0].message, ux.FIELD_DOSE_GT_VIAL_ERROR, "dose>vial copy");

  const valid = ux.validateWizardStep(2, {
    doseUnit: "mg",
    vialAmount: "30",
    doseAmount: "3",
    syringeMax: "1",
    maxWaterMl: "3",
  });
  assert(valid.ok === true, "valid step 2 advances");
  assertEqual(valid.errors, [], "valid Next writes no errors");
})();

(function saveConfirmSummary() {
  const invalid = ux.validateSaveSchedule("x", "", "");
  assert(invalid.ok === false, "UX-SAVE-001 invalid schedule does not persist");
  assert(invalid.message === ux.SAVE_SCHEDULE_ERROR, "UX-SYS-001 save error is inline copy");

  const summary = ux.buildSaveSummary({
    name: "User Peptide",
    vialAmount: 30,
    unitLabel: "mg",
    doseAmount: 3,
    waterMl: 2,
    doseMl: 0.2,
    insulinUnits: 20,
    concentrationPerMl: 15,
    intervalDays: 7,
    reminderTime: "09:00",
    startDate: TODAY,
  });
  assertEqual(summary.disclaimer, ux.SAVE_DISCLAIMER, "UX-SAVE-001 approved disclaimer");
  assert(
    summary.rows.some((row) => row.label === "Entered dose" && row.value.includes("3")),
    "summary shows user-entered dose"
  );
  assert(ux.summaryContainsForbiddenFraming(summary) === false, "no forbidden therapeutic framing");
  assert(summary.rows.every((row) => !/recommend/i.test(row.label + row.value)), "no target-dose chips");
})();

(function cabinetCascadeHistory() {
  const fill = sampleFill({ name: "Cabinet Peptide" });
  const schedules = [
    sampleSchedule({ takenDates: ["2026-08-01", "2026-08-08"] }),
    sampleSchedule({ id: "sched-2", takenDates: [] }),
  ];
  const plan = ux.planCabinetCascade(fill, schedules);
  assert(plan.scheduleCount === 2, "UX-CAB-001 names/counts affected schedules");
  assert(plan.historicalTakenCount === 2, "cascade counts historical taken dates");
  assert(
    ux.cabinetDeleteBody(2, 2).includes("Deletes 2 dosage plans"),
    "confirm names cascade count"
  );

  const pendingFuture = {
    id: "occ:sched-1:2026-09-16",
    scheduleId: "sched-1",
    localCivilDate: "2026-09-16",
    timeZone: TZ,
    status: "pending",
    takenAt: null,
    appliedDepletionAmount: null,
    appliedDepletionUnit: null,
    appliedFillId: null,
    updatedAt: LATER,
  };
  const takenPast = {
    id: "occ:sched-1:2026-08-01",
    scheduleId: "sched-1",
    localCivilDate: "2026-08-01",
    timeZone: TZ,
    status: "taken",
    takenAt: "2026-08-01T14:00:00.000Z",
    appliedDepletionAmount: 3,
    appliedDepletionUnit: "mg",
    appliedFillId: "fill-1",
    updatedAt: "2026-08-01T14:00:00.000Z",
  };

  const applied = ux.applyCabinetArchive({
    fills: [fill],
    schedules,
    occurrences: [pendingFuture, takenPast],
    fillId: "fill-1",
    todayKey: TODAY,
  });
  assert(applied.fills[0].lifecycle === "archived", "fill is archived, not hard-deleted");
  assert(
    applied.schedules.every((schedule) => schedule.lifecycle === "archived"),
    "linked schedules archived"
  );
  assertEqual(applied.schedules[0].takenDates, ["2026-08-01", "2026-08-08"], "takenDates retained");
  assert(
    applied.occurrences.some((row) => row.id === takenPast.id),
    "historical taken occurrence retained"
  );
  assert(
    !applied.occurrences.some((row) => row.id === pendingFuture.id),
    "future pending occurrence removed"
  );
  assert(applied.removedPendingCount === 1, "counts removed pending rows");
})();

(function takenUndoAdapter() {
  const store = memoryStore({
    fills: [sampleFill()],
    schedules: [sampleSchedule()],
    occurrences: [],
  });
  const adapter = makeAdapter(store);
  const before = store.read();

  const taken = adapter.markTaken("sched-1", TODAY);
  assert(taken.ok === true && taken.noop === false, "UX-SCH-001 Taken succeeds");
  assert(store.read().occurrences[0].status === "taken", "taken persisted");
  assertEqual(store.read().schedules[0].takenDates, [TODAY], "legacy takenDates mirrored after success");
  assert(store.read().fills[0].depletionRemaining === 27, "fill depletion decremented");
  assert(adapter.canUndo("sched-1", TODAY) === true, "Undo available from persisted snapshot");

  const double = adapter.markTaken("sched-1", TODAY);
  assert(double.ok === true && double.noop === true, "double-tap Taken is no-op");
  assertEqual(store.read().fills[0].depletionRemaining, 27, "double-tap does not decrement again");

  const undone = adapter.undoTaken("sched-1", TODAY);
  assert(undone.ok === true && undone.noop === false, "UX-SCH-004 Undo succeeds");
  assert(store.read().occurrences[0].status === "pending", "occurrence returns to pending");
  assertEqual(store.read().schedules[0].takenDates, [], "takenDates mirror removed after Undo");
  assertEqual(store.read().fills[0].depletionRemaining, 30, "depletion restored from snapshot");

  store.write(before);
  const failStore = memoryStore(before);
  const failing = makeAdapter(failStore, { throwWrite: true });
  const failedTaken = failing.markTaken("sched-1", TODAY);
  assert(failedTaken.ok === false && failedTaken.code === "PERSIST_FAILED", "Taken persist failure");
  assertEqual(failStore.read(), before, "failure keeps prior persisted state");

  const mismatchStore = memoryStore({
    fills: [sampleFill({ unitLabel: "mg", depletionUnit: "IU" })],
    schedules: [sampleSchedule()],
    occurrences: [],
  });
  const mismatch = makeAdapter(mismatchStore).markTaken("sched-1", TODAY);
  assert(mismatch.ok === false && mismatch.code === "UNIT_MISMATCH", "wrong-unit fail-closed");
  assertEqual(mismatchStore.read().occurrences, [], "unit mismatch writes nothing");
  assertEqual(mismatchStore.read().fills[0].depletionRemaining, 30, "unit mismatch keeps depletion");
})();

(function atomicEnvelopePersist() {
  const pre = {
    fills: [sampleFill()],
    schedules: [sampleSchedule()],
    occurrences: [],
  };

  function memoryStorage(initial, failKeys) {
    const data = { ...initial };
    return {
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
      },
      setItem(key, value) {
        if ((failKeys || []).includes(key)) {
          throw new Error(`injected fail ${key}`);
        }
        data[key] = String(value);
      },
      data,
    };
  }

  function adapterFor(storage) {
    return ux.createTakenAdapter({
      readAppState: () => ux.readAppState(storage),
      writeAppState: (next) => ux.commitAppState(storage, next),
      timeZone: TZ,
      nowIso: () => LATER,
    });
  }

  const happy = memoryStorage({});
  ux.commitAppState(happy, pre);
  assert(ux.snapshotEqual(ux.readAppState(happy), pre), "envelope read matches committed pre-op");

  const legacyOnly = memoryStorage({
    [ux.FILLS_STORAGE_KEY]: JSON.stringify(pre.fills),
    [ux.SCHEDULES_STORAGE_KEY]: JSON.stringify(pre.schedules),
    [ux.OCCURRENCES_STORAGE_KEY]: JSON.stringify(pre.occurrences),
  });
  assert(ux.snapshotEqual(ux.readAppState(legacyOnly), pre), "legacy keys migrate on read when envelope is absent");
  ux.hydrateLegacyMirrors(legacyOnly);
  assert(Boolean(legacyOnly.getItem(ux.ENVELOPE_STORAGE_KEY)), "hydrate writes canonical envelope from legacy keys");

  const failEnvelope = memoryStorage({}, [ux.ENVELOPE_STORAGE_KEY]);
  ux.commitAppState(memoryStorage({}), pre);
  try {
    ux.commitAppState(failEnvelope, {
      ...pre,
      fills: [{ ...pre.fills[0], depletionRemaining: 1 }],
    });
    assert(false, "envelope failure must throw");
  } catch (error) {
    assert(/injected fail/.test(error.message), "envelope write is the throwing boundary");
  }
  assert(ux.snapshotEqual(ux.readAppState(failEnvelope), ux.emptyAppState()), "envelope failure reload is pre-op empty");

  const seededFailEnvelope = memoryStorage({});
  ux.commitAppState(seededFailEnvelope, pre);
  const beforeEnvelope = ux.cloneAppState(ux.readAppState(seededFailEnvelope));
  const failEnvelopeAfterSeed = memoryStorage({ ...seededFailEnvelope.data }, [ux.ENVELOPE_STORAGE_KEY]);
  const takenFailEnvelope = adapterFor(failEnvelopeAfterSeed).markTaken("sched-1", TODAY);
  assert(takenFailEnvelope.ok === false && takenFailEnvelope.code === "PERSIST_FAILED", "Taken reports persist failure when envelope write fails");
  assert(ux.snapshotEqual(ux.readAppState(failEnvelopeAfterSeed), beforeEnvelope), "Taken envelope failure reload is entirely pre-op");
  assertEqual(ux.readAppState(failEnvelopeAfterSeed).occurrences, [], "no mixed occurrence after envelope failure");
  assertEqual(ux.readAppState(failEnvelopeAfterSeed).fills[0].depletionRemaining, 30, "no mixed depletion after envelope failure");

  ux.PERSIST_WRITE_STEPS.filter((key) => key !== ux.ENVELOPE_STORAGE_KEY).forEach((mirrorKey) => {
    const storage = memoryStorage({});
    ux.commitAppState(storage, pre);
    const failing = memoryStorage({ ...storage.data }, [mirrorKey]);
    const taken = adapterFor(failing).markTaken("sched-1", TODAY);
    assert(taken.ok === true && taken.noop === false, `Taken succeeds when only ${mirrorKey} mirror fails`);
    const reloaded = ux.readAppState(failing);
    assert(reloaded.occurrences[0]?.status === "taken", `reload after ${mirrorKey} mirror fail is post-op taken`);
    assertEqual(reloaded.fills[0].depletionRemaining, 27, `reload after ${mirrorKey} mirror fail has matching depletion`);
    assertEqual(reloaded.schedules[0].takenDates, [TODAY], `reload after ${mirrorKey} mirror fail has matching takenDates`);
  });

  const archivePre = {
    fills: [sampleFill({ name: "Cabinet Peptide" })],
    schedules: [sampleSchedule({ takenDates: ["2026-08-01"] })],
    occurrences: [],
  };
  const archiveFailEnvelope = memoryStorage({});
  ux.commitAppState(archiveFailEnvelope, archivePre);
  const archiveBefore = ux.cloneAppState(ux.readAppState(archiveFailEnvelope));
  const archiveFail = memoryStorage({ ...archiveFailEnvelope.data }, [ux.ENVELOPE_STORAGE_KEY]);
  const planned = ux.applyCabinetArchive({
    ...archiveBefore,
    fillId: "fill-1",
    todayKey: TODAY,
  });
  try {
    ux.commitAppState(archiveFail, planned);
    assert(false, "cabinet envelope failure must throw");
  } catch {
    assert(ux.snapshotEqual(ux.readAppState(archiveFail), archiveBefore), "cabinet envelope failure reload is pre-op");
  }

  const archiveMirror = memoryStorage({});
  ux.commitAppState(archiveMirror, archivePre);
  const archiveMirrorFail = memoryStorage({ ...archiveMirror.data }, [ux.FILLS_STORAGE_KEY]);
  const archived = ux.applyCabinetArchive({
    ...ux.readAppState(archiveMirrorFail),
    fillId: "fill-1",
    todayKey: TODAY,
  });
  ux.commitAppState(archiveMirrorFail, archived);
  assert(ux.readAppState(archiveMirrorFail).fills[0].lifecycle === "archived", "cabinet mirror failure reload is post-op archive");
  assertEqual(
    ux.readAppState(archiveMirrorFail).schedules[0].takenDates,
    ["2026-08-01"],
    "cabinet archive after mirror failure retains history"
  );

  const savePre = ux.emptyAppState();
  const saveFail = memoryStorage({}, [ux.ENVELOPE_STORAGE_KEY]);
  try {
    ux.commitAppState(saveFail, {
      fills: [sampleFill({ name: "Saved" })],
      schedules: [sampleSchedule()],
      occurrences: [],
    });
    assert(false, "save envelope failure must throw");
  } catch {
    assert(ux.snapshotEqual(ux.readAppState(saveFail), savePre), "save envelope failure reload is pre-op");
  }
})();

(function undoAfterRestart() {
  const store = memoryStore({
    fills: [sampleFill()],
    schedules: [sampleSchedule()],
    occurrences: [],
  });
  makeAdapter(store).markTaken("sched-1", TODAY);
  const persisted = JSON.parse(JSON.stringify(store.read()));
  const restarted = memoryStore(persisted);
  const afterReload = makeAdapter(restarted);
  assert(afterReload.canUndo("sched-1", TODAY) === true, "Undo exists after restart, not snackbar-only");
  const undone = afterReload.undoTaken("sched-1", TODAY);
  assert(undone.ok === true, "restart-safe Undo");
  assert(restarted.read().occurrences[0].status === "pending", "restart Undo returns pending");
})();

(function snackbarAndA11yContract() {
  assert(ux.UNDO_SNACKBAR_MS >= 8000, "UX-SCH-001 Undo snackbar >= 8 seconds");
  assert(ux.MIN_TARGET_PX >= 44, "UX-A11Y-002 44px target constant");
  assert(ux.FOCUS_VISIBLE_PX >= 2, "UX-A11Y-003 focus-visible >= 2px");
  assert(ux.confirmAllowsEscape("discard-dirty") === true, "Escape cancels dirty confirm");
  assert(ux.confirmAllowsEscape("save-confirm") === true, "Escape cancels save confirm");
  assert(ux.confirmAllowsEscape("cabinet-delete") === true, "Escape cancels delete confirm");
  assert(ux.shouldCloseOnKey("Escape", true) === true, "Escape closes when allowed");
  assert(ux.shouldCloseOnKey("Escape", false) === false, "Escape ignored when not allowed");
  const trap = ux.trapTabKey("Tab", false, 0, 3);
  assert(trap.handled === true && trap.nextIndex === 1, "focus trap cycles forward");
  const back = ux.trapTabKey("Tab", true, 0, 3);
  assert(back.handled === true && back.nextIndex === 2, "focus trap cycles backward");
  const aria = ux.dialogAria("fitgen-confirm-title");
  assert(aria.role === "dialog" && aria.ariaModal === "true", "UX-A11Y-004 aria-modal dialog");
})();

(function cssTargetsAndFocus() {
  const css = readText(path.join(repoRoot(), "styles.css"));
  assert(/\.fitgen-target-44\s*\{[^}]*min-height:\s*44px/s.test(css), "44px min-height class present");
  assert(/\.fitgen-target-44\s*\{[^}]*min-width:\s*44px/s.test(css), "44px min-width class present");
  assert(/:focus-visible\s*\{[^}]*outline:\s*2px/s.test(css), "focus-visible 2px replacement");
  assert(/\.fitgen-dialog-card/.test(css), "in-app dialog styles exist");
  assert(/\.fitgen-snackbar/.test(css), "undo snackbar styles exist");
  assert(/\.fitgen-suggestion-wrap\.is-typing/.test(css), "suggestion wrap hide-while-typing lives in styles.css");
  assert(/\.fitgen-edit-overlay/.test(css), "edit-fill overlay styles live in styles.css");
})();

(function htmlSurfaces() {
  const html = readText(path.join(repoRoot(), "index.html"));
  assert(html.includes("wizard-cancel-btn"), "wizard Cancel control present");
  assert(html.includes("fitgen-confirm-dialog"), "in-app confirm dialog present");
  assert(html.includes('aria-modal="true"'), "dialog aria-modal in markup");
  assert(html.includes("fitgen-undo-snackbar"), "undo snackbar markup present");
  assert(html.includes("p0-ux.browser.js"), "FR-SCH-000 browser bundle is loaded");
  assert(html.includes("p0-ux-bind.js"), "P0.UX bind script is loaded");
  assert(html.includes("restore-backup-btn"), "Stage 3 restore control is present");
  assert(html.includes("fitgen-edit-overlay"), "Stage 6b.2 edit-fill overlay is in markup");
  assert(html.includes('id="fitgen-edit-title"'), "edit-fill dialog has a labelled title");
  assert(!/window\.alert\s*\(/.test(html), "no alert() in new markup");
})();

(function bindHasNoAlert() {
  const bind = readText(path.join(repoRoot(), "p0-ux-bind.js"));
  assert(!/window\.alert\s*\(/.test(bind), "UX-SYS-001 bind does not use alert()");
  assert(!/window\.confirm\s*\(/.test(bind), "bind does not use native confirm");
  assert(!/window\.prompt\s*\(/.test(bind), "bind does not use native prompt");
  assert(bind.includes("applyEditedFill"), "bind owns absorbed edit-fill apply");
  assert(bind.includes("attachSuggestionTyping"), "bind owns absorbed suggestion typing");
  assert(bind.includes("FitGenP0Ux"), "bind uses compiled P0.UX module");
  assert(bind.includes("markTaken") || bind.includes("createTakenAdapter"), "bind calls Taken adapter");
  assert(bind.includes("applyImport"), "bind wires Stage 3 applyImport");
})();

(function browserBundleFresh() {
  const dest = emitBrowserBundle();
  const generated = fs.readFileSync(dest, "utf8");
  const committed = fs.readFileSync(path.join(repoRoot(), BUNDLE_REL), "utf8");
  assert(generated === committed, "browser bundle is fresh from src/occ + src/ux");
  assert(generated.includes("root.FitGenP0Ux"), "bundle exports FitGenP0Ux");
  assert(generated.includes("markTaken"), "bundle includes occurrence writer");
  const sandbox = { window: {}, globalThis: {} };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(generated, sandbox);
  assert(typeof sandbox.FitGenP0Ux.validateWizardStep === "function", "bundle validateWizardStep loads");
  assert(typeof sandbox.FitGenP0Ux.markTaken === "function", "bundle markTaken loads");
  assert(typeof sandbox.FitGenP0Ux.createTakenAdapter === "function", "bundle createTakenAdapter loads");
  assert(typeof sandbox.FitGenP0Ux.applyImport === "function", "bundle applyImport loads");
  assert(typeof sandbox.FitGenP0Ux.previewImport === "function", "bundle previewImport loads");
  assert(typeof sandbox.FitGenP0Ux.installTabAriaSync === "function", "bundle installTabAriaSync loads");
  assert(typeof sandbox.FitGenP0Ux.applyEditedFill === "function", "bundle applyEditedFill loads");
  assert(typeof sandbox.FitGenP0Ux.attachSuggestionTyping === "function", "bundle attachSuggestionTyping loads");
})();

console.log(`P0.UX tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
