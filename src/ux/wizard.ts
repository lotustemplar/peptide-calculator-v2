/**
 * UX-WIZ-001..003 — wizard draft integrity and step validation.
 * Until DEC-DEFAULTS, Discard restores characterized live values only.
 * Those values must not be presented as target defaults.
 */

import { FIELD_DOSE_GT_VIAL_ERROR, FIELD_NUMBER_ERROR } from "./copy";

export const CHARACTERIZED_DEFAULTS = {
  doseUnit: "mg",
  vialAmount: "30",
  doseAmount: "3",
  syringeMax: "1",
  maxWaterMl: "3",
} as const;

export type WizardStep = 1 | 2 | 3;

export interface WizardValues {
  doseUnit: string;
  vialAmount: string;
  doseAmount: string;
  syringeMax: string;
  maxWaterMl: string;
}

export interface FieldError {
  field: keyof WizardValues;
  message: string;
}

export interface StepValidation {
  ok: boolean;
  errors: FieldError[];
}

export function characterizedDefaults(): WizardValues {
  return {
    doseUnit: CHARACTERIZED_DEFAULTS.doseUnit,
    vialAmount: CHARACTERIZED_DEFAULTS.vialAmount,
    doseAmount: CHARACTERIZED_DEFAULTS.doseAmount,
    syringeMax: CHARACTERIZED_DEFAULTS.syringeMax,
    maxWaterMl: CHARACTERIZED_DEFAULTS.maxWaterMl,
  };
}

export function normalizeWizardValue(value: string | number | null | undefined): string {
  return String(value ?? "").trim();
}

export function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function isWizardDirty(current: WizardValues, baseline: WizardValues): boolean {
  return (
    normalizeWizardValue(current.doseUnit) !== normalizeWizardValue(baseline.doseUnit) ||
    normalizeWizardValue(current.vialAmount) !== normalizeWizardValue(baseline.vialAmount) ||
    normalizeWizardValue(current.doseAmount) !== normalizeWizardValue(baseline.doseAmount) ||
    normalizeWizardValue(current.syringeMax) !== normalizeWizardValue(baseline.syringeMax) ||
    normalizeWizardValue(current.maxWaterMl) !== normalizeWizardValue(baseline.maxWaterMl)
  );
}

function numberFieldError(field: keyof WizardValues, raw: string): FieldError | null {
  if (parsePositiveNumber(raw) === null) {
    return { field, message: FIELD_NUMBER_ERROR };
  }
  return null;
}

export function validateWizardStep(step: WizardStep, values: WizardValues): StepValidation {
  const errors: FieldError[] = [];

  if (step === 1) {
    const vialError = numberFieldError("vialAmount", values.vialAmount);
    if (vialError) {
      errors.push(vialError);
    }
  }

  if (step === 2) {
    const doseError = numberFieldError("doseAmount", values.doseAmount);
    if (doseError) {
      errors.push(doseError);
    } else {
      const dose = Number(values.doseAmount);
      const vial = parsePositiveNumber(values.vialAmount);
      if (vial !== null && dose > vial) {
        errors.push({ field: "doseAmount", message: FIELD_DOSE_GT_VIAL_ERROR });
      }
    }
  }

  if (step === 3) {
    const syringeError = numberFieldError("syringeMax", values.syringeMax);
    if (syringeError) {
      errors.push(syringeError);
    }
    const waterError = numberFieldError("maxWaterMl", values.maxWaterMl);
    if (waterError) {
      errors.push(waterError);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function firstInvalidField(result: StepValidation): keyof WizardValues | null {
  return result.errors[0]?.field ?? null;
}

export function discardWizardDraft(): WizardValues {
  return characterizedDefaults();
}
