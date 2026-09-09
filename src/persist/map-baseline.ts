import type { OccurrenceRecord } from "../occ/types";
import { normalizeLocalCivilDate } from "../occ/validate";
import { resolveTimeZone } from "../ux/adapter";
import { asRecord, firstString, readFiniteNumber } from "./fields";
import { githubFillFromUnknown } from "./map-github";
import type { GitHubAppState, GitHubFill, GitHubSchedule, MapResult, QuarantineItem } from "./types";

export const BASELINE_SYNTHETIC_SCHEDULE_PREFIX = "baseline-sched:";

const TIME_RE = /^\d{2}:\d{2}$/;

interface BaselineHistory {
  fillSavedId: string;
  localCivilDate: string;
  status: "taken" | "missed" | "unknown";
  raw: unknown;
}

interface SourceScheduleFields {
  intervalDays: number;
  reminderTime: string;
  startDate: string;
}

function emptyState(): GitHubAppState {
  return { fills: [], schedules: [], occurrences: [], medications: [] };
}

function historyStatus(record: Record<string, unknown>): BaselineHistory["status"] {
  const status = firstString(record.status, record.state);
  if (status === "missed" || record.missed === true) {
    return "missed";
  }
  if (status === "taken" || record.taken === true) {
    return "taken";
  }
  if (record.taken === false && status !== "taken") {
    return "missed";
  }
  return "unknown";
}

function historyFromUnknown(
  value: unknown,
  fallbackFillId: string | null,
  quarantine: QuarantineItem[]
): BaselineHistory | null {
  const record = asRecord(value);
  if (!record) {
    quarantine.push({ entity: "history", id: null, reason: "not-object", payload: value });
    return null;
  }
  const fillSavedId = firstString(record.fillSavedId, record.fillId, record.savedId, fallbackFillId);
  const localCivilDate =
    normalizeLocalCivilDate(record.localCivilDate) ||
    normalizeLocalCivilDate(record.date) ||
    normalizeLocalCivilDate(record.takenDate) ||
    normalizeLocalCivilDate(record.day);
  if (!fillSavedId || !localCivilDate) {
    quarantine.push({
      entity: "history",
      id: fillSavedId,
      reason: "missing-fill-or-date",
      payload: record,
    });
    return null;
  }
  return {
    fillSavedId,
    localCivilDate,
    status: historyStatus(record),
    raw: record,
  };
}

function collectHistories(raw: unknown, fills: readonly GitHubFill[], quarantine: QuarantineItem[]): BaselineHistory[] {
  const record = asRecord(raw);
  const collected: BaselineHistory[] = [];
  const top = record?.histories;

  function pushAll(values: unknown[], fallbackFillId: string | null) {
    for (const row of values) {
      const mapped = historyFromUnknown(row, fallbackFillId, quarantine);
      if (mapped) {
        collected.push(mapped);
      }
    }
  }

  if (Array.isArray(top)) {
    pushAll(top, null);
  } else if (asRecord(top)) {
    for (const [fillId, rows] of Object.entries(asRecord(top) || {})) {
      if (Array.isArray(rows)) {
        pushAll(rows, fillId);
      } else if (rows != null) {
        const mapped = historyFromUnknown(rows, fillId, quarantine);
        if (mapped) {
          collected.push(mapped);
        }
      }
    }
  }

  for (const fill of fills) {
    const nested = (fill as { histories?: unknown }).histories;
    if (Array.isArray(nested)) {
      pushAll(nested, fill.savedId);
    }
  }

  return collected;
}

function scheduleSourceRecord(fill: GitHubFill): Record<string, unknown> {
  const record = fill as Record<string, unknown>;
  return asRecord(record.schedule) || record;
}

function sourceScheduleFields(fill: GitHubFill): SourceScheduleFields | null {
  const nested = scheduleSourceRecord(fill);
  const intervalRaw = readFiniteNumber(nested.intervalDays);
  const recurrence = asRecord(nested.recurrence);
  const recurrenceInterval = recurrence ? readFiniteNumber(recurrence.intervalDays) : null;
  let intervalDays: number | null = null;
  if (intervalRaw !== null && Number.isInteger(intervalRaw) && intervalRaw >= 1) {
    intervalDays = intervalRaw;
  } else if (recurrenceInterval !== null && Number.isInteger(recurrenceInterval) && recurrenceInterval >= 1) {
    intervalDays = recurrenceInterval;
  }
  const reminderTime = firstString(nested.reminderTime, nested.timeOfDay);
  const startDate =
    normalizeLocalCivilDate(nested.startDate) || normalizeLocalCivilDate(nested.startCivilDate);
  if (intervalDays === null || !reminderTime || !TIME_RE.test(reminderTime) || !startDate) {
    return null;
  }
  return { intervalDays, reminderTime, startDate };
}

function hasPartialScheduleFields(fill: GitHubFill): boolean {
  const nested = scheduleSourceRecord(fill);
  const recurrence = asRecord(nested.recurrence);
  return (
    nested.intervalDays != null ||
    (recurrence != null && recurrence.intervalDays != null) ||
    Boolean(firstString(nested.reminderTime, nested.timeOfDay)) ||
    Boolean(firstString(nested.startDate, nested.startCivilDate))
  );
}

