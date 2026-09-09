import { LOCAL_CIVIL_DATE_RE, type OccurrenceRecord } from "../occ/types";
import { normalizeLocalCivilDate } from "../occ/validate";
import { resolveTimeZone } from "../ux/adapter";
import { asRecord, firstString, readFiniteNumber } from "./fields";
import { githubFillFromUnknown } from "./map-github";
import type { GitHubAppState, GitHubFill, GitHubSchedule, MapResult, QuarantineItem } from "./types";

export const BASELINE_SYNTHETIC_SCHEDULE_PREFIX = "baseline-sched:";

interface BaselineHistory {
  fillSavedId: string;
  localCivilDate: string;
  status: "taken" | "missed" | "unknown";
  raw: unknown;
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

function civilFromIso(value: unknown): string | null {
  const text = firstString(value);
  if (!text) {
    return null;
  }
  const day = text.slice(0, 10);
  return LOCAL_CIVIL_DATE_RE.test(day) ? day : null;
}

function syntheticSchedule(
  fill: GitHubFill,
  takenDates: string[],
  timeZone: string
): GitHubSchedule | null {
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
  const intervalRaw = readFiniteNumber(fill.intervalDays);
  const intervalDays = intervalRaw !== null && Number.isInteger(intervalRaw) && intervalRaw >= 1 ? intervalRaw : 1;
  const startDate =
    [...takenDates].sort()[0] ||
    civilFromIso(fill.savedAt) ||
    civilFromIso(fill.createdAt) ||
    "2026-01-01";
  return {
    id: `${BASELINE_SYNTHETIC_SCHEDULE_PREFIX}${fill.savedId}`,
    fillSavedId: fill.savedId,
    doseAmount,
    doseMl,
    unitLabel: String(fill.unitLabel || "mg"),
    intervalDays,
    reminderTime: "09:00",
    startDate,
    fillSnapshot: fill,
    takenDates,
    lifecycle: fill.lifecycle === "archived" ? "archived" : "active",
    timeZone,
  };
}

export function mapBaselineDocument(raw: unknown, timeZone?: string, nowIso = "2026-09-09T00:00:00.000Z"): MapResult {
  const record = asRecord(raw);
  const quarantine: QuarantineItem[] = [];
  const notes: string[] = [
    "baseline-rebuild-mapped-to-BACKUP_SCHEMA_V3",
    "synthetic-schedule-id-prefix:" + BASELINE_SYNTHETIC_SCHEDULE_PREFIX,
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
    const schedule = syntheticSchedule(fill, takenDates, zone);
    if (!schedule) {
      quarantine.push({
        entity: "schedule",
        id: `${BASELINE_SYNTHETIC_SCHEDULE_PREFIX}${fill.savedId}`,
        reason: "could-not-synthesize-schedule",
        payload: fill,
      });
      continue;
    }
    schedules.push(schedule);
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
