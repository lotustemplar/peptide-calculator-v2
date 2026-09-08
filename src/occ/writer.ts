import { lookupOccurrence, materializeOccurrence, replaceOccurrence } from "./identity";
import {
  cloneSnapshot,
  depletionApplied,
  isSupportedDepletionUnit,
  type FillDepletionRecord,
  type OccurrenceRecord,
  type OccurrenceStoreSnapshot,
  type SupportedDepletionUnit,
  type WriterFailure,
  type WriterResult,
} from "./types";

export type PersistCommit = (snapshot: OccurrenceStoreSnapshot) => void;

export interface TakenInput {
  scheduleId: string;
  localCivilDate: string;
  timeZone: string;
  fillId: string;
  nowIso: string;
  createId?: () => string;
}

export interface UndoInput {
  scheduleId: string;
  localCivilDate: string;
  fillId: string;
  nowIso: string;
}

function fail(
  snapshot: OccurrenceStoreSnapshot,
  code: WriterFailure["code"],
  message: string
): WriterFailure {
  return {
    ok: false,
    code,
    message,
    snapshot: cloneSnapshot(snapshot),
  };
}

function findFill(
  fills: readonly FillDepletionRecord[],
  fillId: string
): FillDepletionRecord | null {
  return fills.find((row) => row.id === fillId) ?? null;
}

function replaceFill(
  fills: readonly FillDepletionRecord[],
  next: FillDepletionRecord
): FillDepletionRecord[] {
  return fills.map((row) => (row.id === next.id ? { ...next } : { ...row }));
}

/**
 * Units must already match exactly. No mg↔mcg or IU↔mass inference (DEC-UNIT locked).
 */
export function assertExactDepletionUnits(
  snapshotUnit: unknown,
  fillDepletionUnit: unknown
): { ok: true; unit: SupportedDepletionUnit } | { ok: false; code: "UNSUPPORTED_UNIT" | "UNIT_MISMATCH" } {
  if (!isSupportedDepletionUnit(snapshotUnit) || !isSupportedDepletionUnit(fillDepletionUnit)) {
    return { ok: false, code: "UNSUPPORTED_UNIT" };
  }
  if (snapshotUnit !== fillDepletionUnit) {
    return { ok: false, code: "UNIT_MISMATCH" };
  }
  return { ok: true, unit: snapshotUnit };
}

function finishSuccess(
  before: OccurrenceStoreSnapshot,
  candidate: OccurrenceStoreSnapshot,
  occurrence: OccurrenceRecord,
  fill: FillDepletionRecord,
  persist: PersistCommit,
  noop: boolean
): WriterResult {
  if (noop) {
    return {
      ok: true,
      noop: true,
      snapshot: cloneSnapshot(before),
      occurrence: { ...occurrence },
      fill: { ...fill },
    };
  }
  try {
    const serialized = JSON.stringify(candidate);
    persist(JSON.parse(serialized) as OccurrenceStoreSnapshot);
  } catch {
    return fail(before, "PERSIST_FAILED", "persistence failed; pre-operation state retained");
  }
  return {
    ok: true,
    noop: false,
    snapshot: cloneSnapshot(candidate),
    occurrence: { ...occurrence },
    fill: { ...fill },
  };
}

/**
 * First Taken snapshots fill.desiredDose + unit once and decrements depletion
 * by that same amount/unit in one commit. Repeat Taken is a no-op.
 */
