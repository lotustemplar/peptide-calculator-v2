#!/usr/bin/env node
"use strict";

/**
 * Stage 3 / P0.3 import-safety tests.
 * Synthetic fixtures only. No real PHI. Does not change calculator math.
 */

const fs = require("fs");
const path = require("path");
const { repoRoot, readText } = require("../ci/lib");
const { compileUxModules } = require("../ux/harness");
const { BUNDLE_REL, emitBrowserBundle } = require("../ux/emit-browser");

const { ux, outDir } = compileUxModules();
const persist = require(path.join(outDir, "persist", "index.js"));

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

const FIXTURE_DIR = path.join(repoRoot(), "scripts/persist/fixtures");
const NOW_ISO = "2026-09-09T12:00:00.000Z";
const NOW_MS = Date.parse(NOW_ISO);
const TZ = "UTC";

function loadFixture(name) {
  return readText(path.join(FIXTURE_DIR, name));
}

function memoryStorage(initial, options) {
  const data = { ...(initial || {}) };
  const failAlways = new Set((options && options.failAlways) || []);
  const failOnce = new Set((options && options.failOnce) || []);
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      if (failAlways.has(key) || failOnce.has(key)) {
        failOnce.delete(key);
        const error = new Error(`injected fail ${key}`);
        if (String(key).includes("recovery")) {
          error.name = "QuotaExceededError";
        }
        throw error;
      }
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    },
    data,
  };
}

function seedGithub(storage, state) {
  persist.commitGithubState(storage, state);
}

(function fixturesAreSynthetic() {
  const files = fs.readdirSync(FIXTURE_DIR).filter((name) => name.endsWith(".json"));
  assert(files.length >= 6, "both-generation fixtures exist");
  for (const file of files) {
    const text = loadFixture(file);
    assert(!/@[a-z0-9.-]+\.[a-z]{2,}/i.test(text), `${file} has no email-like tokens`);
    assert(!/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(text), `${file} has no phone-like tokens`);
    assert(/Synthetic/.test(text) || file.includes("v4"), `${file} uses synthetic names`);
  }
})();

(function classifyBothGenerations() {
  const baseline = persist.classifyBackup(JSON.parse(loadFixture("baseline-rebuild-v1.json")));
  assertEqual(baseline.class, "legacy-unversioned", "FR-IMP-001 baseline is legacy-unversioned");
  assertEqual(baseline.generation, "baseline-rebuild", "baseline generation detected");

  const v1 = persist.classifyBackup(JSON.parse(loadFixture("github-backup-v1.json")));
  assertEqual(v1.class, "legacy-unversioned", "GitHub v1 backup without schemaVersion is unversioned");
  assertEqual(v1.generation, "github-main", "GitHub v1 is github-main");

  const v3 = persist.classifyBackup(JSON.parse(loadFixture("backup-schema-v3.json")));
  assertEqual(v3.class, "current", "BACKUP_SCHEMA_V3 is current");
  assertEqual(v3.schemaVersion, 3, "schemaVersion 3");

  const v4 = persist.classifyBackup(JSON.parse(loadFixture("backup-schema-v4-unknown.json")));
  assertEqual(v4.class, "unknown-newer", "schemaVersion 4 is unknown-newer");
  assert(v4.applyBlocked === true, "unknown-newer apply blocked");

  const versioned = persist.classifyBackup({ schemaVersion: 2, fills: [] });
  assertEqual(versioned.class, "legacy-versioned", "schemaVersion 2 is legacy-versioned");

  const corrupt = persist.parseBackupText("{not json");
  assert(corrupt.ok === false, "corrupt JSON fails parse");
})();

(function mapBaselineDoesNotInventMissed() {
  const mapped = persist.mapToV3(JSON.parse(loadFixture("baseline-rebuild-v1.json")), TZ, NOW_ISO);
  assert(mapped.ok === true, "baseline maps to v3");
  assertEqual(mapped.state.fills.length, 1, "baseline fill mapped");
  assertEqual(mapped.state.schedules.length, 0, "incomplete baseline does not invent a schedule");
  assertEqual(mapped.state.occurrences.length, 0, "taken history without a source schedule is not OCC");
  assert(
    mapped.quarantine.some((row) => row.reason === "missed-status-unmapped"),
    "missed history is quarantined, not applied"
  );
  assert(
    mapped.quarantine.some((row) => row.reason === "taken-history-no-source-schedule"),
    "taken history without interval/time/start is quarantined"
  );
})();

