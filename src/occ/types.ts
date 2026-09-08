/**
 * P0.OCC / FR-SCH-000 / Spec §6.5 OccurrenceRecord.
 * P0 statuses only: pending | taken (undo → pending).
 * Skip / Snooze / Reschedule remain P1 (FR-SCH-001).
 */

export const SUPPORTED_DEPLETION_UNITS = ["mg", "mcg", "IU"] as const;
export type SupportedDepletionUnit = (typeof SUPPORTED_DEPLETION_UNITS)[number];

export const P0_OCCURRENCE_STATUSES = ["pending", "taken"] as const;
export type P0OccurrenceStatus = (typeof P0_OCCURRENCE_STATUSES)[number];

export const LOCAL_CIVIL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface OccurrenceRecord {
  id: string;
  scheduleId: string;
  localCivilDate: string;
  timeZone: string;
  status: P0OccurrenceStatus;
  takenAt: string | null;
  appliedDepletionAmount: number | null;
  appliedDepletionUnit: SupportedDepletionUnit | null;
  updatedAt: string;
}

/** Narrow fill view for occurrence+depletion only. Not a full FillRecord. */
export interface FillDepletionRecord {
  id: string;
  desiredDose: number;
  unit: string;
  depletionRemaining: number | null;
  /** Unit of depletionRemaining. Must match snapshot unit exactly; no conversion. */
  depletionUnit: string;
}

export interface OccurrenceStoreSnapshot {
  occurrences: OccurrenceRecord[];
  fills: FillDepletionRecord[];
}

export type WriterFailureCode =
  | "NOT_FOUND"
  | "INVALID_IDENTITY"
  | "UNSUPPORTED_UNIT"
  | "UNIT_MISMATCH"
  | "INVALID_DOSE"
  | "INVALID_SNAPSHOT"
  | "PERSIST_FAILED";

export interface WriterSuccess {
  ok: true;
  noop: boolean;
  snapshot: OccurrenceStoreSnapshot;
  occurrence: OccurrenceRecord;
  fill: FillDepletionRecord | null;
}

export interface WriterFailure {
  ok: false;
  code: WriterFailureCode;
  message: string;
  snapshot: OccurrenceStoreSnapshot;
}

export type WriterResult = WriterSuccess | WriterFailure;

export function isSupportedDepletionUnit(value: unknown): value is SupportedDepletionUnit {
  return (
    typeof value === "string" &&
    (SUPPORTED_DEPLETION_UNITS as readonly string[]).includes(value)
  );
}

/** Derived §6.5 flag: true iff appliedDepletionAmount is finite > 0. */
export function depletionApplied(record: OccurrenceRecord): boolean {
  return Number.isFinite(record.appliedDepletionAmount) && Number(record.appliedDepletionAmount) > 0;
}

export function cloneSnapshot(snapshot: OccurrenceStoreSnapshot): OccurrenceStoreSnapshot {
  return {
    occurrences: snapshot.occurrences.map((row) => ({ ...row })),
    fills: snapshot.fills.map((row) => ({ ...row })),
  };
}

export function cloneOccurrence(record: OccurrenceRecord): OccurrenceRecord {
  return { ...record };
}
