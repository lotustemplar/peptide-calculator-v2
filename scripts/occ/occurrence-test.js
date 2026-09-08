"use strict";

/**
 * P0.OCC / FR-SCH-000 / Spec §6.5 occurrence identity + atomic writer tests.
 *
 * These tests exercise the typed occurrence module only.
 * They do not wire Taken/Undo UI, change calculator math, or rewrite takenDates.
 */

const { compileOccurrenceModules } = require("./harness");

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

function assertEqual(actual, expected, message) {
  const ok = Object.is(actual, expected);
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${message}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL  ${message} (actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)})`);
}

const occ = compileOccurrenceModules();

const NOW = "2026-09-08T15:00:00.000Z";
const LATER = "2026-09-08T16:00:00.000Z";
const SCHEDULE_ID = "sched-1";
const FILL_ID = "fill-1";
const DATE = "2026-09-08";
const TZ = "America/New_York";

function baseFill(overrides) {
  return {
    id: FILL_ID,
    desiredDose: 2,
    unit: "mg",
    depletionRemaining: 30,
    depletionUnit: "mg",
    ...overrides,
  };
}

function emptySnapshot(fillOverrides) {
  return {
    occurrences: [],
    fills: [baseFill(fillOverrides)],
  };
}

function identity() {
  return {
    scheduleId: SCHEDULE_ID,
    localCivilDate: DATE,
    timeZone: TZ,
    fillId: FILL_ID,
    nowIso: NOW,
  };
}

function recordingPersist() {
  const commits = [];
  return {
    commits,
    persist(snapshot) {
      commits.push(snapshot);
    },
  };
}

function throwingPersist() {
  return {
    persist() {
      throw new Error("quota or serialize failure");
    },
  };
}

function snapshotEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

console.log("P0.OCC FR-SCH-000 occurrence identity + atomic writer");

(function rematerializeStableId() {
  const first = occ.materializeOccurrence([], {
    scheduleId: SCHEDULE_ID,
    localCivilDate: DATE,
    timeZone: TZ,
    nowIso: NOW,
    createId: () => "uuid-stable-1",
  });
  const rebuilt = occ.materializeOccurrence(first.records, {
    scheduleId: SCHEDULE_ID,
    localCivilDate: DATE,
    timeZone: TZ,
    nowIso: LATER,
    createId: () => "uuid-must-not-be-used",
  });
  assertEqual(rebuilt.records.length, 1, "calendar rebuild keeps one occurrence row");
  assertEqual(rebuilt.created, false, "calendar rebuild does not insert a second row");
  assertEqual(rebuilt.record.id, "uuid-stable-1", "calendar rebuild reuses the persisted surrogate id");
  assertEqual(
    occ.countIdentityMatches(rebuilt.records, SCHEDULE_ID, DATE),
    1,
    "uniqueness holds for (scheduleId, localCivilDate)"
  );

  const persisted = occ.reloadSnapshot({ occurrences: first.records, fills: [] });
  const afterRestart = occ.materializeOccurrence(persisted.occurrences, {
    scheduleId: SCHEDULE_ID,
    localCivilDate: DATE,
    timeZone: TZ,
    nowIso: LATER,
    createId: () => "uuid-after-restart-must-not-be-used",
  });
  assertEqual(afterRestart.records.length, 1, "restart rematerialize keeps one occurrence row");
  assertEqual(afterRestart.record.id, "uuid-stable-1", "restart rematerialize reuses the same id");
  assertEqual(afterRestart.record.status, "pending", "rematerialize does not invent taken state");
})();

(function firstTakenAtomic() {
  const persist = recordingPersist();
  const before = emptySnapshot();
  const result = occ.markTaken(before, identity(), persist.persist);
  assert(result.ok === true && result.noop === false, "first Taken succeeds");
  assertEqual(result.occurrence.status, "taken", "Taken sets status=taken");
  assertEqual(result.occurrence.takenAt, NOW, "Taken sets takenAt");
  assertEqual(result.occurrence.appliedDepletionAmount, 2, "Taken snapshots desiredDose");
  assertEqual(result.occurrence.appliedDepletionUnit, "mg", "Taken snapshots unit");
  assertEqual(result.occurrence.appliedFillId, FILL_ID, "Taken stores immutable appliedFillId");
  assertEqual(result.fill.depletionRemaining, 28, "Taken decrements fill depletion by snapshot amount");
  assertEqual(persist.commits.length, 1, "Taken persists one writer commit");
  assertEqual(result.snapshot.occurrences.length, 1, "Taken persist includes the occurrence");
  assertEqual(result.snapshot.fills[0].depletionRemaining, 28, "Taken persist includes fill depletion");
  assert(occ.depletionApplied(result.occurrence), "depletionApplied is true after Taken");
  assert(snapshotEqual(before, emptySnapshot()), "caller snapshot is not mutated on success");
})();

(function doubleTapTakenNoop() {
  const persist = recordingPersist();
  const first = occ.markTaken(emptySnapshot(), identity(), persist.persist);
  const secondPersist = recordingPersist();
  const second = occ.markTaken(first.snapshot, identity(), secondPersist.persist);
  assert(second.ok === true && second.noop === true, "double-tap Taken is a no-op success");
  assertEqual(secondPersist.commits.length, 0, "double-tap Taken does not persist again");
  assertEqual(second.fill.depletionRemaining, 28, "double-tap does not decrement depletion a second time");
  assertEqual(second.occurrence.appliedDepletionAmount, 2, "double-tap leaves snapshot amount unchanged");
  assertEqual(second.occurrence.appliedDepletionUnit, "mg", "double-tap leaves snapshot unit unchanged");
  assertEqual(second.occurrence.takenAt, NOW, "double-tap leaves takenAt unchanged");
})();

(function undoUsesSnapshotNotEditedDose() {
  const persist = recordingPersist();
  const taken = occ.markTaken(emptySnapshot(), identity(), persist.persist);
  const edited = {
    occurrences: taken.snapshot.occurrences.map((row) => ({ ...row })),
    fills: taken.snapshot.fills.map((row) => ({ ...row, desiredDose: 5 })),
  };
  const undone = occ.undoTaken(
    edited,
    { scheduleId: SCHEDULE_ID, localCivilDate: DATE, fillId: FILL_ID, nowIso: LATER },
    persist.persist
  );
  assert(undone.ok === true && undone.noop === false, "Undo after desiredDose edit succeeds");
  assertEqual(undone.occurrence.status, "pending", "Undo returns status to pending");
  assertEqual(undone.occurrence.takenAt, null, "Undo clears takenAt");
  assertEqual(undone.occurrence.appliedDepletionAmount, null, "Undo clears snapshot amount in the same commit");
  assertEqual(undone.occurrence.appliedDepletionUnit, null, "Undo clears snapshot unit in the same commit");
  assertEqual(undone.occurrence.appliedFillId, null, "Undo clears appliedFillId in the same commit");
  assertEqual(undone.fill.depletionRemaining, 30, "Undo restores snapshotted 2 mg, not edited 5 mg");
  assertEqual(undone.fill.desiredDose, 5, "Undo does not rewrite the edited desiredDose");
})();

(function takenPersistFailureRetainsState() {
  const before = emptySnapshot();
  const result = occ.markTaken(before, identity(), throwingPersist().persist);
  assert(result.ok === false && result.code === "PERSIST_FAILED", "Taken persist failure is surfaced");
  assertEqual(result.snapshot.occurrences.length, 0, "Taken persist failure keeps no occurrence");
  assertEqual(result.snapshot.fills[0].depletionRemaining, 30, "Taken persist failure keeps fill depletion");
  assert(snapshotEqual(before, emptySnapshot()), "Taken persist failure does not mutate caller state");
})();

(function undoPersistFailureRetainsState() {
  const taken = occ.markTaken(emptySnapshot(), identity(), recordingPersist().persist);
  const beforeUndo = occ.reloadSnapshot(taken.snapshot);
  const result = occ.undoTaken(
    beforeUndo,
    { scheduleId: SCHEDULE_ID, localCivilDate: DATE, fillId: FILL_ID, nowIso: LATER },
    throwingPersist().persist
  );
  assert(result.ok === false && result.code === "PERSIST_FAILED", "Undo persist failure is surfaced");
  assertEqual(result.snapshot.occurrences[0].status, "taken", "Undo persist failure keeps status=taken");
  assertEqual(result.snapshot.occurrences[0].appliedDepletionAmount, 2, "Undo persist failure keeps snapshot");
  assertEqual(result.snapshot.fills[0].depletionRemaining, 28, "Undo persist failure keeps depleted remaining");
  assertEqual(beforeUndo.occurrences[0].status, "taken", "Undo persist failure does not mutate caller occurrence");
  assertEqual(beforeUndo.fills[0].depletionRemaining, 28, "Undo persist failure does not mutate caller fill");
})();

(function exactUnitMismatchFailClosed() {
  const mismatch = emptySnapshot({ unit: "mg", depletionUnit: "IU" });
  const taken = occ.markTaken(mismatch, identity(), recordingPersist().persist);
  assert(taken.ok === false && taken.code === "UNIT_MISMATCH", "Taken fail-closes on exact unit mismatch");
  assertEqual(taken.snapshot.occurrences.length, 0, "unit mismatch Taken inserts no occurrence");
  assertEqual(taken.snapshot.fills[0].depletionRemaining, 30, "unit mismatch Taken does not change depletion");

  const unsupported = emptySnapshot({ unit: "mL", depletionUnit: "mL" });
  const unsupportedResult = occ.markTaken(unsupported, identity(), recordingPersist().persist);
  assert(
    unsupportedResult.ok === false && unsupportedResult.code === "UNSUPPORTED_UNIT",
    "Taken fail-closes on unsupported unit"
  );
  assertEqual(unsupportedResult.snapshot.fills[0].depletionRemaining, 30, "unsupported unit does not change depletion");

  const takenOk = occ.markTaken(emptySnapshot(), identity(), recordingPersist().persist);
  const fillUnitChanged = {
    occurrences: takenOk.snapshot.occurrences.map((row) => ({ ...row })),
    fills: takenOk.snapshot.fills.map((row) => ({ ...row, depletionUnit: "IU" })),
  };
  const undoMismatch = occ.undoTaken(
    fillUnitChanged,
    { scheduleId: SCHEDULE_ID, localCivilDate: DATE, fillId: FILL_ID, nowIso: LATER },
    recordingPersist().persist
  );
  assert(undoMismatch.ok === false && undoMismatch.code === "UNIT_MISMATCH", "Undo fail-closes when fill unit no longer matches snapshot");
  assertEqual(undoMismatch.snapshot.occurrences[0].status, "taken", "Undo unit mismatch keeps taken status");
  assertEqual(undoMismatch.snapshot.fills[0].depletionRemaining, 28, "Undo unit mismatch does not restore depletion");
})();

(function legacyExplicitDatesOnly() {
  const sourceTakenDates = ["2026-09-01", "2026-09-08", "not-a-date", 20260908];
  const schedule = {
    id: SCHEDULE_ID,
    timeZone: TZ,
    takenDates: sourceTakenDates,
    startDate: "2026-08-01",
    intervalDays: 1,
  };
  const first = occ.materializeLegacyTakenDates([], schedule, NOW);
  assertEqual(first.materializedDates.join(","), "2026-09-01,2026-09-08", "legacy materializes only explicit recoverable dates");
  assertEqual(first.records.length, 2, "legacy creates one record per explicit date");
  assert(
    first.records.every((row) => row.status === "taken" && row.appliedDepletionAmount === null),
    "legacy taken dates do not invent a depletion snapshot"
  );
  assert(first.sourceTakenDates === sourceTakenDates, "legacy preserves the source takenDates array");
  assertEqual(sourceTakenDates.length, 4, "legacy does not rewrite or shrink source takenDates");

  const rebuilt = occ.materializeLegacyTakenDates(first.records, schedule, LATER);
  assertEqual(rebuilt.records.length, 2, "legacy rematerialize does not add a second row per date");
  assertEqual(rebuilt.records[0].id, first.records[0].id, "legacy rematerialize keeps stable ids");

  const emptyLegacy = occ.materializeLegacyTakenDates(
    [],
    { id: SCHEDULE_ID, timeZone: TZ, startDate: "2026-01-01", intervalDays: 1 },
    NOW
  );
  assertEqual(emptyLegacy.records.length, 0, "absent takenDates does not invent interval history (C9)");

  const emptyArray = occ.materializeLegacyTakenDates(
    [],
    { id: SCHEDULE_ID, timeZone: TZ, takenDates: [], startDate: "2026-01-01", intervalDays: 7 },
    NOW
  );
  assertEqual(emptyArray.records.length, 0, "empty takenDates does not invent missing days");
})();

(function restartSafeUndo() {
  const taken = occ.markTaken(emptySnapshot(), identity(), recordingPersist().persist);
  const restarted = occ.reloadSnapshot(taken.snapshot);
  assertEqual(restarted.occurrences[0].appliedDepletionAmount, 2, "restart still has the persisted snapshot");
  const undone = occ.undoTaken(
    restarted,
    { scheduleId: SCHEDULE_ID, localCivilDate: DATE, fillId: FILL_ID, nowIso: LATER },
    recordingPersist().persist
  );
  assert(undone.ok === true, "Undo after restart succeeds from persisted state");
  assertEqual(undone.occurrence.status, "pending", "restart Undo returns pending");
  assertEqual(undone.fill.depletionRemaining, 30, "restart Undo restores snapshotted depletion");
  assertEqual(undone.occurrence.appliedDepletionAmount, null, "restart Undo clears snapshot after commit");
  assertEqual(undone.occurrence.appliedFillId, null, "restart Undo clears appliedFillId after commit");
  assertEqual(undone.fill.id, FILL_ID, "restart Undo restores the originally debited fill");
})();

(function appliedFillIdRejectsWrongFill() {
  const taken = occ.markTaken(emptySnapshot(), identity(), recordingPersist().persist);
  const otherFill = baseFill({ id: "fill-other", depletionRemaining: 40 });
  const twoFills = {
    occurrences: taken.snapshot.occurrences.map((row) => ({ ...row })),
    fills: [...taken.snapshot.fills.map((row) => ({ ...row })), otherFill],
  };
  const persist = recordingPersist();
  const wrong = occ.undoTaken(
    twoFills,
    { scheduleId: SCHEDULE_ID, localCivilDate: DATE, fillId: "fill-other", nowIso: LATER },
    persist.persist
  );
  assert(wrong.ok === false && wrong.code === "FILL_MISMATCH", "Undo fail-closes when caller fillId is not appliedFillId");
  assertEqual(persist.commits.length, 0, "wrong-fill Undo does not persist");
  assertEqual(wrong.snapshot.fills.find((row) => row.id === FILL_ID).depletionRemaining, 28, "originally debited fill is unchanged");
  assertEqual(wrong.snapshot.fills.find((row) => row.id === "fill-other").depletionRemaining, 40, "other same-unit fill does not receive restored depletion");
  assertEqual(wrong.snapshot.occurrences[0].status, "taken", "wrong-fill Undo keeps taken status");
  assertEqual(wrong.snapshot.occurrences[0].appliedFillId, FILL_ID, "wrong-fill Undo keeps appliedFillId");
  assert(snapshotEqual(twoFills.fills, wrong.snapshot.fills), "wrong-fill Undo does not mutate caller fills");

  const restarted = occ.reloadSnapshot(twoFills);
  const restored = occ.undoTaken(
    restarted,
    { scheduleId: SCHEDULE_ID, localCivilDate: DATE, nowIso: LATER },
    recordingPersist().persist
  );
  assert(restored.ok === true, "restart Undo without caller fillId uses stored appliedFillId");
  assertEqual(restored.fill.id, FILL_ID, "restart Undo credits the originally debited fill");
  assertEqual(restored.fill.depletionRemaining, 30, "restart Undo restores snapshot onto the bound fill");
  assertEqual(
    restored.snapshot.fills.find((row) => row.id === "fill-other").depletionRemaining,
    40,
    "restart Undo does not credit a different fill"
  );
})();

function duplicateRows() {
  const shared = {
    scheduleId: SCHEDULE_ID,
    localCivilDate: DATE,
    timeZone: TZ,
    status: "pending",
    takenAt: null,
    appliedDepletionAmount: null,
    appliedDepletionUnit: null,
    appliedFillId: null,
    updatedAt: NOW,
  };
  return [
    { ...shared, id: "occ-dup-a" },
    { ...shared, id: "occ-dup-b" },
  ];
}

(function duplicateIdentityFailClosed() {
  const dupRecords = duplicateRows();
  const materialized = occ.materializeOccurrence(dupRecords, {
    scheduleId: SCHEDULE_ID,
    localCivilDate: DATE,
    timeZone: TZ,
    nowIso: NOW,
  });
  assert(materialized.ok === false && materialized.code === "DUPLICATE_IDENTITY", "materialize fail-closes on duplicate logical identity");
  assertEqual(materialized.records.length, 2, "duplicate materialize does not discard a record");
  assertEqual(materialized.records[0].id, "occ-dup-a", "duplicate materialize keeps first row");
  assertEqual(materialized.records[1].id, "occ-dup-b", "duplicate materialize keeps second row");

  const before = { occurrences: dupRecords, fills: [baseFill()] };
  const takenPersist = recordingPersist();
  const taken = occ.markTaken(before, identity(), takenPersist.persist);
  assert(taken.ok === false && taken.code === "DUPLICATE_IDENTITY", "Taken fail-closes on duplicate logical identity");
  assertEqual(takenPersist.commits.length, 0, "duplicate Taken does not persist");
  assertEqual(taken.snapshot.fills[0].depletionRemaining, 30, "duplicate Taken does not change depletion");
  assert(snapshotEqual(before, { occurrences: dupRecords, fills: [baseFill()] }), "duplicate Taken leaves caller state unchanged");

  const takenDup = duplicateRows().map((row, index) => ({
    ...row,
    status: "taken",
    takenAt: NOW,
    appliedDepletionAmount: 2,
    appliedDepletionUnit: "mg",
    appliedFillId: FILL_ID,
    id: index === 0 ? "occ-dup-taken-a" : "occ-dup-taken-b",
  }));
  const undoBefore = { occurrences: takenDup, fills: [baseFill({ depletionRemaining: 28 })] };
  const undoPersist = recordingPersist();
  const undone = occ.undoTaken(
    undoBefore,
    { scheduleId: SCHEDULE_ID, localCivilDate: DATE, fillId: FILL_ID, nowIso: LATER },
    undoPersist.persist
  );
  assert(undone.ok === false && undone.code === "DUPLICATE_IDENTITY", "Undo fail-closes on duplicate logical identity");
  assertEqual(undoPersist.commits.length, 0, "duplicate Undo does not persist");
  assertEqual(undone.snapshot.fills[0].depletionRemaining, 28, "duplicate Undo does not restore depletion");
  assertEqual(undone.snapshot.occurrences.length, 2, "duplicate Undo does not discard a record");
})();

(function civilDateZoneInstantValidation() {
  assertEqual(occ.normalizeLocalCivilDate("2024-02-29"), "2024-02-29", "leap day 2024-02-29 is a real civil date");
  assertEqual(occ.normalizeLocalCivilDate("2000-02-29"), "2000-02-29", "leap day 2000-02-29 is a real civil date");
  assertEqual(occ.normalizeLocalCivilDate("2026-01-01"), "2026-01-01", "year boundary 2026-01-01 is valid");
  assertEqual(occ.normalizeLocalCivilDate("2026-12-31"), "2026-12-31", "year boundary 2026-12-31 is valid");
  assertEqual(occ.normalizeLocalCivilDate("2026-02-29"), null, "non-leap 2026-02-29 is rejected");
  assertEqual(occ.normalizeLocalCivilDate("2026-04-31"), null, "impossible 2026-04-31 is rejected");
  assertEqual(occ.normalizeLocalCivilDate("2026-99-99"), null, "impossible 2026-99-99 is rejected");
  assertEqual(occ.normalizeIanaTimeZone("America/New_York"), "America/New_York", "IANA America/New_York is accepted");
  assertEqual(occ.normalizeIanaTimeZone("UTC"), "UTC", "IANA UTC is accepted");
  assertEqual(occ.normalizeIanaTimeZone("Not/AZone"), null, "unknown zone is rejected");
  assertEqual(occ.normalizeIanaTimeZone(""), null, "empty zone is rejected");
  assertEqual(occ.normalizeIsoInstant(NOW), NOW, "ISO instant with Z is accepted");
  assertEqual(occ.normalizeIsoInstant("2026-09-08T15:00:00+00:00"), "2026-09-08T15:00:00+00:00", "ISO instant with offset is accepted");
  assertEqual(occ.normalizeIsoInstant("2026-09-08"), null, "date-only string is not an instant");
  assertEqual(occ.normalizeIsoInstant("not-an-instant"), null, "invalid instant is rejected");

  const leap = occ.materializeOccurrence([], {
    scheduleId: SCHEDULE_ID,
    localCivilDate: "2024-02-29",
    timeZone: TZ,
    nowIso: NOW,
  });
  assert(leap.ok === true && leap.record.localCivilDate === "2024-02-29", "materialize accepts leap day");

  const before = emptySnapshot();
  const persist = recordingPersist();
  const badDate = occ.markTaken(
    before,
    { ...identity(), localCivilDate: "2026-02-29" },
    persist.persist
  );
  assert(badDate.ok === false && badDate.code === "INVALID_IDENTITY", "Taken fail-closes on impossible civil date");
  assertEqual(persist.commits.length, 0, "impossible-date Taken does not persist");
  assert(snapshotEqual(before, emptySnapshot()), "impossible-date Taken does not mutate caller state");

  const badZonePersist = recordingPersist();
  const badZone = occ.markTaken(
    before,
    { ...identity(), timeZone: "Not/AZone" },
    badZonePersist.persist
  );
  assert(badZone.ok === false && badZone.code === "INVALID_TIMEZONE", "Taken fail-closes on invalid IANA zone");
  assertEqual(badZonePersist.commits.length, 0, "invalid-zone Taken does not persist");
  assert(snapshotEqual(before, emptySnapshot()), "invalid-zone Taken does not mutate caller state");

  const badInstantPersist = recordingPersist();
  const badInstant = occ.markTaken(
    before,
    { ...identity(), nowIso: "2026-09-08" },
    badInstantPersist.persist
  );
  assert(badInstant.ok === false && badInstant.code === "INVALID_INSTANT", "Taken fail-closes on invalid ISO instant");
  assertEqual(badInstantPersist.commits.length, 0, "invalid-instant Taken does not persist");
  assert(snapshotEqual(before, emptySnapshot()), "invalid-instant Taken does not mutate caller state");

  const taken = occ.markTaken(emptySnapshot(), identity(), recordingPersist().persist);
  const undoBadInstantPersist = recordingPersist();
  const undoBadInstant = occ.undoTaken(
    taken.snapshot,
    { scheduleId: SCHEDULE_ID, localCivilDate: DATE, fillId: FILL_ID, nowIso: "not-an-instant" },
    undoBadInstantPersist.persist
  );
  assert(undoBadInstant.ok === false && undoBadInstant.code === "INVALID_INSTANT", "Undo fail-closes on invalid ISO instant");
  assertEqual(undoBadInstantPersist.commits.length, 0, "invalid-instant Undo does not persist");
  assertEqual(undoBadInstant.snapshot.occurrences[0].status, "taken", "invalid-instant Undo keeps taken status");
})();

(function lookupPrecedesCreate() {
  const pending = occ.materializeOccurrence([], {
    scheduleId: SCHEDULE_ID,
    localCivilDate: DATE,
    timeZone: TZ,
    nowIso: NOW,
  });
  const taken = occ.markTaken(
    { occurrences: pending.records, fills: [baseFill()] },
    identity(),
    recordingPersist().persist
  );
  const again = occ.materializeOccurrence(taken.snapshot.occurrences, {
    scheduleId: SCHEDULE_ID,
    localCivilDate: DATE,
    timeZone: TZ,
    nowIso: LATER,
  });
  assertEqual(again.record.id, taken.occurrence.id, "lookup returns the taken row instead of creating pending");
  assertEqual(again.record.status, "taken", "lookup does not reset taken status");
  assertEqual(
    occ.deterministicOccurrenceId(SCHEDULE_ID, DATE),
    pending.record.id,
    "default surrogate id is deterministic for the pair"
  );
})();

console.log(`P0.OCC FR-SCH-000: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
