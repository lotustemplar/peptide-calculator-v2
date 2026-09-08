import {
  LOCAL_CIVIL_DATE_RE,
  type OccurrenceRecord,
} from "./types";

export interface MaterializeInput {
  scheduleId: string;
  localCivilDate: string;
  timeZone: string;
  nowIso: string;
  /**
   * Used only when no record exists yet. Ignored on rematerialization.
   * Default is a deterministic key from the logical pair.
   */
  createId?: () => string;
}

export interface MaterializeResult {
  record: OccurrenceRecord;
  records: OccurrenceRecord[];
  created: boolean;
}

export function normalizeScheduleId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeLocalCivilDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return LOCAL_CIVIL_DATE_RE.test(trimmed) ? trimmed : null;
}

/** Logical identity key for uniqueness: (scheduleId, localCivilDate). */
export function occurrenceIdentityKey(scheduleId: string, localCivilDate: string): string {
  return `${scheduleId}\u001f${localCivilDate}`;
}

/** Surrogate assigned once. Deterministic so rematerialization cannot mint a second id. */
export function deterministicOccurrenceId(scheduleId: string, localCivilDate: string): string {
  return `occ:${scheduleId}:${localCivilDate}`;
}

export function lookupOccurrence(
  records: readonly OccurrenceRecord[],
  scheduleId: unknown,
  localCivilDate: unknown
): OccurrenceRecord | null {
  const sid = normalizeScheduleId(scheduleId);
  const date = normalizeLocalCivilDate(localCivilDate);
  if (!sid || !date) {
    return null;
  }
  return (
    records.find((row) => row.scheduleId === sid && row.localCivilDate === date) ?? null
  );
}

export function countIdentityMatches(
  records: readonly OccurrenceRecord[],
  scheduleId: string,
  localCivilDate: string
): number {
  const key = occurrenceIdentityKey(scheduleId, localCivilDate);
  return records.filter(
    (row) => occurrenceIdentityKey(row.scheduleId, row.localCivilDate) === key
  ).length;
}

/**
 * Lookup-first materialization. Never inserts a second row for the same pair.
 * Reuses the persisted surrogate id after rebuild / restart.
 */
export function materializeOccurrence(
  records: readonly OccurrenceRecord[],
  input: MaterializeInput
): MaterializeResult {
  const scheduleId = normalizeScheduleId(input.scheduleId);
  const localCivilDate = normalizeLocalCivilDate(input.localCivilDate);
  if (!scheduleId || !localCivilDate) {
    throw new Error("INVALID_IDENTITY");
  }
  if (typeof input.timeZone !== "string" || input.timeZone.trim().length === 0) {
    throw new Error("INVALID_IDENTITY");
  }

  const existing = lookupOccurrence(records, scheduleId, localCivilDate);
  if (existing) {
    return {
      record: { ...existing },
      records: records.map((row) => ({ ...row })),
      created: false,
    };
  }

  const id = input.createId ? input.createId() : deterministicOccurrenceId(scheduleId, localCivilDate);
  const record: OccurrenceRecord = {
    id,
    scheduleId,
    localCivilDate,
    timeZone: input.timeZone,
    status: "pending",
    takenAt: null,
    appliedDepletionAmount: null,
    appliedDepletionUnit: null,
    updatedAt: input.nowIso,
  };

  return {
    record: { ...record },
    records: [...records.map((row) => ({ ...row })), { ...record }],
    created: true,
  };
}

export function replaceOccurrence(
  records: readonly OccurrenceRecord[],
  next: OccurrenceRecord
): OccurrenceRecord[] {
  const key = occurrenceIdentityKey(next.scheduleId, next.localCivilDate);
  let replaced = false;
  const out = records.map((row) => {
    if (occurrenceIdentityKey(row.scheduleId, row.localCivilDate) === key) {
      replaced = true;
      return { ...next };
    }
    return { ...row };
  });
  if (!replaced) {
    out.push({ ...next });
  }
  return out;
}