(function mapBaselineCompleteSourceSchedule() {
  const mapped = persist.mapToV3(JSON.parse(loadFixture("baseline-rebuild-complete-schedule.json")), TZ, NOW_ISO);
  assert(mapped.ok === true, "complete baseline maps");
  assertEqual(mapped.state.schedules.length, 1, "complete source schedule is mapped");
  assert(
    mapped.state.schedules[0].id.startsWith(persist.BASELINE_SYNTHETIC_SCHEDULE_PREFIX),
    "mapped schedule id is stable"
  );
  assertEqual(mapped.state.schedules[0].intervalDays, 3, "source intervalDays preserved");
  assertEqual(mapped.state.schedules[0].reminderTime, "08:15", "source reminderTime preserved");
  assertEqual(mapped.state.schedules[0].startDate, "2026-01-10", "source startDate preserved");
  assertEqual(mapped.state.occurrences.length, 1, "only taken history becomes OCC when schedule is complete");
  assertEqual(mapped.state.occurrences[0].status, "taken", "taken history maps to taken");
  assert(
    mapped.quarantine.some((row) => row.reason === "missed-status-unmapped"),
    "complete fixture still quarantines missed"
  );
})();

(function mapBaselineMissingScheduleFieldsNeverInvent() {
  const complete = JSON.parse(loadFixture("baseline-rebuild-complete-schedule.json"));
  for (const field of ["intervalDays", "reminderTime", "startDate"]) {
    const copy = JSON.parse(JSON.stringify(complete));
    delete copy.fills[0][field];
    const mapped = persist.mapToV3(copy, TZ, NOW_ISO);
    assertEqual(mapped.state.schedules.length, 0, `missing ${field} creates no schedule`);
    assertEqual(mapped.state.occurrences.length, 0, `missing ${field} creates no OCC`);
    assert(
      mapped.state.schedules.every((row) => row.lifecycle !== "active"),
      `missing ${field} does not produce an active series`
    );
    assert(
      mapped.state.schedules.every((row) => !row.reminderTime),
      `missing ${field} does not invent a reminder`
    );
    assert(
      mapped.quarantine.some((row) => row.reason === "taken-history-no-source-schedule"),
      `missing ${field} quarantines taken history`
    );
    assert(
      mapped.quarantine.some((row) => row.reason === "incomplete-source-schedule"),
      `missing ${field} is incomplete-source-schedule`
    );
  }
})();

(function previewCancelZeroWrites() {
  const storage = memoryStorage({});
  const baselineRaw = loadFixture("baseline-rebuild-v1.json");
  storage.setItem(persist.BASELINE_ENVELOPE_KEY, baselineRaw);
  const preview = persist.previewImportFromStorage(storage, loadFixture("github-backup-v1.json"), TZ, NOW_ISO);
  assert(preview.applyBlocked === false, "mapped GitHub backup can apply");
  assert(preview.baselineKeyPresent === true, "preview sees baseline coexistence");
  assert(preview.baselineKeyWillMutate === false, "preview promises no baseline mutate");
  assertEqual(storage.getItem(persist.BASELINE_ENVELOPE_KEY), baselineRaw, "preview does not write");
  assert(storage.getItem(persist.ENVELOPE_STORAGE_KEY) === null, "cancel path never writes envelope");
})();

(function skipExistingKeepsLocal() {
  const storage = memoryStorage({});
  const currentText = loadFixture("github-backup-v1.json");
  const previewSeed = persist.previewImport({
    text: currentText,
    current: persist.readGithubState(storage),
    timeZone: TZ,
    nowIso: NOW_ISO,
  });
  persist.applyImport(storage, previewSeed, "skip-existing", NOW_MS, false);
  const before = persist.readGithubState(storage);
  const overlap = persist.previewImportFromStorage(storage, loadFixture("collision-overlap.json"), TZ, NOW_ISO);
  assert(overlap.collisions.fills.includes("syn-fill-github-1"), "fill collision detected");
  const applied = persist.applyImport(storage, overlap, "skip-existing", NOW_MS + 1000, false);
  assert(applied.ok === true && applied.wrote === true, "skip apply writes new rows");
  const after = persist.readGithubState(storage);
  assertEqual(after.fills.find((row) => row.savedId === "syn-fill-github-1").name, before.fills[0].name, "skip keeps local fill");
  assert(
    after.fills.some((row) => row.savedId === "syn-fill-collision-new"),
    "skip adds non-colliding fill"
  );
})();

