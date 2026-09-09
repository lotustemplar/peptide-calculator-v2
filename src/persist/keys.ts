/**
 * Storage keys for Stage 3 import safety.
 * GitHub-generation writes go through the P0.UX envelope writer.
 * The baseline rebuild key is read-only and must never be mutated here.
 */

export {
  ENVELOPE_STORAGE_KEY,
  FILLS_STORAGE_KEY,
  OCCURRENCES_STORAGE_KEY,
  PERSIST_WRITE_STEPS,
  SCHEDULES_STORAGE_KEY,
} from "../ux/persist";

/** August 2026 rebuild envelope. Stage 3 must not setItem or removeItem this key. */
export const BASELINE_ENVELOPE_KEY = "fitgen-peptide-rebuild-v1";

export const MEDICATIONS_STORAGE_KEY = "peptide-calculator-v2-medications";

/** FR-IMP-003: exactly one current restore-point slot (GitHub generation only). */
export const RECOVERY_SLOT_KEY = "peptide-calculator-v2-recovery-slot";
export const RECOVERY_SLOT_PENDING_KEY = "peptide-calculator-v2-recovery-slot-pending";

/** FR-IMP-003: 168 hours = 7 × 24 hours. */
export const RECOVERY_TTL_MS = 168 * 60 * 60 * 1000;

export const BACKUP_SCHEMA_V3 = 3 as const;

export const PROTECTED_WRITE_KEYS = [BASELINE_ENVELOPE_KEY] as const;
