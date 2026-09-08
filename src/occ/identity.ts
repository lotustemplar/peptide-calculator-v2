import {
  cloneOccurrences,
  type OccurrenceRecord,
} from "./types";
import {
  normalizeIanaTimeZone,
  normalizeIsoInstant,
  normalizeLocalCivilDate,
  normalizeScheduleId,
} from "./validate";

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

export interface MaterializeSuccess {
  ok: true;
  record: OccurrenceRecord;
  records: OccurrenceRecord[];
  created: boolean;
}

export interface MaterializeFailure {
  ok: false;
  code: "DUPLICATE_IDENTITY" | "INVALID_IDENTITY" | "INVALID_TIMEZONE" | "INVALID_INSTANT";
  message: string;
  records: OccurrenceRecord[];
}

export type MaterializeResult = MaterializeSuccess | MaterializeFailure;

export { normalizeIanaTimeZone, normalizeIsoInstant, normalizeLocalCivilDate, normalizeScheduleId };

/** Logical identity key for uniqueness: (scheduleId, localCivilDate). */
export function occurrenceIdentityKey(scheduleId: string, localCivilDate: string): string {
  return `${scheduleId}\u001f${localCivilDate}`;
}

/** Surrogate assigned once. Deterministic so rematerialization cannot mint a second id. */
export function deterministicOccurrenceId(scheduleId: string, localCivilDate: string): string {
  return `occ:${scheduleId}:${localCivilDate}`;
}

export function findDuplicateIdentity(
  records: readonly OccurrenceRecord[]
): { scheduleId: string; localCivilDate: string } | null {
  const seen = new Set<string>();
  for (const row of records) {
    const key = occurrenceIdentityKey(row.scheduleId, row.localCivilDate);
    if (seen.has(key)) {
      return { scheduleId: row.scheduleId, localCivilDate: row.localCivilDate };
    }
    seen.add(key);
  }
  return null;
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
 * Fail-closed if the input already contains duplicate logical identities.
 */
export function materializeOccurrence(
  records: readonly OccurrenceRecord[],
  input: MaterializeInput
): MaterializeResult {
  const unchanged = cloneOccurrences(records);
  const duplicate = findDuplicateIdentity(records);
  if (duplicate) {
    return {
      ok: false,
      code: "DUPLICATE_IDENTITY",
      message: `duplicate occurrence identity (${duplicate.scheduleId}, ${duplicate.localCivilDate})`,
      records: unchanged,
    };
  }

  const scheduleId = normalizeScheduleId(input.scheduleId);
  const localCivilDate = normalizeLocalCivilDate(input.localCivilDate);
  if (!scheduleId || !localCivilDate) {
    return {
      ok: false,
      code: "INVALID_IDENTITY",
      message: "scheduleId/localCivilDate is not a real identity pair",
      records: unchanged,
    };
  }

  const timeZone = normalizeIanaTimeZone(input.timeZone);
  if (!timeZone) {
    return {
      ok: false,
      code: "INVALID_TIMEZONE",
      message: "timeZone is not a valid IANA identifier",
      records: unchanged,
    };
  }

  const nowIso = normalizeIsoInstant(input.nowIso);
  if (!nowIso) {
    return {
      ok: false,
      code: "INVALID_INSTANT",
      message: "nowIso is not a valid ISO-8601 instant",
      records: unchanged,
    };
  }

  const existing = lookupOccurrence(records, scheduleId, localCivilDate);
  if (existing) {
    return {
      ok: true,
      record: { ...existing },
      records: unchanged,
      created: false,
    };
  }

  const id = input.createId ? input.createId() : deterministicOccurrenceId(scheduleId, localCivilDate);
  const record: OccurrenceRecord = {
    id,
    scheduleId,
    localCivilDate,
    timeZone,
    status: "pending",
    takenAt: null,
    appliedDepletionAmount: null,
    appliedDepletionUnit: null,
    appliedFillId: null,
    updatedAt: nowIso,
  };

  return {
    ok: true,
    record: { ...record },
    records: [...unchanged, { ...record }],
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