(function replaceAllRequiresConfirmAndSwaps() {
  const storage = memoryStorage({});
  const seed = persist.previewImport({
    text: loadFixture("github-backup-v1.json"),
    current: persist.readGithubState(storage),
    timeZone: TZ,
    nowIso: NOW_ISO,
  });
  persist.applyImport(storage, seed, "skip-existing", NOW_MS, false);
  const incoming = persist.previewImportFromStorage(storage, loadFixture("github-backup-v2.json"), TZ, NOW_ISO);
  const denied = persist.applyImport(storage, incoming, "replace-all", NOW_MS + 1, false);
  assertEqual(denied.code, "REPLACE_CONFIRM_REQUIRED", "Replace All needs destructive confirm");
  assertEqual(persist.readGithubState(storage).fills[0].savedId, "syn-fill-github-1", "denied replace writes nothing");
  const replaced = persist.applyImport(storage, incoming, "replace-all", NOW_MS + 2, true);
  assert(replaced.ok === true, "confirmed replace applies");
  assertEqual(persist.readGithubState(storage).fills[0].savedId, "syn-fill-github-2", "replace all swapped fills");
})();

(function unknownNewerBlocked() {
  const storage = memoryStorage({});
  seedGithub(storage, persist.previewImport({
    text: loadFixture("github-backup-v2.json"),
    current: persist.readGithubState(storage),
    timeZone: TZ,
    nowIso: NOW_ISO,
  }).incoming);
  const before = persist.readGithubState(storage);
  const preview = persist.previewImportFromStorage(
    storage,
    loadFixture("backup-schema-v4-unknown.json"),
    TZ,
    NOW_ISO
  );
  assertEqual(preview.class, "unknown-newer", "v4 classified");
  assert(preview.applyBlocked === true, "v4 apply blocked");
  const applied = persist.applyImport(storage, preview, "replace-all", NOW_MS, true);
  assert(applied.ok === false && applied.wrote === false, "blocked apply writes nothing");
  assertEqual(persist.readGithubState(storage).fills[0].savedId, before.fills[0].savedId, "v4 does not mutate");
})();

(function quotaAbortsAndKeepsPriorSlot() {
  const storage = memoryStorage({});
  const first = persist.previewImport({
    text: loadFixture("github-backup-v1.json"),
    current: persist.readGithubState(storage),
    timeZone: TZ,
    nowIso: NOW_ISO,
  });
  persist.applyImport(storage, first, "skip-existing", NOW_MS, false);
  const priorSlot = storage.getItem(persist.RECOVERY_SLOT_KEY);
  const failing = memoryStorage({ ...storage.data }, { failAlways: [persist.RECOVERY_SLOT_PENDING_KEY] });
  const second = persist.previewImportFromStorage(failing, loadFixture("github-backup-v2.json"), TZ, NOW_ISO);
  const result = persist.applyImport(failing, second, "replace-all", NOW_MS + 5000, true);
  assertEqual(result.code, "QUOTA", "quota failure code");
  assert(result.wrote === false, "quota writes no app state");
  assertEqual(failing.getItem(persist.RECOVERY_SLOT_KEY), priorSlot, "prior slot intact on quota");
  assertEqual(persist.readGithubState(failing).fills[0].savedId, "syn-fill-github-1", "quota leaves fills");
  assertEqual(persist.readGithubState(failing).medications[0].id, "syn-med-github-1", "quota leaves medications");
})();

(function envelopeFailureRollsBack() {
  const storage = memoryStorage({});
  const first = persist.previewImport({
    text: loadFixture("github-backup-v1.json"),
    current: persist.readGithubState(storage),
    timeZone: TZ,
    nowIso: NOW_ISO,
  });
  persist.applyImport(storage, first, "skip-existing", NOW_MS, false);
  const failing = memoryStorage({ ...storage.data }, { failOnce: [persist.ENVELOPE_STORAGE_KEY] });
  const second = persist.previewImportFromStorage(failing, loadFixture("github-backup-v2.json"), TZ, NOW_ISO);
  const result = persist.applyImport(failing, second, "replace-all", NOW_MS + 8000, true);
  assert(result.ok === false, "envelope failure is not success");
  const reloaded = persist.readGithubState(failing);
  assertEqual(reloaded.fills[0].savedId, "syn-fill-github-1", "rollback restored previous fills");
  assertEqual(reloaded.medications[0].id, "syn-med-github-1", "rollback restored previous medications");
})();