function mapSourceSchedule(
  fill: GitHubFill,
  takenDates: string[],
  timeZone: string
): GitHubSchedule | null {
  const fields = sourceScheduleFields(fill);
  if (!fields) {
    return null;
  }
  const vialAmount = Number(fill.vialAmount);
  const waterMl = Number(fill.waterMl);
  const doseAmount = Number(fill.recommendedDoseAmount);
  if (!(vialAmount > 0 && waterMl > 0 && doseAmount > 0)) {
    return null;
  }
  const concentration = vialAmount / waterMl;
  const doseMl = doseAmount / concentration;
  if (!(doseMl >= 0.05)) {
    return null;
  }
  return {
    id: `${BASELINE_SYNTHETIC_SCHEDULE_PREFIX}${fill.savedId}`,
    fillSavedId: fill.savedId,
    doseAmount,
    doseMl,
    unitLabel: String(fill.unitLabel || "mg"),
    intervalDays: fields.intervalDays,
    reminderTime: fields.reminderTime,
    startDate: fields.startDate,
    fillSnapshot: fill,
    takenDates,
    lifecycle: fill.lifecycle === "archived" ? "archived" : "active",
    timeZone,
  };
}

function quarantineTakenWithoutSchedule(
  fillId: string,
  takenDates: string[],
  quarantine: QuarantineItem[]
): void {
  for (const date of takenDates) {
    quarantine.push({
      entity: "history",
      id: `${fillId}:${date}`,
      reason: "taken-history-no-source-schedule",
      payload: { fillSavedId: fillId, localCivilDate: date, status: "taken" },
    });
  }
}

export function mapBaselineDocument(raw: unknown, timeZone?: string, nowIso = "2026-09-09T00:00:00.000Z"): MapResult {
  const record = asRecord(raw);
  const quarantine: QuarantineItem[] = [];
  const notes: string[] = [
    "baseline-rebuild-mapped-to-BACKUP_SCHEMA_V3",
    "source-schedule-required-interval-time-start",
    "missed-histories-quarantined-not-applied",
  ];
  if (!record) {
    return {
      ok: false,
      generation: "baseline-rebuild",
      state: emptyState(),
      settings: { timeZone: resolveTimeZone(timeZone), theme: null, updatedAt: nowIso },
      quarantine: [{ entity: "document", id: null, reason: "not-object", payload: raw }],
      historyCount: 0,
      notes,
    };
  }

  const fills: GitHubFill[] = [];
  const fillSource = Array.isArray(record.fills) ? record.fills : [];
  for (const row of fillSource) {
    const mapped = githubFillFromUnknown(row, quarantine);
    if (mapped) {
      fills.push(mapped);
    }
  }

  const histories = collectHistories(record, fills, quarantine);
  const takenByFill = new Map<string, string[]>();
  for (const history of histories) {
    if (history.status === "missed") {
      quarantine.push({
        entity: "history",
        id: `${history.fillSavedId}:${history.localCivilDate}`,
        reason: "missed-status-unmapped",
        payload: history.raw,
      });
      continue;
    }
    if (history.status !== "taken") {
      quarantine.push({
        entity: "history",
        id: `${history.fillSavedId}:${history.localCivilDate}`,
        reason: "unknown-history-status",
        payload: history.raw,
      });
      continue;
    }
    const list = takenByFill.get(history.fillSavedId) || [];
    if (!list.includes(history.localCivilDate)) {
      list.push(history.localCivilDate);
    }
    takenByFill.set(history.fillSavedId, list);
  }

  const zone = resolveTimeZone(timeZone);
  const schedules: GitHubSchedule[] = [];
  const occurrences: OccurrenceRecord[] = [];
  for (const fill of fills) {
    const takenDates = takenByFill.get(fill.savedId) || [];
    const schedule = mapSourceSchedule(fill, takenDates, zone);
    if (!schedule) {
      if (hasPartialScheduleFields(fill)) {
        quarantine.push({
          entity: "schedule",
          id: `${BASELINE_SYNTHETIC_SCHEDULE_PREFIX}${fill.savedId}`,
          reason: "incomplete-source-schedule",
          payload: fill,
        });
      }
      quarantineTakenWithoutSchedule(fill.savedId, takenDates, quarantine);
      continue;
    }
    schedules.push(schedule);
    notes.push("source-schedule-mapped:" + schedule.id);
    for (const date of takenDates) {
      occurrences.push({
        id: `occ:${schedule.id}:${date}`,
        scheduleId: schedule.id,
        localCivilDate: date,
        timeZone: zone,
        status: "taken",
        takenAt: `${date}T00:00:00.000Z`,
        appliedDepletionAmount: null,
        appliedDepletionUnit: null,
        appliedFillId: null,
        updatedAt: `${date}T00:00:00.000Z`,
      });
    }
  }

  if (record.activeView != null) {
    quarantine.push({
      entity: "settings",
      id: "activeView",
      field: "activeView",
      reason: "passthrough-ui-state",
      payload: record.activeView,
    });
  }
  if (record.lastReminderDigestDate != null) {
    quarantine.push({
      entity: "settings",
      id: "lastReminderDigestDate",
      field: "lastReminderDigestDate",
      reason: "passthrough-reminder-digest-not-applied",
      payload: record.lastReminderDigestDate,
    });
  }

  return {
    ok: fills.length > 0,
    generation: "baseline-rebuild",
    state: { fills, schedules, occurrences, medications: [] },
    settings: { timeZone: zone, theme: null, updatedAt: nowIso },
    quarantine,
    historyCount: histories.length,
    notes,
  };
}
