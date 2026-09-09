import { LOCAL_CIVIL_DATE_RE, type OccurrenceRecord } from "../occ/types";
import { explicitLegacyTakenDates } from "../occ/legacy";
import { normalizeIanaTimeZone, normalizeLocalCivilDate } from "../occ/validate";
import { resolveTimeZone } from "../ux/adapter";
import {
  asRecord,
  firstPositiveNumber,
  firstString,
  mergePassthrough,
  pickUnknown,
  readFiniteNumber,
} from "./fields";
import type {
  GitHubAppState,
  GitHubFill,
  GitHubMedication,
  GitHubSchedule,
  MapResult,
  QuarantineItem,
  SettingsRecord,
  SpecFillRecord,
  SpecScheduleSeries,
} from "./types";

export const GITHUB_FILL_KEYS = [
  "savedId",
  "name",
  "fillName",
  "label",
  "peptideName",
  "vialAmount",
  "vialMg",
  "waterMl",
  "unitLabel",
  "concentrationPerMl",
  "syringeMax",
  "maxWaterMl",
  "recommendedDoseAmount",
  "doseAmount",
  "doseMg",
  "savedAt",
  "lifecycle",
  "depletionRemaining",
  "depletionUnit",
] as const;

export const GITHUB_SCHEDULE_KEYS = [
  "id",
  "fillSavedId",
  "fillId",
  "doseAmount",
  "doseMl",
  "unitLabel",
  "intervalDays",
  "reminderTime",
  "startDate",
  "createdAt",
  "lastTriggeredAt",
  "fillSnapshot",
  "fill",
  "takenDates",
  "lifecycle",
  "timeZone",
  "timezone",
] as const;

const MIN_DRAW_ML = 0.05;

function emptyState(): GitHubAppState {
  return { fills: [], schedules: [], occurrences: [], medications: [] };
}

function defaultSettings(nowIso: string, timeZone?: string): SettingsRecord {
  return {
    timeZone: resolveTimeZone(timeZone),
    theme: null,
    updatedAt: nowIso,
  };
}

function concentrationOf(vialAmount: number, waterMl: number): number | null {
  if (!(vialAmount > 0 && waterMl > 0)) {
    return null;
  }
  return vialAmount / waterMl;
}

export function githubFillFromUnknown(
  value: unknown,
  quarantine: QuarantineItem[]
): GitHubFill | null {
  const record = asRecord(value);
  if (!record) {
    quarantine.push({ entity: "fill", id: null, reason: "not-object", payload: value });
    return null;
  }
  const savedId = firstString(record.savedId, record.id);
  const vialAmount = firstPositiveNumber(record.vialAmount, record.vialMg);
  const waterMl = firstPositiveNumber(record.waterMl);
  const extra = pickUnknown(record, GITHUB_FILL_KEYS);
  if (!savedId) {
    quarantine.push({ entity: "fill", id: null, reason: "missing-id", payload: record });
    return null;
  }
  if (vialAmount === null || waterMl === null) {
    quarantine.push({
      entity: "fill",
      id: savedId,
      reason: "invalid-vial-or-water",
      payload: record,
    });
    return null;
  }
  const unitLabel = firstString(record.unitLabel, record.unit) || "mg";
  const recommendedDoseAmount = firstPositiveNumber(
    record.recommendedDoseAmount,
    record.desiredDose,
    record.doseAmount,
    record.doseMg
  );
  if (recommendedDoseAmount === null) {
    quarantine.push({
      entity: "fill",
      id: savedId,
      field: "desiredDose",
      reason: "missing-positive-desired-dose",
      payload: record,
    });
  }
  const concentrationPerMl = concentrationOf(vialAmount, waterMl);
  const name =
    firstString(record.name, record.displayName, record.fillName, record.label, record.peptideName) ||
    "Unnamed Peptide Fill";
  const fill: GitHubFill = mergePassthrough(
    {
      savedId,
      name,
      vialAmount,
      waterMl,
      unitLabel,
      concentrationPerMl: concentrationPerMl ?? Number.NaN,
      syringeMax: firstPositiveNumber(record.syringeMax, record.syringeCapacityMl),
      maxWaterMl: firstPositiveNumber(record.maxWaterMl, record.bacWaterMl),
      recommendedDoseAmount: recommendedDoseAmount ?? 0,
      savedAt: firstString(record.savedAt, record.createdAt) || undefined,
      lifecycle: record.lifecycle === "archived" ? "archived" : "active",
      depletionRemaining:
        readFiniteNumber(record.depletionRemaining) !== null ? Number(record.depletionRemaining) : null,
      depletionUnit: firstString(record.depletionUnit, record.unitLabel, record.unit) || unitLabel,
    },
    extra
  );
  if (recommendedDoseAmount === null) {
    return null;
  }
  return fill;
}

