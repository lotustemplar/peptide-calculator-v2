/**
 * Stage 5 / MED-FLAG — local medication name normalize + unknown-state.
 * Offline only. Does not suggest doses, frequency, route, or catalog peptides.
 */

export const UNKNOWN_NAME_DISPLAY = "Unknown";
export const UNKNOWN_NAME_STATE = "unknown" as const;
export const KNOWN_NAME_STATE = "known" as const;
export const RECENT_NAME_LIMIT = 8;

export type MedNameState = typeof UNKNOWN_NAME_STATE | typeof KNOWN_NAME_STATE;

export interface ClassifiedMedName {
  displayName: string;
  nameState: MedNameState;
  matchKey: string;
}

export interface MedNameRecord {
  id: string;
  name: string;
  nameState: MedNameState;
  dose?: unknown;
  unit?: unknown;
  interval?: unknown;
  [key: string]: unknown;
}

export function collapseNameWhitespace(value: string): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function nameMatchKey(value: string): string {
  return collapseNameWhitespace(value).toLowerCase();
}

export function isUnknownNameInput(value: string | null | undefined): boolean {
  const key = nameMatchKey(String(value ?? ""));
  return key === "" || key === "unknown";
}

export function classifyMedName(value: string | null | undefined): ClassifiedMedName {
  if (isUnknownNameInput(value)) {
    return {
      displayName: UNKNOWN_NAME_DISPLAY,
      nameState: UNKNOWN_NAME_STATE,
      matchKey: nameMatchKey(UNKNOWN_NAME_DISPLAY),
    };
  }
  const displayName = collapseNameWhitespace(String(value));
  return {
    displayName,
    nameState: KNOWN_NAME_STATE,
    matchKey: nameMatchKey(displayName),
  };
}

export function asNameRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function readMedNameState(row: { name?: unknown; nameState?: unknown }): MedNameState {
  if (row.nameState === UNKNOWN_NAME_STATE || row.nameState === KNOWN_NAME_STATE) {
    return row.nameState;
  }
  return classifyMedName(typeof row.name === "string" ? row.name : "").nameState;
}

export function medicationFromUnknown(value: unknown): MedNameRecord | null {
  const record = asNameRecord(value);
  if (!record) {
    return null;
  }
  const id = typeof record.id === "string" ? record.id.trim() : "";
  if (!id) {
    return null;
  }
  const classified = classifyMedName(typeof record.name === "string" ? record.name : "");
  const nameState = readMedNameState({
    name: record.name,
    nameState: record.nameState,
  });
  return {
    ...record,
    id,
    name: nameState === UNKNOWN_NAME_STATE ? UNKNOWN_NAME_DISPLAY : classified.displayName,
    nameState,
  };
}

function considerRecentName(raw: unknown, seen: Set<string>, names: string[], limit: number): void {
  if (names.length >= limit || typeof raw !== "string") {
    return;
  }
  const classified = classifyMedName(raw);
  if (classified.nameState === UNKNOWN_NAME_STATE || seen.has(classified.matchKey)) {
    return;
  }
  seen.add(classified.matchKey);
  names.push(classified.displayName);
}

export function recentUserNames(medications: unknown[], fills: unknown[], limit = RECENT_NAME_LIMIT): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (let index = medications.length - 1; index >= 0 && names.length < limit; index -= 1) {
    const row = asNameRecord(medications[index]);
    if (row) {
      considerRecentName(row.name, seen, names, limit);
    }
  }
  for (let index = fills.length - 1; index >= 0 && names.length < limit; index -= 1) {
    const row = asNameRecord(fills[index]);
    if (!row) {
      continue;
    }
    considerRecentName(
      row.displayName ?? row.name ?? row.fillName ?? row.label ?? row.peptideName,
      seen,
      names,
      limit
    );
  }
  return names;
}

export function matchNameSuggestions(query: string, dictionary: string[], limit = RECENT_NAME_LIMIT): string[] {
  if (isUnknownNameInput(query)) {
    return [];
  }
  const key = nameMatchKey(query);
  const matches: string[] = [];
  const seen = new Set<string>();
  for (const name of dictionary) {
    const classified = classifyMedName(name);
    if (classified.nameState === UNKNOWN_NAME_STATE || seen.has(classified.matchKey)) {
      continue;
    }
    if (!classified.matchKey.includes(key)) {
      continue;
    }
    seen.add(classified.matchKey);
    matches.push(classified.displayName);
    if (matches.length >= limit) {
      break;
    }
  }
  return matches;
}

