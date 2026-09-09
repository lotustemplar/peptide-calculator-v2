/**
 * Narrow local persistence adapter for FR-SCH-000 Taken/Undo.
 * Writer is authoritative. takenDates is a forward-compatible read/write mirror only.
 */

import {
  explicitLegacyTakenDates,
  lookupOccurrence,
  markTaken,
  materializeLegacyTakenDates,
  undoTaken,
  type OccurrenceRecord,
  type OccurrenceStoreSnapshot,
  type PersistCommit,
  type WriterResult,
} from "../occ/index";
import { depletionApplied, type FillDepletionRecord } from "../occ/types";
import { writerErrorMessage } from "./copy";

export const OCCURRENCES_STORAGE_KEY = "peptide-calculator-v2-occurrences";

export interface AdapterFill {
  savedId: string;
  unitLabel?: string;
  vialAmount?: number;
  recommendedDoseAmount?: number;
  depletionRemaining?: number | null;
  depletionUnit?: string;
  lifecycle?: string;
  [key: string]: unknown;
}

export interface AdapterSchedule {
  id: string;
  fillSavedId?: string | null;
  doseAmount?: number;
  unitLabel?: string;
  takenDates?: unknown;
  timeZone?: string;
  lifecycle?: string;
  [key: string]: unknown;
}

export interface AppPersistState {
  fills: AdapterFill[];
  schedules: AdapterSchedule[];
  occurrences: OccurrenceRecord[];
}

export interface TakenAdapterDeps {
  readAppState: () => AppPersistState;
  writeAppState: (next: AppPersistState) => void;
  timeZone: string;
  nowIso: () => string;
}

function cloneFills(fills: readonly AdapterFill[]): AdapterFill[] {
  return fills.map((fill) => ({ ...fill }));
}

function cloneSchedules(schedules: readonly AdapterSchedule[]): AdapterSchedule[] {
  return schedules.map((schedule) => ({
    ...schedule,
    takenDates: Array.isArray(schedule.takenDates) ? [...schedule.takenDates] : schedule.takenDates,
  }));
}

export function resolveTimeZone(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
      return value;
    } catch {
      // fall through
    }
  }
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolved) {
      return resolved;
    }
  } catch {
    // fall through
  }
  return "UTC";
}

function deriveRemaining(fill: AdapterFill, schedules: readonly AdapterSchedule[]): number {
  if (Number.isFinite(Number(fill.depletionRemaining))) {
    return Number(fill.depletionRemaining);
  }
  const vial = Number(fill.vialAmount);
  const used = schedules
    .filter((schedule) => schedule.fillSavedId === fill.savedId)
    .reduce((sum, schedule) => {
      const dose = Number(schedule.doseAmount) || 0;
      return sum + explicitLegacyTakenDates(schedule.takenDates).length * dose;
    }, 0);
  if (!Number.isFinite(vial)) {
    return 0;
  }
  return vial - used;
}

export function fillToDepletion(
  fill: AdapterFill,
  schedules: readonly AdapterSchedule[],
  desiredDoseOverride?: number
): FillDepletionRecord {
  const linked = schedules.filter((schedule) => schedule.fillSavedId === fill.savedId);
  const desiredDose = Number.isFinite(Number(desiredDoseOverride))
    ? Number(desiredDoseOverride)
    : Number(linked[0]?.doseAmount ?? fill.recommendedDoseAmount);
  const unit = String(fill.unitLabel || linked[0]?.unitLabel || "mg");
  return {
    id: fill.savedId,
    desiredDose,
    unit,
    depletionRemaining: deriveRemaining(fill, schedules),
    depletionUnit: String(fill.depletionUnit || unit),
  };
}

export function hydrateLegacyOccurrences(
  state: AppPersistState,
  timeZone: string,
  nowIso: string
): AppPersistState {
  let records = state.occurrences.map((row) => ({ ...row }));
  for (const schedule of state.schedules) {
    const result = materializeLegacyTakenDates(
      records,
      { id: schedule.id, timeZone, takenDates: schedule.takenDates },
      nowIso
    );
    if (result.ok) {
      records = result.records;
    }
  }
  return {
    fills: cloneFills(state.fills),
    schedules: cloneSchedules(state.schedules),
    occurrences: records,
  };
}

export function toWriterSnapshot(
  state: AppPersistState,
  desiredDoseByFillId?: Record<string, number>
): OccurrenceStoreSnapshot {
  return {
    occurrences: state.occurrences.map((row) => ({ ...row })),
    fills: state.fills.map((fill) =>
      fillToDepletion(fill, state.schedules, desiredDoseByFillId?.[fill.savedId])
    ),
  };
}

export function applyWriterSnapshot(
  state: AppPersistState,
  snapshot: OccurrenceStoreSnapshot
): AppPersistState {
  const depletionById = new Map(snapshot.fills.map((row) => [row.id, row]));
  return {
    fills: state.fills.map((fill) => {
      const row = depletionById.get(fill.savedId);
      if (!row) {
        return { ...fill };
      }
      return {
        ...fill,
        depletionRemaining: row.depletionRemaining,
        depletionUnit: row.depletionUnit,
      };
    }),
    schedules: cloneSchedules(state.schedules),
    occurrences: snapshot.occurrences.map((row) => ({ ...row })),
  };
}