(function mirrorFailuresArePostOpIncludingMedications() {
  persist.PERSIST_WRITE_STEPS.filter((key) => key !== persist.ENVELOPE_STORAGE_KEY).forEach((mirrorKey) => {
    const storage = memoryStorage({});
    const first = persist.previewImport({
      text: loadFixture("github-backup-v1.json"),
      current: persist.readGithubState(storage),
      timeZone: TZ,
      nowIso: NOW_ISO,
    });
    persist.applyImport(storage, first, "skip-existing", NOW_MS, false);
    const failing = memoryStorage({ ...storage.data }, { failAlways: [mirrorKey] });
    const second = persist.previewImportFromStorage(failing, loadFixture("github-backup-v2.json"), TZ, NOW_ISO);
    const result = persist.applyImport(failing, second, "replace-all", NOW_MS + 9000, true);
    assert(result.ok === true && result.wrote === true, `import succeeds when only ${mirrorKey} mirror fails`);
    const reloaded = persist.readGithubState(failing);
    assertEqual(reloaded.fills[0].savedId, "syn-fill-github-2", `reload after ${mirrorKey} fail is fully imported fills`);
    assertEqual(reloaded.medications.length, 0, `reload after ${mirrorKey} fail is fully imported medications`);
    assert(
      reloaded.fills[0].savedId !== "syn-fill-github-1" || reloaded.medications.length !== 1,
      `reload after ${mirrorKey} fail is not mixed generations`
    );
  });
})();

(function takenPreservesEnvelopeMedications() {
  const storage = memoryStorage({});
  const first = persist.previewImport({
    text: loadFixture("github-backup-v1.json"),
    current: persist.readGithubState(storage),
    timeZone: TZ,
    nowIso: NOW_ISO,
  });
  persist.applyImport(storage, first, "skip-existing", NOW_MS, false);
  const before = persist.readGithubState(storage);
  ux.commitAppState(storage, {
    fills: before.fills,
    schedules: before.schedules,
    occurrences: before.occurrences,
  });
  const after = persist.readGithubState(storage);
  assertEqual(after.medications[0].id, "syn-med-github-1", "commitAppState without medications option preserves the list");
  const envelope = JSON.parse(storage.getItem(persist.ENVELOPE_STORAGE_KEY));
  assertEqual(envelope.medications[0].id, "syn-med-github-1", "preserved medications stay in the envelope");
})();

(function restoreAfterRestartAndSecondImport() {
  const storage = memoryStorage({});
  const first = persist.previewImport({
    text: loadFixture("github-backup-v1.json"),
    current: persist.readGithubState(storage),
    timeZone: TZ,
    nowIso: NOW_ISO,
  });
  persist.applyImport(storage, first, "skip-existing", NOW_MS, false);
  const second = persist.previewImportFromStorage(storage, loadFixture("github-backup-v2.json"), TZ, NOW_ISO);
  persist.applyImport(storage, second, "replace-all", NOW_MS + 10_000, true);
  const restarted = memoryStorage({ ...storage.data });
  assert(persist.restoreAvailable(restarted, NOW_MS + 20_000) === true, "restore survives restart");
  const restored = persist.restoreFromSlot(restarted, NOW_MS + 20_000);
  assert(restored.ok === true, "restore after restart");
  assertEqual(persist.readGithubState(restarted).fills[0].savedId, "syn-fill-github-1", "current slot restores last pre-import");

  const third = persist.previewImportFromStorage(restarted, loadFixture("github-multikey.json"), TZ, NOW_ISO);
  persist.applyImport(restarted, third, "replace-all", NOW_MS + 30_000, true);
  persist.restoreFromSlot(restarted, NOW_MS + 40_000);
  assertEqual(
    persist.readGithubState(restarted).fills[0].savedId,
    "syn-fill-github-1",
    "second import leaves only the current slot (v1, not v2)"
  );
})();