export function optionalPositiveNumber(value: unknown): number | null {
  if (value === "" || value == null) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function optionalUnitLabel(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const unit = value.trim();
  return unit || undefined;
}

export interface MedicationLoadPlan {
  canLoad: boolean;
  dose: number | null;
  unit: string | undefined;
}

export interface CalculatorDoseFields {
  doseUnit: string;
  doseAmount: string;
}

export interface MedicationLoadResult {
  applied: boolean;
  next: CalculatorDoseFields;
}

/**
 * Load is allowed only when the row already stores a complete user-entered
 * calculator payload (positive dose + unit). Name-only / Unknown rows do not.
 */
export function planMedicationLoad(row: { dose?: unknown; unit?: unknown } | null | undefined): MedicationLoadPlan {
  const dose = optionalPositiveNumber(row?.dose);
  const unit = optionalUnitLabel(row?.unit);
  return {
    canLoad: dose !== null && unit !== undefined,
    dose,
    unit,
  };
}

export function canLoadMedication(row: { dose?: unknown; unit?: unknown } | null | undefined): boolean {
  return planMedicationLoad(row).canLoad;
}

export function loadMedicationIntoCalculator(
  row: { dose?: unknown; unit?: unknown } | null | undefined,
  current: CalculatorDoseFields
): MedicationLoadResult {
  const plan = planMedicationLoad(row);
  const unchanged: CalculatorDoseFields = {
    doseUnit: current.doseUnit,
    doseAmount: current.doseAmount,
  };
  if (!plan.canLoad || plan.dose === null || !plan.unit) {
    return { applied: false, next: unchanged };
  }
  return {
    applied: true,
    next: {
      doseUnit: plan.unit,
      doseAmount: String(plan.dose),
    },
  };
}

export function formatStoredDose(dose: unknown, unit?: unknown): string {
  const amount = optionalPositiveNumber(dose);
  if (amount === null) {
    return UNKNOWN_NAME_DISPLAY;
  }
  const label = optionalUnitLabel(unit);
  return label ? `${amount} ${label}` : String(amount);
}

export function formatStoredInterval(value: unknown): string {
  const days = optionalPositiveNumber(value);
  if (days === null) {
    return UNKNOWN_NAME_DISPLAY;
  }
  return days === 1 ? "every 1 day" : `every ${days} days`;
}

export function formatMedicationMeta(row: { dose?: unknown; unit?: unknown; interval?: unknown }): string {
  const dose = formatStoredDose(row.dose, row.unit);
  const interval = formatStoredInterval(row.interval);
  if (dose === UNKNOWN_NAME_DISPLAY && interval === UNKNOWN_NAME_DISPLAY) {
    return "Dose unknown · interval unknown";
  }
  if (interval === UNKNOWN_NAME_DISPLAY) {
    return `${dose} · interval unknown`;
  }
  if (dose === UNKNOWN_NAME_DISPLAY) {
    return `Dose unknown · ${interval}`;
  }
  return `${dose} · ${interval}`;
}

export function buildMedicationRecord(input: {
  id: string;
  name: string;
  existing?: Record<string, unknown> | null;
  dose?: unknown;
  unit?: unknown;
  interval?: unknown;
}): MedNameRecord {
  const classified = classifyMedName(input.name);
  const existing = input.existing && typeof input.existing === "object" ? { ...input.existing } : {};
  const dose = optionalPositiveNumber(input.dose) ?? optionalPositiveNumber(existing.dose);
  const interval = optionalPositiveNumber(input.interval) ?? optionalPositiveNumber(existing.interval);
  const unit = optionalUnitLabel(input.unit) ?? optionalUnitLabel(existing.unit);
  const next: MedNameRecord = {
    ...existing,
    id: input.id,
    name: classified.displayName,
    nameState: classified.nameState,
  };
  if (dose === null) {
    delete next.dose;
  } else {
    next.dose = dose;
  }
  if (!unit) {
    delete next.unit;
  } else {
    next.unit = unit;
  }
  if (interval === null) {
    delete next.interval;
  } else {
    next.interval = interval;
  }
  return next;
}

export function upsertMedication(list: unknown[], record: MedNameRecord): unknown[] {
  const next = list.slice();
  const index = next.findIndex((row) => asNameRecord(row)?.id === record.id);
  if (index >= 0) {
    next[index] = record;
    return next;
  }
  next.push(record);
  return next;
}

export function removeMedication(list: unknown[], id: string): unknown[] {
  return list.filter((row) => asNameRecord(row)?.id !== id);
}
