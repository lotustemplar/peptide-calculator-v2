import type { OccurrenceRecord } from "../occ/types";
import type { AdapterFill, AdapterSchedule } from "../ux/adapter";
import { BACKUP_SCHEMA_V3 } from "./keys";

export type SchemaClass =
  | "legacy-unversioned"
  | "legacy-versioned"
  | "current"
  | "unknown-newer"
  | "corrupt";

export type SourceGeneration = "baseline-rebuild" | "github-main" | "backup-v3" | "unknown";

export type DuplicatePolicy = "skip-existing" | "replace-all";

export type UnitLabel = "mg" | "mcg" | "IU" | string;

export interface GitHubFill extends AdapterFill {
  savedId: string;
}

export interface GitHubSchedule extends AdapterSchedule {
  id: string;
}

export interface GitHubMedication {
  id: string;
  name: string;
  dose?: unknown;
  unit?: unknown;
  interval?: unknown;
  [key: string]: unknown;
}

export interface GitHubAppState {
  fills: GitHubFill[];
  schedules: GitHubSchedule[];
  occurrences: OccurrenceRecord[];
  medications: GitHubMedication[];
}

export interface SettingsRecord {
  timeZone: string;
  theme: string | null;
  updatedAt: string;
}

export interface SpecFillRecord {
  id: string;
  displayName: string;
  vialAmount: number;
  desiredDose: number;
  unit: UnitLabel;
  waterMl: number;
  concentration?: number;
  syringeCapacityMl?: number | null;
  lifecycle?: string;
  depletionRemaining?: number | null;
  createdAt?: string;
  [key: string]: unknown;
}

export interface SpecScheduleSeries {
  id: string;
  fillId: string;
  timeZone?: string;
  startCivilDate?: string;
  timeOfDay?: string;
  recurrence?: { intervalDays?: number };
  lifecycle?: string;
  takenDates?: string[];
  [key: string]: unknown;
}

export interface BackupEntities {
  fills: SpecFillRecord[];
  schedules: SpecScheduleSeries[];
  occurrences: OccurrenceRecord[];
  medications: GitHubMedication[];
  settings: SettingsRecord;
}

export interface BackupEnvelopeV3 {
  schemaVersion: typeof BACKUP_SCHEMA_V3;
  exportedAt: string;
  entities: BackupEntities;
  /** Dual-read aliases so a reverted GitHub importer can still see arrays. */
  fills: GitHubFill[];
  schedules: GitHubSchedule[];
  occurrences: OccurrenceRecord[];
  medications: GitHubMedication[];
}

export interface QuarantineItem {
  entity: string;
  id: string | null;
  field?: string;
  reason: string;
  payload?: unknown;
}

export interface ClassifyResult {
  class: SchemaClass;
  generation: SourceGeneration;
  schemaVersion: number | null;
  applyBlocked: boolean;
  applyBlockedReason: string | null;
}

export interface CollisionReport {
  fills: string[];
  schedules: string[];
  occurrences: string[];
  medications: string[];
}

export interface ImportPreview {
  class: SchemaClass;
  generation: SourceGeneration;
  schemaVersion: number | null;
  mapped: boolean;
  applyBlocked: boolean;
  applyBlockedReason: string | null;
  classLabel: string;
  counts: {
    fills: number;
    schedules: number;
    occurrences: number;
    medications: number;
    histories: number;
    quarantined: number;
  };
  collisions: CollisionReport;
  quarantine: QuarantineItem[];
  incoming: GitHubAppState;
  baselineKeyPresent: boolean;
  baselineKeyWillMutate: false;
  replaceAllWouldRemove: {
    fills: number;
    schedules: number;
    occurrences: number;
    medications: number;
  };
  warningLines: string[];
}

export interface RecoverySnapshot {
  createdAt: string;
  expiresAt: string;
  envelope: BackupEnvelopeV3;
}

export interface ApplyResult {
  ok: boolean;
  noop: boolean;
  wrote: boolean;
  code?: string;
  message?: string;
  policy?: DuplicatePolicy;
  baselineKeyUnchanged: boolean;
}

export interface RestoreResult {
  ok: boolean;
  wrote: boolean;
  code?: string;
  message?: string;
  baselineKeyUnchanged: boolean;
  expired?: boolean;
}

export interface MapResult {
  ok: boolean;
  generation: SourceGeneration;
  state: GitHubAppState;
  settings: SettingsRecord;
  quarantine: QuarantineItem[];
  historyCount: number;
  notes: string[];
}