export function githubScheduleFromUnknown(
  value: unknown,
  fills: readonly GitHubFill[],
  quarantine: QuarantineItem[],
  fallbackTimeZone: string
): GitHubSchedule | null {
  const record = asRecord(value);
  if (!record) {
    quarantine.push({ entity: "schedule", id: null, reason: "not-object", payload: value });
    return null;
  }
  const extra = pickUnknown(record, GITHUB_SCHEDULE_KEYS);
  const id = firstString(record.id);
  const fillSavedId = firstString(record.fillSavedId, record.fillId);
  const snapshotRecord = asRecord(record.fillSnapshot) || asRecord(record.fill);
  const snapshot = snapshotRecord ? githubFillFromUnknown(snapshotRecord, []) : null;
  const linkedFill = fills.find((row) => row.savedId === fillSavedId) || snapshot;
  const doseAmount = firstPositiveNumber(
    record.doseAmount,
    snapshot?.recommendedDoseAmount,
    linkedFill?.recommendedDoseAmount
  );
  const concentration =
    snapshot && isFiniteConcentration(snapshot.concentrationPerMl)
      ? Number(snapshot.concentrationPerMl)
      : linkedFill && isFiniteConcentration(linkedFill.concentrationPerMl)
        ? Number(linkedFill.concentrationPerMl)
        : null;
  const doseMl =
    firstPositiveNumber(record.doseMl) ||
    (doseAmount !== null && concentration ? doseAmount / concentration : null);
  if (!id) {
    quarantine.push({ entity: "schedule", id: null, reason: "missing-id", payload: record });
    return null;
  }
  if (!fillSavedId && !snapshot) {
    quarantine.push({ entity: "schedule", id, reason: "missing-fill", payload: record });
    return null;
  }
  if (doseAmount === null || doseMl === null || doseMl < MIN_DRAW_ML) {
    quarantine.push({
      entity: "schedule",
      id,
      reason: "invalid-dose-or-draw",
      payload: record,
    });
    return null;
  }
  const intervalDays = firstFiniteNumberAsInt(record.intervalDays, record.recurrence);
  if (intervalDays === null || intervalDays < 1) {
    quarantine.push({
      entity: "schedule",
      id,
      reason: "invalid-interval-days",
      payload: record,
    });
    return null;
  }
  const startDate =
    normalizeLocalCivilDate(record.startDate) ||
    normalizeLocalCivilDate(record.startCivilDate) ||
    firstString(record.startDate, record.startCivilDate);
  const reminderTime = firstString(record.reminderTime, record.timeOfDay) || "09:00";
  if (!startDate || !reminderTime) {
    quarantine.push({ entity: "schedule", id, reason: "missing-start-or-time", payload: record });
    return null;
  }
  const timeZone =
    normalizeIanaTimeZone(firstString(record.timeZone, record.timezone)) || fallbackTimeZone;
  return mergePassthrough(
    {
      id,
      fillSavedId: fillSavedId || snapshot?.savedId || null,
      doseAmount,
      doseMl,
      unitLabel: firstString(record.unitLabel, snapshot?.unitLabel, linkedFill?.unitLabel) || "mg",
      intervalDays,
      reminderTime,
      startDate,
      createdAt: firstString(record.createdAt),
      lastTriggeredAt: record.lastTriggeredAt ?? null,
      fillSnapshot: snapshot || linkedFill || null,
      takenDates: explicitLegacyTakenDates(record.takenDates),
      lifecycle: record.lifecycle === "archived" ? "archived" : "active",
      timeZone,
    },
    extra
  );
}

function firstFiniteNumberAsInt(intervalDays: unknown, recurrence: unknown): number | null {
  const direct = readFiniteNumber(intervalDays);
  if (direct !== null && Number.isInteger(direct)) {
    return direct;
  }
  const rec = asRecord(recurrence);
  const nested = rec ? readFiniteNumber(rec.intervalDays) : null;
  if (nested !== null && Number.isInteger(nested)) {
    return nested;
  }
  return null;
}

