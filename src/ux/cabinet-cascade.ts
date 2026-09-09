/**
 * UX-CAB-001 — non-destructive Cabinet cascade.
 * Archive fill + stop future pending occurrences; retain historical taken records.
 */

import type { OccurrenceRecord } from "../occ/types";

export const FILL_LIFECYCLE_ARCHIVED = "archived";
export const FILL_LIFECYCLE_ACTIVE = "active";

export interface CascadeFill {
  savedId: string;
  name?: string;
  lifecycle?: string;
}

export interface CascadeSchedule {
  id: string;
  fillSavedId?: string | null;
  takenDates?: unknown;
  lifecycle?: string;
}

export interface CascadePlan {
  fillId: string;
  fillName: string;
  scheduleCount: number;
  historicalTakenCount: number;
  scheduleIds: string[];
}

export interface CascadeApplyInput {
  fills: CascadeFill[];
  schedules: CascadeSchedule[];
  occurrences: OccurrenceRecord[];
  fillId: string;
  todayKey: string;
}

export interface CascadeApplyResult {
  fills: CascadeFill[];
  schedules: CascadeSchedule[];
  occurrences: OccurrenceRecord[];
  removedPendingCount: number;
}

function explicitTakenCount(takenDates: unknown): number {
  if (!Array.isArray(takenDates)) {
    return 0;
  }
  return takenDates.filter((value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
    .length;
}

export function isArchivedLifecycle(value: unknown): boolean {
  return value === FILL_LIFECYCLE_ARCHIVED;
}

export function planCabinetCascade(
  fill: CascadeFill | null | undefined,
  schedules: readonly CascadeSchedule[]
): CascadePlan | null {
  if (!fill?.savedId) {
    return null;
  }
  const linked = schedules.filter((schedule) => schedule.fillSavedId === fill.savedId);
  const historicalTakenCount = linked.reduce(
    (sum, schedule) => sum + explicitTakenCount(schedule.takenDates),
    0
  );
  return {
    fillId: fill.savedId,
    fillName: fill.name || "Unnamed Peptide Fill",
    scheduleCount: linked.length,
    historicalTakenCount,
    scheduleIds: linked.map((schedule) => schedule.id),
  };
}

/**
 * Archive the fill and linked schedules. Drop future pending occurrence rows.
 * Keep taken occurrence rows and schedule.takenDates (history).
 */
export function applyCabinetArchive(input: CascadeApplyInput): CascadeApplyResult {
  const fillIds = new Set(
    input.fills.filter((fill) => fill.savedId === input.fillId).map((fill) => fill.savedId)
  );
  const scheduleIds = new Set(
    input.schedules
      .filter((schedule) => schedule.fillSavedId && fillIds.has(schedule.fillSavedId))
      .map((schedule) => schedule.id)
  );

  const fills = input.fills.map((fill) =>
    fill.savedId === input.fillId ? { ...fill, lifecycle: FILL_LIFECYCLE_ARCHIVED } : { ...fill }
  );
  const schedules = input.schedules.map((schedule) =>
    schedule.fillSavedId === input.fillId
      ? { ...schedule, lifecycle: FILL_LIFECYCLE_ARCHIVED }
      : { ...schedule }
  );

  let removedPendingCount = 0;
  const occurrences = input.occurrences.filter((row) => {
    if (!scheduleIds.has(row.scheduleId)) {
      return true;
    }
    if (row.status === "taken") {
      return true;
    }
    if (row.status === "pending" && row.localCivilDate >= input.todayKey) {
      removedPendingCount += 1;
      return false;
    }
    return true;
  });

  return { fills, schedules, occurrences, removedPendingCount };
}

export function activeFills<T extends CascadeFill>(fills: readonly T[]): T[] {
  return fills.filter((fill) => !isArchivedLifecycle(fill.lifecycle));
}

export function activeSchedules<T extends CascadeSchedule>(schedules: readonly T[]): T[] {
  return schedules.filter((schedule) => !isArchivedLifecycle(schedule.lifecycle));
}
