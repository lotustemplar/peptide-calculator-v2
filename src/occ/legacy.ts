import { materializeOccurrence, normalizeLocalCivilDate, replaceOccurrence } from "./identity";
import { cloneOccurrences, type OccurrenceRecord } from "./types";

export interface LegacyScheduleSource {
  id: string;
  timeZone: string;
  takenDates?: unknown;
}

export interface LegacyMaterializeResult {
  ok: boolean;
  records: OccurrenceRecord[];
  /** Original source value, never rewritten. */
  sourceTakenDates: unknown;
  materializedDates: string[];
  code?: string;
}

/**
 * Collect YYYY-MM-DD strings that are explicitly present on a legacy takenDates array.
 * Does not infer interval history, startDate spans, or missing days (C9).
 */
export function explicitLegacyTakenDates(takenDates: unknown): string[] {
  if (!Array.isArray(takenDates)) {
    return [];
  }
  const seen = new Set<string>();
  const dates: string[] = [];
  for (const value of takenDates) {
    const date = normalizeLocalCivilDate(value);
    if (!date || seen.has(date)) {
      continue;
    }
    seen.add(date);
    dates.push(date);
  }
  return dates;
}

/**
 * Materialize only dates explicitly present in recoverable legacy takenDates.
 * Preserves the source array; never deletes, rewrites, or invents history.
 */
export function materializeLegacyTakenDates(
  records: readonly OccurrenceRecord[],
  schedule: LegacyScheduleSource,
  nowIso: string
): LegacyMaterializeResult {
  const sourceTakenDates = schedule.takenDates;
  const unchanged = cloneOccurrences(records);
  const dates = explicitLegacyTakenDates(sourceTakenDates);
  let next = cloneOccurrences(records);
  const materializedDates: string[] = [];

  for (const localCivilDate of dates) {
    const result = materializeOccurrence(next, {
      scheduleId: schedule.id,
      localCivilDate,
      timeZone: schedule.timeZone,
      nowIso,
    });
    if (!result.ok) {
      return {
        ok: false,
        records: unchanged,
        sourceTakenDates,
        materializedDates: [],
        code: result.code,
      };
    }
    next = result.records;
    if (result.created) {
      next = replaceOccurrence(next, {
        ...result.record,
        status: "taken",
      });
    }
    materializedDates.push(localCivilDate);
  }

  return {
    ok: true,
    records: next,
    sourceTakenDates,
    materializedDates,
  };
}
