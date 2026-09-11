/**
 * Stage 6b.2 — Cabinet edit-fill apply (retired from mobile-polish-fix.js).
 * Recalc matches the overlay: concentration = vial / water, doseMl = dose / concentration.
 * Does not change calculator option builders or formula goldens.
 */

export const EDIT_FILL_MIN_DRAW_ML = 0.05;
export const EDIT_FILL_DEFAULT_INTERVAL_DAYS = 7;
export const EDIT_FILL_DEFAULT_REMINDER_TIME = "09:00";
export const EDIT_FILL_UNNAMED = "Unnamed Peptide Fill";

export const EDIT_FILL_INVALID_VALUES = "Please enter valid fill and schedule values.";

export function editFillDrawRangeMessage(doseMl: number): string {
  return `That dose would require ${doseMl.toFixed(2)} mL, which falls outside the supported draw range for this fill.`;
}

export interface EditFillRecord {
  savedId: string;
  name?: string;
  vialAmount?: number;
  waterMl?: number;
  unitLabel?: string;
  recommendedDoseAmount?: number;
  concentrationPerMl?: number;
  syringeMax?: number;
  maxWaterMl?: number;
}

export interface EditFillSchedule {
  fillSavedId?: string;
  doseAmount?: number;
  doseMl?: number;
  intervalDays?: number;
  reminderTime?: string;
  startDate?: string;
  fillSnapshot?: EditFillRecord;
}

export interface EditFillFormValues {
  name: string;
  waterMl: number | string;
  doseAmount: number | string;
  intervalDays: number | string;
  reminderTime: string;
  startDate: string;
}

export interface EditFillDefaults {
  name: string;
  waterMl: string;
  doseAmount: string;
  intervalDays: string;
  reminderTime: string;
  startDate: string;
  doseLabel: string;
  note: string;
}

export interface ApplyEditedFillInput {
  fills: EditFillRecord[];
  schedules: EditFillSchedule[];
  fillId: string;
  form: EditFillFormValues;
}

export type ApplyEditedFillResult =
  | {
      ok: true;
      fills: EditFillRecord[];
      schedules: EditFillSchedule[];
      fill: EditFillRecord;
      doseMl: number;
      linkedScheduleCount: number;
    }
  | {
      ok: false;
      code: "NOT_FOUND" | "INVALID_VALUES" | "DRAW_RANGE";
      message: string;
    };

export function isPositiveNumber(value: unknown): boolean {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

export function formatEditFillNumber(value: unknown): string {
  return Number(value).toFixed(2).replace(/\.00$/, "");
}

export function buildEditFillNote(fill: EditFillRecord, linkedScheduleCount: number): string {
  const unit = fill.unitLabel || "mg";
  const shownCount = linkedScheduleCount || 1;
  const plural = linkedScheduleCount === 1 ? "" : "s";
  return `${formatEditFillNumber(fill.vialAmount)} ${unit} vial · currently ${formatEditFillNumber(fill.waterMl)} mL BAC water · ${shownCount} linked schedule${plural}.`;
}

export function editFillFormDefaults(
  fill: EditFillRecord,
  primarySchedule: EditFillSchedule | null | undefined,
  todayKey: string,
  linkedScheduleCount = 0
): EditFillDefaults {
  const unit = fill.unitLabel || "mg";
  return {
    name: fill.name || "",
    waterMl: Number(fill.waterMl || 0).toFixed(2),
    doseAmount: formatEditFillNumber(primarySchedule?.doseAmount || fill.recommendedDoseAmount || 0),
    intervalDays: String(primarySchedule?.intervalDays || EDIT_FILL_DEFAULT_INTERVAL_DAYS),
    reminderTime: primarySchedule?.reminderTime || EDIT_FILL_DEFAULT_REMINDER_TIME,
    startDate: primarySchedule?.startDate || todayKey,
    doseLabel: `Dose amount (${unit})`,
    note: buildEditFillNote(fill, linkedScheduleCount),
  };
}

export function applyEditedFill(input: ApplyEditedFillInput): ApplyEditedFillResult {
  const fillIndex = input.fills.findIndex((item) => item.savedId === input.fillId);
  if (fillIndex === -1) {
    return { ok: false, code: "NOT_FOUND", message: "" };
  }

  const current = input.fills[fillIndex];
  const nextName = String(input.form.name || "").trim() || current.name || EDIT_FILL_UNNAMED;
  const nextWaterMl = Number(input.form.waterMl);
  const nextDoseAmount = Number(input.form.doseAmount);
  const nextIntervalDays = Number(input.form.intervalDays);
  const nextTime = String(input.form.reminderTime || "");
  const nextStart = String(input.form.startDate || "");
  const vialAmount = Number(current.vialAmount || 0);
  const syringeMax = Number(current.syringeMax || 1);

  if (
    !isPositiveNumber(vialAmount) ||
    !isPositiveNumber(nextWaterMl) ||
    !isPositiveNumber(nextDoseAmount) ||
    !Number.isInteger(nextIntervalDays) ||
    nextIntervalDays < 1 ||
    !nextTime ||
    !nextStart
  ) {
    return { ok: false, code: "INVALID_VALUES", message: EDIT_FILL_INVALID_VALUES };
  }

  const nextConcentration = vialAmount / nextWaterMl;
  const nextDoseMl = nextDoseAmount / nextConcentration;

  if (!isPositiveNumber(nextDoseMl) || nextDoseMl < EDIT_FILL_MIN_DRAW_ML || nextDoseMl > syringeMax) {
    return { ok: false, code: "DRAW_RANGE", message: editFillDrawRangeMessage(nextDoseMl) };
  }

  const fill: EditFillRecord = {
    ...current,
    name: nextName,
    waterMl: Number(nextWaterMl.toFixed(2)),
    concentrationPerMl: nextConcentration,
    recommendedDoseAmount: nextDoseAmount,
    maxWaterMl: Math.max(Number(current.maxWaterMl || 0), Number(nextWaterMl.toFixed(2))),
  };

  const fills = input.fills.map((item, index) => (index === fillIndex ? fill : item));
  const updatedSchedules = input.schedules.map((schedule) => {
    if (schedule.fillSavedId !== input.fillId) {
      return schedule;
    }
    return {
      ...schedule,
      doseAmount: nextDoseAmount,
      doseMl: Number(nextDoseMl.toFixed(2)),
      intervalDays: nextIntervalDays,
      reminderTime: nextTime,
      startDate: nextStart,
      fillSnapshot: {
        ...(schedule.fillSnapshot || {}),
        ...fill,
      },
    };
  });

  return {
    ok: true,
    fills,
    schedules: updatedSchedules,
    fill,
    doseMl: nextDoseMl,
    linkedScheduleCount: updatedSchedules.filter((item) => item.fillSavedId === input.fillId).length,
  };
}