function isFiniteConcentration(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function githubMedicationFromUnknown(
  value: unknown,
  quarantine: QuarantineItem[]
): GitHubMedication | null {
  const record = asRecord(value);
  if (!record) {
    quarantine.push({ entity: "medication", id: null, reason: "not-object", payload: value });
    return null;
  }
  const id = firstString(record.id);
  const name = firstString(record.name);
  if (!id || !name) {
    quarantine.push({ entity: "medication", id, reason: "missing-id-or-name", payload: record });
    return null;
  }
  return { ...record, id, name };
}

export function occurrenceFromUnknown(
  value: unknown,
  quarantine: QuarantineItem[]
): OccurrenceRecord | null {
  const record = asRecord(value);
  if (!record) {
    quarantine.push({ entity: "occurrence", id: null, reason: "not-object", payload: value });
    return null;
  }
  const scheduleId = firstString(record.scheduleId);
  const localCivilDate = normalizeLocalCivilDate(record.localCivilDate);
  const timeZone = normalizeIanaTimeZone(record.timeZone) || "UTC";
  if (!scheduleId || !localCivilDate) {
    quarantine.push({
      entity: "occurrence",
      id: firstString(record.id),
      reason: "invalid-identity",
      payload: record,
    });
    return null;
  }
  const status: "taken" | "pending" = record.status === "taken" ? "taken" : "pending";
  const extra = pickUnknown(record, [
    "id",
    "scheduleId",
    "localCivilDate",
    "timeZone",
    "status",
    "takenAt",
    "appliedDepletionAmount",
    "appliedDepletionUnit",
    "appliedFillId",
    "updatedAt",
  ]);
  return mergePassthrough(
    {
      id: firstString(record.id) || `occ:${scheduleId}:${localCivilDate}`,
      scheduleId,
      localCivilDate,
      timeZone,
      status,
      takenAt: firstString(record.takenAt),
      appliedDepletionAmount: readFiniteNumber(record.appliedDepletionAmount),
      appliedDepletionUnit:
        record.appliedDepletionUnit === "mg" ||
        record.appliedDepletionUnit === "mcg" ||
        record.appliedDepletionUnit === "IU"
          ? record.appliedDepletionUnit
          : null,
      appliedFillId: firstString(record.appliedFillId),
      updatedAt: firstString(record.updatedAt) || `${localCivilDate}T00:00:00.000Z`,
    },
    extra
  ) as OccurrenceRecord;
}

export function specFillFromGithub(fill: GitHubFill): SpecFillRecord {
  return mergePassthrough(
    {
      id: fill.savedId,
      displayName: String(fill.name || ""),
      vialAmount: Number(fill.vialAmount),
      desiredDose: Number(fill.recommendedDoseAmount),
      unit: String(fill.unitLabel || "mg"),
      waterMl: Number(fill.waterMl),
      concentration: Number(fill.concentrationPerMl),
      syringeCapacityMl: firstPositiveNumber(fill.syringeMax, fill.syringeCapacityMl),
      lifecycle: String(fill.lifecycle || "active"),
      depletionRemaining:
        fill.depletionRemaining === undefined ? null : (fill.depletionRemaining as number | null),
      createdAt: typeof fill.savedAt === "string" ? fill.savedAt : undefined,
      savedId: fill.savedId,
      name: fill.name,
      unitLabel: fill.unitLabel,
      recommendedDoseAmount: fill.recommendedDoseAmount,
    },
    pickUnknown(fill, ["savedId", "name", "vialAmount", "waterMl", "unitLabel", "recommendedDoseAmount"])
  );
}

export function specScheduleFromGithub(schedule: GitHubSchedule): SpecScheduleSeries {
  return {
    id: schedule.id,
    fillId: String(schedule.fillSavedId || ""),
    timeZone: typeof schedule.timeZone === "string" ? schedule.timeZone : undefined,
    startCivilDate: typeof schedule.startDate === "string" ? schedule.startDate : undefined,
    timeOfDay: typeof schedule.reminderTime === "string" ? schedule.reminderTime : undefined,
    recurrence: { intervalDays: Number(schedule.intervalDays) },
    lifecycle: typeof schedule.lifecycle === "string" ? schedule.lifecycle : undefined,
    takenDates: explicitLegacyTakenDates(schedule.takenDates),
    fillSavedId: schedule.fillSavedId,
    doseAmount: schedule.doseAmount,
    doseMl: schedule.doseMl,
    unitLabel: schedule.unitLabel,
    intervalDays: schedule.intervalDays,
    reminderTime: schedule.reminderTime,
    startDate: schedule.startDate,
  };
}

function collectArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function mapGithubDocument(raw: unknown, timeZone?: string, nowIso = "2026-09-09T00:00:00.000Z"): MapResult {
  const record = asRecord(raw);
  const quarantine: QuarantineItem[] = [];
  const notes: string[] = [];
  if (!record) {
    return {
      ok: false,
      generation: "github-main",
      state: emptyState(),
      settings: defaultSettings(nowIso, timeZone),
      quarantine: [{ entity: "document", id: null, reason: "not-object", payload: raw }],
      historyCount: 0,
      notes,
    };
  }
  const entities = asRecord(record.entities);
  const fillSource = collectArray(entities?.fills).length ? collectArray(entities?.fills) : collectArray(record.fills);
  const scheduleSource = collectArray(entities?.schedules).length
    ? collectArray(entities?.schedules)
    : collectArray(record.schedules);
  const occurrenceSource = collectArray(entities?.occurrences).length
    ? collectArray(entities?.occurrences)
    : collectArray(record.occurrences);
  const medicationSource = collectArray(entities?.medications).length
    ? collectArray(entities?.medications)
    : collectArray(record.medications);
  const settingsSource = asRecord(entities?.settings);
  const settings = defaultSettings(
    nowIso,
    firstString(timeZone, settingsSource?.timeZone, record.timezone, record.timeZone) || undefined
  );

  const fills: GitHubFill[] = [];
  for (const row of fillSource) {
    const mapped = githubFillFromUnknown(row, quarantine);
    if (mapped) {
      fills.push(mapped);
    }
  }
  const schedules: GitHubSchedule[] = [];
  for (const row of scheduleSource) {
    const mapped = githubScheduleFromUnknown(row, fills, quarantine, settings.timeZone);
    if (mapped) {
      schedules.push(mapped);
    }
  }
  const occurrences: OccurrenceRecord[] = [];
  const seenOcc = new Set<string>();
  for (const row of occurrenceSource) {
    const mapped = occurrenceFromUnknown(row, quarantine);
    if (!mapped) {
      continue;
    }
    const key = `${mapped.scheduleId}\u001f${mapped.localCivilDate}`;
    if (seenOcc.has(key)) {
      quarantine.push({
        entity: "occurrence",
        id: mapped.id,
        reason: "duplicate-identity",
        payload: row,
      });
      continue;
    }
    seenOcc.add(key);
    occurrences.push(mapped);
  }
  if (occurrences.length === 0) {
    for (const schedule of schedules) {
      for (const date of explicitLegacyTakenDates(schedule.takenDates)) {
        if (!LOCAL_CIVIL_DATE_RE.test(date)) {
          continue;
        }
        const key = `${schedule.id}\u001f${date}`;
        if (seenOcc.has(key)) {
          continue;
        }
        seenOcc.add(key);
        occurrences.push({
          id: `occ:${schedule.id}:${date}`,
          scheduleId: schedule.id,
          localCivilDate: date,
          timeZone: settings.timeZone,
          status: "taken",
          takenAt: `${date}T00:00:00.000Z`,
          appliedDepletionAmount: null,
          appliedDepletionUnit: null,
          appliedFillId: null,
          updatedAt: `${date}T00:00:00.000Z`,
        });
      }
    }
  }
  const medications: GitHubMedication[] = [];
  for (const row of medicationSource) {
    const mapped = githubMedicationFromUnknown(row, quarantine);
    if (mapped) {
      medications.push(mapped);
    }
  }
  notes.push("github-generation-mapped-to-BACKUP_SCHEMA_V3");
  return {
    ok: fills.length > 0 || schedules.length > 0 || medications.length > 0 || occurrences.length > 0,
    generation: "github-main",
    state: { fills, schedules, occurrences, medications },
    settings,
    quarantine,
    historyCount: 0,
    notes,
  };
}

export function mapSpecEntities(raw: unknown, timeZone?: string, nowIso?: string): MapResult {
  return mapGithubDocument(raw, timeZone, nowIso);
}
