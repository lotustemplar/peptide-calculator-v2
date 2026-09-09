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
  assertEqual(mapped.state.schedules.length, 1, "synthetic schedule created");
  assert(
    mapped.state.schedules[0].id.startsWith(persist.BASELINE_SYNTHETIC_SCHEDULE_PREFIX),
    "synthetic schedule id is stable"
  );
  assertEqual(mapped.state.occurrences.length, 1, "only taken history becomes OCC");
  assertEqual(mapped.state.occurrences[0].status, "taken", "taken history maps to taken");
  assert(
    mapped.quarantine.some((row) => row.reason === "missed-status-unmapped"),
    "missed history is quarantined, not applied"
  );
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
  assertEqual(persist.readGithubState(failing).fills[0].savedId, "syn-fill-github-1", "rollback restored previous fills");
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
  assertEqual(round.state.schedules[0].id, baselineMapped.state.schedules[0].id, "baseline synthetic schedule stable");
  assertEqual(round.state.occurrences.length, baselineMapped.state.occurrences.length, "baseline taken OCC round-trip");
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
})();

(function htmlHasRestoreControl() {
  const html = readText(path.join(repoRoot(), "index.html"));
  assert(html.includes("restore-backup-btn"), "restore control exists on backup card");
  assert(html.includes("import-data-input"), "import input still present");
})();

console.log(`Stage 3 persist tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