export function mirrorTakenDate(
  schedules: readonly AdapterSchedule[],
  scheduleId: string,
  localCivilDate: string,
  taken: boolean
): AdapterSchedule[] {
  return schedules.map((schedule) => {
    if (schedule.id !== scheduleId) {
      return { ...schedule, takenDates: Array.isArray(schedule.takenDates) ? [...schedule.takenDates] : schedule.takenDates };
    }
    const current = explicitLegacyTakenDates(schedule.takenDates);
    if (taken && !current.includes(localCivilDate)) {
      return { ...schedule, takenDates: [...current, localCivilDate] };
    }
    if (!taken) {
      return { ...schedule, takenDates: current.filter((date) => date !== localCivilDate) };
    }
    return { ...schedule, takenDates: [...current] };
  });
}

export function isScheduleTakenOnDate(
  state: AppPersistState,
  scheduleId: string,
  localCivilDate: string
): boolean {
  const occurrence = lookupOccurrence(state.occurrences, scheduleId, localCivilDate);
  if (occurrence) {
    return occurrence.status === "taken";
  }
  const schedule = state.schedules.find((row) => row.id === scheduleId);
  return explicitLegacyTakenDates(schedule?.takenDates).includes(localCivilDate);
}

export function canUndoTaken(
  state: AppPersistState,
  scheduleId: string,
  localCivilDate: string
): boolean {
  const occurrence = lookupOccurrence(state.occurrences, scheduleId, localCivilDate);
  return Boolean(
    occurrence &&
      occurrence.status === "taken" &&
      depletionApplied(occurrence) &&
      occurrence.appliedFillId
  );
}

export function resolveScheduleFillId(
  state: AppPersistState,
  scheduleId: string
): string | null {
  const schedule = state.schedules.find((row) => row.id === scheduleId);
  if (schedule?.fillSavedId) {
    return schedule.fillSavedId;
  }
  return null;
}

export interface AdapterResult {
  ok: boolean;
  noop: boolean;
  code?: string;
  message?: string;
  state: AppPersistState;
}

function toAdapterResult(result: WriterResult, fallback: AppPersistState, takenMirror?: {
  scheduleId: string;
  localCivilDate: string;
  taken: boolean;
}): AdapterResult {
  if (!result.ok) {
    return {
      ok: false,
      noop: false,
      code: result.code,
      message: writerErrorMessage(result.code),
      state: fallback,
    };
  }
  let next = applyWriterSnapshot(fallback, result.snapshot);
  if (takenMirror && !result.noop) {
    next = {
      ...next,
      schedules: mirrorTakenDate(
        next.schedules,
        takenMirror.scheduleId,
        takenMirror.localCivilDate,
        takenMirror.taken
      ),
    };
  }
  return {
    ok: true,
    noop: result.noop,
    state: next,
  };
}

export function createTakenAdapter(deps: TakenAdapterDeps) {
  function loadHydrated(): AppPersistState {
    return hydrateLegacyOccurrences(deps.readAppState(), deps.timeZone, deps.nowIso());
  }

  function commitPersist(before: AppPersistState, mirror: {
    scheduleId: string;
    localCivilDate: string;
    taken: boolean;
  }): PersistCommit {
    return (candidate) => {
      const applied = applyWriterSnapshot(before, candidate);
      const mirrored = {
        ...applied,
        schedules: mirrorTakenDate(applied.schedules, mirror.scheduleId, mirror.localCivilDate, mirror.taken),
      };
      deps.writeAppState(mirrored);
    };
  }

  return {
    markTaken(scheduleId: string, localCivilDate: string, fillId?: string): AdapterResult {
      const before = loadHydrated();
      const resolvedFillId = fillId || resolveScheduleFillId(before, scheduleId);
      if (!resolvedFillId) {
        return {
          ok: false,
          noop: false,
          code: "NOT_FOUND",
          message: writerErrorMessage("NOT_FOUND"),
          state: deps.readAppState(),
        };
      }
      const schedule = before.schedules.find((row) => row.id === scheduleId);
      const snapshot = toWriterSnapshot(before, {
        [resolvedFillId]: Number(schedule?.doseAmount),
      });
      const result = markTaken(
        snapshot,
        {
          scheduleId,
          localCivilDate,
          timeZone: deps.timeZone,
          fillId: resolvedFillId,
          nowIso: deps.nowIso(),
        },
        commitPersist(before, { scheduleId, localCivilDate, taken: true })
      );
      if (!result.ok || result.noop) {
        return toAdapterResult(result, deps.readAppState());
      }
      return toAdapterResult(result, before, { scheduleId, localCivilDate, taken: true });
    },

    undoTaken(scheduleId: string, localCivilDate: string, fillId?: string): AdapterResult {
      const before = loadHydrated();
      const snapshot = toWriterSnapshot(before);
      const result = undoTaken(
        snapshot,
        {
          scheduleId,
          localCivilDate,
          fillId,
          nowIso: deps.nowIso(),
        },
        commitPersist(before, { scheduleId, localCivilDate, taken: false })
      );
      if (!result.ok || result.noop) {
        return toAdapterResult(result, deps.readAppState());
      }
      return toAdapterResult(result, before, { scheduleId, localCivilDate, taken: false });
    },

    isTaken(scheduleId: string, localCivilDate: string): boolean {
      return isScheduleTakenOnDate(loadHydrated(), scheduleId, localCivilDate);
    },

    canUndo(scheduleId: string, localCivilDate: string): boolean {
      return canUndoTaken(loadHydrated(), scheduleId, localCivilDate);
    },

    readHydrated(): AppPersistState {
      return loadHydrated();
    },
  };
}

export type TakenAdapter = ReturnType<typeof createTakenAdapter>;
