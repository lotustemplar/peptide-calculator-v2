/**
 * UX-SAVE-001 / UX-SAVE-002 — confirmation summary from user-entered values only.
 * No therapeutic chips, target amounts, formula changes, or unit conversion.
 */

import { SAVE_DISCLAIMER, SAVE_SCHEDULE_ERROR } from "./copy";

export interface SaveSummaryInput {
  name: string;
  vialAmount: number;
  unitLabel: string;
  doseAmount: number;
  waterMl: number;
  doseMl: number;
  insulinUnits: number | null;
  concentrationPerMl: number;
  intervalDays: number;
  reminderTime: string;
  startDate: string;
}

export interface SaveSummaryRow {
  label: string;
  value: string;
}

export interface SaveSummary {
  title: string;
  rows: SaveSummaryRow[];
  disclaimer: string;
}

export interface SaveScheduleValidation {
  ok: boolean;
  field: "intervalDays" | "reminderTime" | "startDate" | null;
  message: string | null;
}

function formatAmount(value: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

export function validateSaveSchedule(
  intervalDays: unknown,
  reminderTime: unknown,
  startDate: unknown
): SaveScheduleValidation {
  const interval = Number(intervalDays);
  if (!Number.isInteger(interval) || interval < 1) {
    return { ok: false, field: "intervalDays", message: SAVE_SCHEDULE_ERROR };
  }
  if (typeof reminderTime !== "string" || !/^\d{2}:\d{2}$/.test(reminderTime)) {
    return { ok: false, field: "reminderTime", message: SAVE_SCHEDULE_ERROR };
  }
  if (typeof startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { ok: false, field: "startDate", message: SAVE_SCHEDULE_ERROR };
  }
  return { ok: true, field: null, message: null };
}

export function buildSaveSummary(input: SaveSummaryInput): SaveSummary {
  const unit = input.unitLabel || "";
  const rows: SaveSummaryRow[] = [
    { label: "Name", value: input.name },
    { label: "Vial amount", value: `${formatAmount(input.vialAmount)} ${unit}`.trim() },
    { label: "Entered dose", value: `${formatAmount(input.doseAmount)} ${unit}`.trim() },
    { label: "BAC water", value: `${formatAmount(input.waterMl)} mL` },
    { label: "Draw volume", value: `${formatAmount(input.doseMl)} mL` },
  ];

  if (Number.isFinite(input.insulinUnits) && input.insulinUnits !== null) {
    rows.push({ label: "U-100 units", value: formatAmount(input.insulinUnits) });
  }

  rows.push({
    label: "Concentration",
    value: `${formatAmount(input.concentrationPerMl)} ${unit}/mL`.trim(),
  });
  rows.push({
    label: "Schedule",
    value: `Every ${input.intervalDays} day${input.intervalDays === 1 ? "" : "s"} at ${input.reminderTime}, starting ${input.startDate}`,
  });

  return {
    title: "Confirm fill",
    rows,
    disclaimer: SAVE_DISCLAIMER,
  };
}

export function summaryContainsForbiddenFraming(summary: SaveSummary): boolean {
  const blob = `${summary.title} ${summary.disclaimer} ${summary.rows
    .map((row) => `${row.label} ${row.value}`)
    .join(" ")}`.toLowerCase();
  return (
    blob.includes("recommend" + "ed") ||
    blob.includes("typical dose") ||
    blob.includes("prescribed") ||
    blob.includes("therapeutic")
  );
}