(function expiryDisablesRestore() {
  const storage = memoryStorage({});
  const state = persist.previewImport({
    text: loadFixture("github-backup-v1.json"),
    current: persist.readGithubState(storage),
    timeZone: TZ,
    nowIso: NOW_ISO,
  }).incoming;
  persist.writeRecoverySlot(storage, persist.buildRecoverySnapshot(state, "2026-01-01T00:00:00.000Z"));
  assert(persist.restoreAvailable(storage, NOW_MS) === false, "expired slot is unavailable");
  const result = persist.restoreFromSlot(storage, NOW_MS);
  assertEqual(result.code, "EXPIRED", "restore after 168h is expired");
  assert(result.wrote === false, "expired restore writes nothing");
})();

(function corruptSnapshotFailsClosed() {
  const storage = memoryStorage({});
  seedGithub(storage, persist.previewImport({
    text: loadFixture("github-backup-v1.json"),
    current: persist.readGithubState(storage),
    timeZone: TZ,
    nowIso: NOW_ISO,
  }).incoming);
  storage.setItem(persist.RECOVERY_SLOT_KEY, "{not-a-slot");
  const before = persist.readGithubState(storage);
  const result = persist.restoreFromSlot(storage, NOW_MS);
  assertEqual(result.code, "CORRUPT_SNAPSHOT", "corrupt snapshot code");
  assertEqual(persist.readGithubState(storage).fills[0].savedId, before.fills[0].savedId, "corrupt restore does not partial-apply");
})();

(function neverMutateBaselineKey() {
  const storage = memoryStorage({});
  const baselineRaw = loadFixture("baseline-rebuild-v1.json");
  storage.setItem(persist.BASELINE_ENVELOPE_KEY, baselineRaw);
  const preview = persist.previewImportFromStorage(storage, loadFixture("github-backup-v1.json"), TZ, NOW_ISO);
  const applied = persist.applyImport(storage, preview, "replace-all", NOW_MS, true);
  assert(applied.baselineKeyUnchanged === true, "apply reports baseline unchanged");
  assertEqual(storage.getItem(persist.BASELINE_ENVELOPE_KEY), baselineRaw, "replace-all does not mutate baseline key");
  persist.restoreFromSlot(storage, NOW_MS + 1);
  assertEqual(storage.getItem(persist.BASELINE_ENVELOPE_KEY), baselineRaw, "restore does not mutate baseline key");
  try {
    persist.guardedSetItem(storage, persist.BASELINE_ENVELOPE_KEY, "{}");
    assert(false, "guarded setItem must throw on baseline key");
  } catch (error) {
    assert(/must not mutate/.test(error.message), "baseline write guard message");
  }
  assertEqual(storage.getItem(persist.BASELINE_ENVELOPE_KEY), baselineRaw, "failed guard left baseline bytes");
  assert(
    !persist.PERSIST_WRITE_STEPS.includes(persist.BASELINE_ENVELOPE_KEY),
    "envelope write steps exclude baseline key"
  );
})();

(function roundTripBothGenerations() {
  const github = persist.previewImport({
    text: loadFixture("github-backup-v1.json"),
    current: persist.readGithubState(memoryStorage({})),
    timeZone: TZ,
    nowIso: NOW_ISO,
  }).incoming;
  const exported = persist.exportDocumentJson(github, NOW_ISO);
  const parsed = JSON.parse(exported);
  assertEqual(parsed.schemaVersion, 3, "export writes BACKUP_SCHEMA_V3");
  assert(Array.isArray(parsed.fills) && Array.isArray(parsed.entities.fills), "v3 dual-read top-level + entities");
  const empty = memoryStorage({});
  const preview = persist.previewImportFromStorage(empty, exported, TZ, NOW_ISO);
  assertEqual(preview.class, "current", "exported file is current");
  persist.applyImport(empty, preview, "skip-existing", NOW_MS, false);
  const reloaded = persist.readGithubState(empty);
  assertEqual(reloaded.fills[0].savedId, github.fills[0].savedId, "github round-trip fill id");
  assertEqual(reloaded.schedules[0].id, github.schedules[0].id, "github round-trip schedule id");
  assertEqual(reloaded.occurrences[0].id, github.occurrences[0].id, "github round-trip occurrence id");
  assert(
    reloaded.fills[0].rxCui === "syn-fixture-only" || preview.quarantine.some((row) => row.field || row.payload),
    "unknown rxCui preserved or quarantined, not silently dropped"
  );

  const baselineMapped = persist.mapToV3(JSON.parse(loadFixture("baseline-rebuild-v1.json")), TZ, NOW_ISO);
  const baselineExport = persist.exportDocumentJson(baselineMapped.state, NOW_ISO);
  const round = persist.mapToV3(JSON.parse(baselineExport), TZ, NOW_ISO);
  assertEqual(round.state.fills[0].savedId, baselineMapped.state.fills[0].savedId, "baseline map round-trip fill");
  assertEqual(round.state.schedules.length, 0, "incomplete baseline round-trip has no invented schedule");
  assertEqual(round.state.occurrences.length, 0, "incomplete baseline taken history stays quarantined");

  const completeMapped = persist.mapToV3(JSON.parse(loadFixture("baseline-rebuild-complete-schedule.json")), TZ, NOW_ISO);
  const completeExport = persist.exportDocumentJson(completeMapped.state, NOW_ISO);
  const completeRound = persist.mapToV3(JSON.parse(completeExport), TZ, NOW_ISO);
  assertEqual(completeRound.state.schedules[0].id, completeMapped.state.schedules[0].id, "complete source schedule id stable");
  assertEqual(completeRound.state.occurrences.length, completeMapped.state.occurrences.length, "complete taken OCC round-trip");
})();

