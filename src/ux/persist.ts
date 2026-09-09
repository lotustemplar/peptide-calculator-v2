/**
 * Atomic local persistence for coupled fills + schedules + occurrences.
 * Canonical write is one JSON envelope. Legacy keys are read/write mirrors.
 */

import { OCCURRENCES_STORAGE_KEY, type AppPersistState } from "./adapter";

export { OCCURRENCES_STORAGE_KEY };
export const ENVELOPE_STORAGE_KEY = "peptide-calculator-v2-p0ux-store";
export const FILLS_STORAGE_KEY = "peptide-calculator-v2-fills";
export const SCHEDULES_STORAGE_KEY = "peptide-calculator-v2-schedules";
export const MEDICATIONS_STORAGE_KEY = "peptide-calculator-v2-medications";

export const PERSIST_WRITE_STEPS = [
  ENVELOPE_STORAGE_KEY,
  FILLS_STORAGE_KEY,
  SCHEDULES_STORAGE_KEY,
  OCCURRENCES_STORAGE_KEY,
  MEDICATIONS_STORAGE_KEY,
] as const;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface PersistEnvelope extends AppPersistState {
  version: 1;
  /** Additive. Canonical with fills/schedules/occurrences. Mirror key is best-effort. */
  medications?: unknown[];
}

export interface CommitAppStateOptions {
  medications?: unknown[];
}

function parseJsonArray(raw: string | null): unknown[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseEnvelope(raw: string | null): PersistEnvelope | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as PersistEnvelope;
    if (!parsed || parsed.version !== 1) {
      return null;
    }
    if (!Array.isArray(parsed.fills) || !Array.isArray(parsed.schedules) || !Array.isArray(parsed.occurrences)) {
      return null;
    }
    return {
      version: 1,
      fills: parsed.fills,
      schedules: parsed.schedules,
      occurrences: parsed.occurrences,
      medications: Array.isArray(parsed.medications) ? parsed.medications : undefined,
    };
  } catch {
    return null;
  }
}

export function emptyAppState(): AppPersistState {
  return { fills: [], schedules: [], occurrences: [] };
}

export function cloneAppState(state: AppPersistState): AppPersistState {
  return JSON.parse(JSON.stringify(state)) as AppPersistState;
}

export function readAppState(storage: StorageLike): AppPersistState {
  const envelope = parseEnvelope(storage.getItem(ENVELOPE_STORAGE_KEY));
  if (envelope) {
    return {
      fills: envelope.fills,
      schedules: envelope.schedules,
      occurrences: envelope.occurrences,
    };
  }
  return {
    fills: parseJsonArray(storage.getItem(FILLS_STORAGE_KEY)) as AppPersistState["fills"],
    schedules: parseJsonArray(storage.getItem(SCHEDULES_STORAGE_KEY)) as AppPersistState["schedules"],
    occurrences: parseJsonArray(storage.getItem(OCCURRENCES_STORAGE_KEY)) as AppPersistState["occurrences"],
  };
}

/** Prefer envelope medications (atomic with fills). Mirror key is fallback only. */
export function readMedications(storage: StorageLike): unknown[] {
  const envelope = parseEnvelope(storage.getItem(ENVELOPE_STORAGE_KEY));
  if (envelope && Array.isArray(envelope.medications)) {
    return envelope.medications;
  }
  return parseJsonArray(storage.getItem(MEDICATIONS_STORAGE_KEY));
}

function writeMirror(storage: StorageLike, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Mirror failure after a successful envelope write must not revert or mix
    // the canonical snapshot. Reload reads the envelope.
  }
}

/**
 * Commit fills/schedules/occurrences/medications as one recoverable unit.
 * Envelope setItem is the atomic boundary: throw => pre-op on reload.
 * Mirror writes (including medications) are best-effort after a successful envelope.
 * Taken/save callers omit `medications` so the existing envelope/key list is preserved.
 */
export function commitAppState(
  storage: StorageLike,
  next: AppPersistState,
  options?: CommitAppStateOptions
): void {
  const medications =
    options && Object.prototype.hasOwnProperty.call(options, "medications")
      ? Array.isArray(options.medications)
        ? options.medications
        : []
      : readMedications(storage);
  const envelope: PersistEnvelope = {
    version: 1,
    fills: next.fills,
    schedules: next.schedules,
    occurrences: next.occurrences,
    medications,
  };
  const envelopeJson = JSON.stringify(envelope);
  const fillsJson = JSON.stringify(next.fills);
  const schedulesJson = JSON.stringify(next.schedules);
  const occurrencesJson = JSON.stringify(next.occurrences);
  const medicationsJson = JSON.stringify(medications);

  storage.setItem(ENVELOPE_STORAGE_KEY, envelopeJson);
  writeMirror(storage, FILLS_STORAGE_KEY, fillsJson);
  writeMirror(storage, SCHEDULES_STORAGE_KEY, schedulesJson);
  writeMirror(storage, OCCURRENCES_STORAGE_KEY, occurrencesJson);
  writeMirror(storage, MEDICATIONS_STORAGE_KEY, medicationsJson);
}

/** Boot helper: prefer envelope, then rewrite legacy mirrors for older readers. */
export function hydrateLegacyMirrors(storage: StorageLike): AppPersistState {
  const state = readAppState(storage);
  const medications = readMedications(storage);
  const hasEnvelope = Boolean(parseEnvelope(storage.getItem(ENVELOPE_STORAGE_KEY)));
  if (!hasEnvelope) {
    const hasLegacy =
      storage.getItem(FILLS_STORAGE_KEY) !== null ||
      storage.getItem(SCHEDULES_STORAGE_KEY) !== null ||
      storage.getItem(OCCURRENCES_STORAGE_KEY) !== null ||
      storage.getItem(MEDICATIONS_STORAGE_KEY) !== null;
    if (hasLegacy) {
      try {
        commitAppState(storage, state, { medications });
      } catch {
        return state;
      }
    }
    return state;
  }
  writeMirror(storage, FILLS_STORAGE_KEY, JSON.stringify(state.fills));
  writeMirror(storage, SCHEDULES_STORAGE_KEY, JSON.stringify(state.schedules));
  writeMirror(storage, OCCURRENCES_STORAGE_KEY, JSON.stringify(state.occurrences));
  writeMirror(storage, MEDICATIONS_STORAGE_KEY, JSON.stringify(medications));
  return state;
}

export function snapshotEqual(left: AppPersistState, right: AppPersistState): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
