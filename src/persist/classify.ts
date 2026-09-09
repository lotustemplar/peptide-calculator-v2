import { IMPORT_BLOCKED_CORRUPT, IMPORT_BLOCKED_NEWER } from "./copy";
import { asRecord } from "./fields";
import type { ClassifyResult, SchemaClass, SourceGeneration } from "./types";

function readSchemaVersion(raw: unknown): number | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }
  const version = record.schemaVersion;
  if (typeof version === "number" && Number.isInteger(version) && Number.isFinite(version) && version >= 1) {
    return version;
  }
  return null;
}

export function detectGeneration(raw: unknown): SourceGeneration {
  const record = asRecord(raw);
  if (!record) {
    return "unknown";
  }
  const version = readSchemaVersion(record);
  const entities = asRecord(record.entities);
  if (version === 3) {
    return "backup-v3";
  }
  const hasHistories = record.histories != null;
  const hasSchedules = Array.isArray(record.schedules);
  const hasOccurrences = Array.isArray(record.occurrences);
  const hasFills = Array.isArray(record.fills);
  const hasMedications = Array.isArray(record.medications);
  const hasEntities = Boolean(entities && (entities.fills || entities.schedules || entities.occurrences));
  if (hasHistories && !hasSchedules && !hasOccurrences && !hasEntities) {
    return "baseline-rebuild";
  }
  if (hasSchedules || hasOccurrences || hasFills || hasMedications || hasEntities) {
    return "github-main";
  }
  if (hasHistories) {
    return "baseline-rebuild";
  }
  return "unknown";
}

export function classifyBackup(raw: unknown): ClassifyResult {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      class: "corrupt",
      generation: "unknown",
      schemaVersion: null,
      applyBlocked: true,
      applyBlockedReason: IMPORT_BLOCKED_CORRUPT,
    };
  }
  const schemaVersion = readSchemaVersion(raw);
  const generation = detectGeneration(raw);

  if (schemaVersion === null) {
    return {
      class: "legacy-unversioned",
      generation,
      schemaVersion: null,
      applyBlocked: false,
      applyBlockedReason: null,
    };
  }
  if (schemaVersion === 3) {
    return {
      class: "current",
      generation: "backup-v3",
      schemaVersion: 3,
      applyBlocked: false,
      applyBlockedReason: null,
    };
  }
  if (schemaVersion === 1 || schemaVersion === 2) {
    return {
      class: "legacy-versioned",
      generation: generation === "unknown" ? "github-main" : generation,
      schemaVersion,
      applyBlocked: false,
      applyBlockedReason: null,
    };
  }
  if (schemaVersion >= 4) {
    return {
      class: "unknown-newer",
      generation: "unknown",
      schemaVersion,
      applyBlocked: true,
      applyBlockedReason: IMPORT_BLOCKED_NEWER,
    };
  }
  return {
    class: "legacy-unversioned",
    generation,
    schemaVersion,
    applyBlocked: true,
    applyBlockedReason: IMPORT_BLOCKED_CORRUPT,
  };
}

export function schemaClassFromVersion(schemaVersion: number | null): SchemaClass {
  if (schemaVersion === null) {
    return "legacy-unversioned";
  }
  if (schemaVersion === 3) {
    return "current";
  }
  if (schemaVersion === 1 || schemaVersion === 2) {
    return "legacy-versioned";
  }
  if (schemaVersion >= 4) {
    return "unknown-newer";
  }
  return "legacy-unversioned";
}