(function exportIsLocalFileOnly() {
  const bind = readText(path.join(repoRoot(), "p0-ux-bind.js"));
  assert(!/navigator\.share\s*\(/.test(bind), "p0-ux-bind must not invoke navigator.share");
  const exportSrc = readText(path.join(repoRoot(), "src/persist/export.ts"));
  assert(!/navigator\.share\s*\(/.test(exportSrc), "persist export helper must not invoke navigator.share");
  assertEqual(persist.chooseLocalExportMode(null), "download", "no native bridge => download");
  assertEqual(
    persist.chooseLocalExportMode({
      exportBackup() {
        return { ok: true };
      },
    }),
    "native",
    "native local-file bridge preferred"
  );
  let shareInvoked = false;
  const share = () => {
    shareInvoked = true;
    throw new Error("navigator.share must not be invoked");
  };
  let downloaded = 0;
  const downloadMode = persist.writeLocalBackup("{}\n", "syn-export.json", {
    download() {
      downloaded += 1;
    },
  });
  assertEqual(downloadMode, "download", "writeLocalBackup downloads when native is absent");
  assertEqual(downloaded, 1, "download writer used once");
  assert(shareInvoked === false, "share must not run on the download path");
  const nativeMode = persist.writeLocalBackup("{}\n", "syn-export.json", {
    nativeExport() {
      return { ok: true };
    },
    download() {
      downloaded += 1;
    },
  });
  assertEqual(nativeMode, "native", "native file operation used when present");
  assertEqual(downloaded, 1, "successful native export does not also download");
  assert(typeof share === "function" && shareInvoked === false, "navigator.share spy was never invoked");
})();

(function exportWarningCopyPresent() {
  assert(persist.EXPORT_PLAINTEXT_WARNING.includes("plaintext"), "FR-EXP-001 warning names plaintext");
  assert(persist.EXPORT_PLAINTEXT_WARNING.toLowerCase().includes("network"), "warning says no network send");
  assert(!/target dose/i.test(persist.EXPORT_PLAINTEXT_WARNING), "warning has no target-dose framing");
})();

(function p0uxEnvelopeAndMultikeyMap() {
  const envelope = persist.classifyBackup(JSON.parse(loadFixture("github-p0ux-envelope.json")));
  assertEqual(envelope.generation, "github-main", "P0.UX envelope maps as github-main");
  const mapped = persist.mapToV3(JSON.parse(loadFixture("github-multikey.json")), TZ, NOW_ISO);
  assert(mapped.ok === true, "multi-key fixture maps");
  assertEqual(mapped.state.occurrences.length, 1, "takenDates materialize OCC when occurrences empty");
})();

(function bundleExportsPersistGate() {
  emitBrowserBundle();
  const generated = fs.readFileSync(path.join(repoRoot(), BUNDLE_REL), "utf8");
  assert(generated.includes("applyImport"), "browser bundle includes applyImport");
  assert(generated.includes("fitgen-peptide-rebuild-v1"), "bundle names baseline key as protected");
  assert(typeof ux.applyImport === "function", "ux index re-exports applyImport");
  assert(typeof ux.previewImport === "function", "ux index re-exports previewImport");
  assert(typeof ux.writeLocalBackup === "function", "ux index re-exports writeLocalBackup");
  assert(generated.includes("writeLocalBackup"), "browser bundle includes writeLocalBackup");
  assert(
    persist.PERSIST_WRITE_STEPS.includes(persist.MEDICATIONS_STORAGE_KEY),
    "medications key is a persist write step"
  );
  assert(typeof persist.attachMedicationsWriteBridge === "function", "persist index exports medications write bridge");
  assert(typeof ux.attachMedicationsWriteBridge === "function", "ux index exports medications write bridge");
  assert(generated.includes("attachMedicationsWriteBridge"), "browser bundle includes medications write bridge");
  const bind = readText(path.join(repoRoot(), "p0-ux-bind.js"));
  assert(/attachMedicationsWriteBridge\s*\(\s*window\.localStorage\s*\)/.test(bind), "bind attaches medications write bridge");
})();

function sampleLiveMed(id, name) {
  return { id, name, dose: 1, unit: "mg", interval: 7 };
}

(function liveAddAfterEnvelopeSurvivesReloadAndExport() {
  const storage = memoryStorage({});
  const first = persist.previewImport({
    text: loadFixture("github-backup-v1.json"),
    current: persist.readGithubState(storage),
    timeZone: TZ,
    nowIso: NOW_ISO,
  });
  persist.applyImport(storage, first, "skip-existing", NOW_MS, false);
  persist.attachMedicationsWriteBridge(storage);
  const added = sampleLiveMed("syn-med-live-add", "Synthetic Gamma Plan");
  const nextList = [...persist.readGithubState(storage).medications, added];
  storage.setItem(persist.MEDICATIONS_STORAGE_KEY, JSON.stringify(nextList));
  const live = persist.readGithubState(storage);
  assert(
    live.medications.some((row) => row.id === "syn-med-live-add"),
    "live add after envelope is readable from canonical state"
  );
  const envelope = JSON.parse(storage.getItem(persist.ENVELOPE_STORAGE_KEY));
  assert(
    envelope.medications.some((row) => row.id === "syn-med-live-add"),
    "live add is stored in the envelope, not only the mirror"
  );
  assertEqual(live.fills[0].savedId, "syn-fill-github-1", "live add keeps current fills");
  const exported = persist.exportDocumentJson(live, NOW_ISO);
  assert(/syn-med-live-add/.test(exported) && /Synthetic Gamma Plan/.test(exported), "export includes the live-added medication");
  const reloaded = memoryStorage({ ...storage.data });
  assert(
    persist.readGithubState(reloaded).medications.some((row) => row.id === "syn-med-live-add"),
    "reload after live add still has the medication"
  );
  assertEqual(ux.readMedications(reloaded).some((row) => row.id === "syn-med-live-add"), true, "readMedications prefers envelope after reload");
})();

(function liveDeleteThenTakenKeepsDeletion() {
  const storage = memoryStorage({});
  const first = persist.previewImport({
    text: loadFixture("github-backup-v1.json"),
    current: persist.readGithubState(storage),
    timeZone: TZ,
    nowIso: NOW_ISO,
  });
  persist.applyImport(storage, first, "skip-existing", NOW_MS, false);
  persist.attachMedicationsWriteBridge(storage);
  assertEqual(persist.readGithubState(storage).medications[0].id, "syn-med-github-1", "imported medication present before delete");
  storage.setItem(persist.MEDICATIONS_STORAGE_KEY, JSON.stringify([]));
  assertEqual(ux.readMedications(storage).length, 0, "bridge delete clears envelope medications");
  const persisted = persist.readGithubState(storage);
  ux.commitAppState(storage, {
    fills: persisted.fills,
    schedules: persisted.schedules,
    occurrences: persisted.occurrences,
  });
  assertEqual(persist.readGithubState(storage).medications.length, 0, "Taken-style commit does not resurrect a deleted medication");
  const envelope = JSON.parse(storage.getItem(persist.ENVELOPE_STORAGE_KEY));
  assertEqual(envelope.medications.length, 0, "empty envelope medications is a real delete-all");
  assertEqual(persisted.fills[0].savedId, "syn-fill-github-1", "delete keeps current fills");
})();

(function medicationsMirrorFailureAfterCanonicalReload() {
  const storage = memoryStorage({});
  const first = persist.previewImport({
    text: loadFixture("github-backup-v1.json"),
    current: persist.readGithubState(storage),
    timeZone: TZ,
    nowIso: NOW_ISO,
  });
  persist.applyImport(storage, first, "skip-existing", NOW_MS, false);
  persist.attachMedicationsWriteBridge(storage);
  const failing = memoryStorage({ ...storage.data }, { failAlways: [persist.MEDICATIONS_STORAGE_KEY] });
  persist.attachMedicationsWriteBridge(failing);
  const added = sampleLiveMed("syn-med-live-mirror-fail", "Synthetic Delta Plan");
  const nextList = [...persist.readGithubState(failing).medications, added];
  failing.setItem(persist.MEDICATIONS_STORAGE_KEY, JSON.stringify(nextList));
  const envelope = JSON.parse(failing.getItem(persist.ENVELOPE_STORAGE_KEY));
  assert(
    envelope.medications.some((row) => row.id === "syn-med-live-mirror-fail"),
    "canonical envelope has the live add even when the medications mirror throws"
  );
  const reloaded = memoryStorage({ ...failing.data });
  assert(
    persist.readGithubState(reloaded).medications.some((row) => row.id === "syn-med-live-mirror-fail"),
    "reload after medications-mirror failure reads canonical envelope state"
  );
  assert(
    persist.readGithubState(reloaded).fills[0].savedId === "syn-fill-github-1",
    "reload after medications-mirror failure keeps current fills"
  );
})();

(function preStage3MirrorHydratesOnceWithoutOverridingCanonical() {
  const medA = sampleLiveMed("syn-med-legacy-a", "Synthetic Legacy Alpha Plan");
  const medB = sampleLiveMed("syn-med-canonical-b", "Synthetic Canonical Beta Plan");
  const storage = memoryStorage({
    [persist.MEDICATIONS_STORAGE_KEY]: JSON.stringify([medA]),
  });
  ux.hydrateLegacyMirrors(storage);
  const afterFirst = JSON.parse(storage.getItem(persist.ENVELOPE_STORAGE_KEY));
  assertEqual(afterFirst.medications[0].id, "syn-med-legacy-a", "mirror-only data hydrates into the envelope once");
  ux.commitAppState(storage, ux.readAppState(storage), { medications: [medB] });
  assertEqual(ux.readMedications(storage)[0].id, "syn-med-canonical-b", "canonical edit replaces hydrated medications");
  ux.hydrateLegacyMirrors(storage);
  assertEqual(ux.readMedications(storage)[0].id, "syn-med-canonical-b", "second hydrate does not restore the pre-Stage-3 mirror");
  storage.data[persist.MEDICATIONS_STORAGE_KEY] = JSON.stringify([medA]);
  assertEqual(ux.readMedications(storage)[0].id, "syn-med-canonical-b", "stale mirror does not override envelope medications");
  ux.hydrateLegacyMirrors(storage);
  assertEqual(ux.readMedications(storage)[0].id, "syn-med-canonical-b", "hydrate after a stale mirror still prefers canonical");
  assertEqual(
    JSON.parse(storage.getItem(persist.MEDICATIONS_STORAGE_KEY))[0].id,
    "syn-med-canonical-b",
    "hydrate rewrites the stale mirror from the envelope"
  );

  const stage2 = memoryStorage({});
  stage2.setItem(
    persist.ENVELOPE_STORAGE_KEY,
    JSON.stringify({ version: 1, fills: [], schedules: [], occurrences: [] })
  );
  stage2.data[persist.MEDICATIONS_STORAGE_KEY] = JSON.stringify([medA]);
  ux.hydrateLegacyMirrors(stage2);
  assertEqual(
    JSON.parse(stage2.getItem(persist.ENVELOPE_STORAGE_KEY)).medications[0].id,
    "syn-med-legacy-a",
    "Stage-2 envelope without medications field hydrates the mirror once"
  );
  ux.commitAppState(stage2, ux.readAppState(stage2), { medications: [medB] });
  stage2.data[persist.MEDICATIONS_STORAGE_KEY] = JSON.stringify([medA]);
  ux.hydrateLegacyMirrors(stage2);
  assertEqual(ux.readMedications(stage2)[0].id, "syn-med-canonical-b", "later canonical medications are not overridden by the old mirror");
})();

(function htmlHasRestoreControl() {
  const html = readText(path.join(repoRoot(), "index.html"));
  assert(html.includes("restore-backup-btn"), "restore control exists on backup card");
  assert(html.includes("import-data-input"), "import input still present");
})();

console.log(`Stage 3 persist tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
