/**
 * Stage 3 import/export copy. Measurement/planner framing only.
 * Do not add therapeutic, clearance, or dose-advice language.
 */

export const EXPORT_PLAINTEXT_WARNING =
  "This JSON file is plaintext. It can include peptide names, amounts, and schedules saved on this device. FitGen does not send this file over the network. Continue only if you chose a place you trust.";

export const EXPORT_CONFIRM_TITLE = "Export plaintext backup?";
export const EXPORT_CONFIRM_PRIMARY = "Export JSON";
export const EXPORT_CONFIRM_CANCEL = "Cancel";

export const IMPORT_PREVIEW_TITLE = "Import preview";
export const IMPORT_SKIP_PRIMARY = "Import (keep existing)";
export const IMPORT_CANCEL = "Cancel";
export const IMPORT_REPLACE_LINK = "Replace all…";
export const IMPORT_REPLACE_TITLE = "Replace all saved data?";
export const IMPORT_REPLACE_PRIMARY = "Replace all";
export const IMPORT_REPLACE_BACK = "Back";
export const IMPORT_CLOSE = "Close";

export const RESTORE_TITLE = "Restore previous backup?";
export const RESTORE_PRIMARY = "Restore";
export const RESTORE_CANCEL = "Cancel";
export const RESTORE_BUTTON_LABEL = "Restore previous backup";

export const IMPORT_BLOCKED_NEWER =
  "This file uses a newer backup format that this version cannot apply.";
export const IMPORT_BLOCKED_CORRUPT = "This file could not be read as FitGen backup JSON.";
export const IMPORT_BLOCKED_EMPTY = "No valid fills, schedules, or medications were found.";
export const IMPORT_QUOTA_ERROR =
  "Could not save a recovery snapshot (storage is full). Nothing was imported.";
export const IMPORT_APPLY_ERROR = "Import could not finish. Previous data was kept.";
export const RESTORE_EXPIRED = "The recovery snapshot has expired. Restore is unavailable.";
export const RESTORE_CORRUPT = "The recovery snapshot is unreadable. Nothing was changed.";
export const RESTORE_UNAVAILABLE = "No recovery snapshot is available.";
export const BASELINE_COEXIST_NOTE =
  "A rebuild envelope is also present on this device. Import will not change or delete it.";

export function importClassLabel(
  schemaClass: string,
  generation: string
): string {
  switch (schemaClass) {
    case "legacy-unversioned":
      return generation === "baseline-rebuild"
        ? "Legacy unversioned (rebuild envelope) — mapped to backup schema 3"
        : "Legacy unversioned — mapped to backup schema 3";
    case "legacy-versioned":
      return "Legacy versioned — mapped to backup schema 3";
    case "current":
      return "Current backup schema 3";
    case "unknown-newer":
      return "Newer unsupported backup schema";
    case "corrupt":
      return "Unreadable backup file";
    default:
      return "Unknown backup class";
  }
}