export function markTaken(
  snapshot: OccurrenceStoreSnapshot,
  input: TakenInput,
  persist: PersistCommit
): WriterResult {
  const before = cloneSnapshot(snapshot);
  let materialized: ReturnType<typeof materializeOccurrence>;
  try {
    materialized = materializeOccurrence(before.occurrences, {
      scheduleId: input.scheduleId,
      localCivilDate: input.localCivilDate,
      timeZone: input.timeZone,
      nowIso: input.nowIso,
      createId: input.createId,
    });
  } catch {
    return fail(before, "INVALID_IDENTITY", "scheduleId/localCivilDate/timeZone invalid");
  }

  const fill = findFill(before.fills, input.fillId);
  if (!fill) {
    return fail(before, "NOT_FOUND", "fill not found");
  }

  if (materialized.record.status === "taken") {
    return finishSuccess(before, before, materialized.record, fill, persist, true);
  }

  if (!Number.isFinite(fill.desiredDose) || fill.desiredDose <= 0) {
    return fail(before, "INVALID_DOSE", "desiredDose must be a finite number > 0");
  }
  if (!Number.isFinite(fill.depletionRemaining)) {
    return fail(before, "INVALID_DOSE", "depletionRemaining must be a finite number");
  }

  const unitCheck = assertExactDepletionUnits(fill.unit, fill.depletionUnit);
  if (!unitCheck.ok) {
    return fail(
      before,
      unitCheck.code,
      unitCheck.code === "UNIT_MISMATCH"
        ? "occurrence snapshot unit and fill depletion unit do not match"
        : "unsupported depletion unit; no conversion is applied"
    );
  }

  const taken: OccurrenceRecord = {
    ...materialized.record,
    status: "taken",
    takenAt: input.nowIso,
    appliedDepletionAmount: fill.desiredDose,
    appliedDepletionUnit: unitCheck.unit,
    updatedAt: input.nowIso,
  };

  const nextFill: FillDepletionRecord = {
    ...fill,
    depletionRemaining: Number(fill.depletionRemaining) - fill.desiredDose,
  };

  const candidate: OccurrenceStoreSnapshot = {
    occurrences: replaceOccurrence(materialized.records, taken),
    fills: replaceFill(before.fills, nextFill),
  };

  return finishSuccess(before, candidate, taken, nextFill, persist, false);
}

/**
 * Undo restores the persisted snapshot amount/unit (not a later desiredDose edit),
 * returns status to pending, and clears the snapshot in the same commit.
 */
export function undoTaken(
  snapshot: OccurrenceStoreSnapshot,
  input: UndoInput,
  persist: PersistCommit
): WriterResult {
  const before = cloneSnapshot(snapshot);
  const existing = lookupOccurrence(before.occurrences, input.scheduleId, input.localCivilDate);
  if (!existing) {
    return fail(before, "NOT_FOUND", "occurrence not found");
  }

  const fill = findFill(before.fills, input.fillId);
  if (!fill) {
    return fail(before, "NOT_FOUND", "fill not found");
  }

  if (existing.status !== "taken") {
    return finishSuccess(before, before, existing, fill, persist, true);
  }

  const snapshotAmount = existing.appliedDepletionAmount;
  const snapshotUnit = existing.appliedDepletionUnit;
  if (!depletionApplied(existing) || snapshotAmount === null || snapshotUnit === null) {
    return fail(before, "INVALID_SNAPSHOT", "taken occurrence has no restorable depletion snapshot");
  }

  const unitCheck = assertExactDepletionUnits(snapshotUnit, fill.depletionUnit);
  if (!unitCheck.ok) {
    return fail(
      before,
      unitCheck.code,
      unitCheck.code === "UNIT_MISMATCH"
        ? "stored snapshot unit and fill depletion unit do not match"
        : "unsupported depletion unit; no conversion is applied"
    );
  }

  if (!Number.isFinite(fill.depletionRemaining)) {
    return fail(before, "INVALID_DOSE", "depletionRemaining must be a finite number");
  }

  const pending: OccurrenceRecord = {
    ...existing,
    status: "pending",
    takenAt: null,
    appliedDepletionAmount: null,
    appliedDepletionUnit: null,
    updatedAt: input.nowIso,
  };

  const nextFill: FillDepletionRecord = {
    ...fill,
    depletionRemaining: Number(fill.depletionRemaining) + snapshotAmount,
  };

  const candidate: OccurrenceStoreSnapshot = {
    occurrences: replaceOccurrence(before.occurrences, pending),
    fills: replaceFill(before.fills, nextFill),
  };

  return finishSuccess(before, candidate, pending, nextFill, persist, false);
}

/** Restart helper: JSON round-trip is the only surviving state. */
export function reloadSnapshot(snapshot: OccurrenceStoreSnapshot): OccurrenceStoreSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as OccurrenceStoreSnapshot;
}
