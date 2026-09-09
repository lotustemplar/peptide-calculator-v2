export {
  BACKUP_SCHEMA_V3,
  BASELINE_ENVELOPE_KEY,
  ENVELOPE_STORAGE_KEY,
  FILLS_STORAGE_KEY,
  MEDICATIONS_STORAGE_KEY,
  OCCURRENCES_STORAGE_KEY,
  PERSIST_WRITE_STEPS,
  PROTECTED_WRITE_KEYS,
  RECOVERY_SLOT_KEY,
  RECOVERY_SLOT_PENDING_KEY,
  RECOVERY_TTL_MS,
  SCHEDULES_STORAGE_KEY,
} from "./keys";

export {
  BASELINE_COEXIST_NOTE,
  EXPORT_CONFIRM_CANCEL,
  EXPORT_CONFIRM_PRIMARY,
  EXPORT_CONFIRM_TITLE,
  EXPORT_PLAINTEXT_WARNING,
  IMPORT_APPLY_ERROR,
  IMPORT_BLOCKED_CORRUPT,
  IMPORT_BLOCKED_EMPTY,
  IMPORT_BLOCKED_NEWER,
  IMPORT_CANCEL,
  IMPORT_CLOSE,
  IMPORT_PREVIEW_TITLE,
  IMPORT_QUOTA_ERROR,
  IMPORT_REPLACE_BACK,
  IMPORT_REPLACE_LINK,
  IMPORT_REPLACE_PRIMARY,
  IMPORT_REPLACE_TITLE,
  IMPORT_SKIP_PRIMARY,
  RESTORE_BUTTON_LABEL,
  RESTORE_CANCEL,
  RESTORE_CORRUPT,
  RESTORE_EXPIRED,
  RESTORE_PRIMARY,
  RESTORE_TITLE,
  RESTORE_UNAVAILABLE,
  importClassLabel,
} from "./copy";

export { classifyBackup, detectGeneration, schemaClassFromVersion } from "./classify";
export { mapToV3 } from "./map";
export { mapBaselineDocument, BASELINE_SYNTHETIC_SCHEDULE_PREFIX } from "./map-baseline";
export { mapGithubDocument } from "./map-github";
export { parseBackupText, previewImport, previewBodyHtml } from "./preview";
export { applyDuplicatePolicy, githubStateEqual } from "./policy";
export {
  buildExportDocument,
  chooseLocalExportMode,
  exportDocumentJson,
  writeLocalBackup,
} from "./export";
export type { LocalBackupWriter, LocalExportMode } from "./export";
export {
  applyImport,
  previewImportFromStorage,
  restoreFromSlot,
} from "./import";
export {
  baselineKeyUnchanged,
  cloneGithubState,
  commitGithubState,
  readBaselineRaw,
  readGithubState,
} from "./writer";
export {
  attachMedicationsWriteBridge,
  hydrateLegacyMirrors,
  readMedications,
  writeMedicationsFromUi,
} from "../ux/persist";
export {
  buildRecoverySnapshot,
  guardedRemoveItem,
  guardedSetItem,
  inspectRestore,
  isQuotaError,
  isRecoveryExpired,
  readRecoverySlot,
  restoreAvailable,
  writeRecoverySlot,
} from "./recovery";

export type {
  ApplyResult,
  BackupEnvelopeV3,
  ClassifyResult,
  CollisionReport,
  DuplicatePolicy,
  GitHubAppState,
  GitHubFill,
  GitHubMedication,
  GitHubSchedule,
  ImportPreview,
  MapResult,
  QuarantineItem,
  RecoverySnapshot,
  RestoreResult,
  SchemaClass,
  SourceGeneration,
} from "./types";
