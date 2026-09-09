import { BACKUP_SCHEMA_V3 } from "./keys";
import { cloneJson } from "./fields";
import { specFillFromGithub, specScheduleFromGithub } from "./map-github";
import { resolveTimeZone } from "../ux/adapter";
import type { BackupEnvelopeV3, GitHubAppState, SettingsRecord } from "./types";

export function buildExportDocument(
  state: GitHubAppState,
  exportedAt: string,
  settings?: Partial<SettingsRecord>
): BackupEnvelopeV3 {
  const resolved: SettingsRecord = {
    timeZone: resolveTimeZone(settings?.timeZone),
    theme: settings?.theme ?? null,
    updatedAt: settings?.updatedAt || exportedAt,
  };
  const fills = cloneJson(state.fills);
  const schedules = cloneJson(state.schedules);
  const occurrences = cloneJson(state.occurrences);
  const medications = cloneJson(state.medications);
  return {
    schemaVersion: BACKUP_SCHEMA_V3,
    exportedAt,
    entities: {
      fills: fills.map(specFillFromGithub),
      schedules: schedules.map(specScheduleFromGithub),
      occurrences,
      medications,
      settings: resolved,
    },
    fills,
    schedules,
    occurrences,
    medications,
  };
}

export function exportDocumentJson(
  state: GitHubAppState,
  exportedAt: string,
  settings?: Partial<SettingsRecord>
): string {
  return `${JSON.stringify(buildExportDocument(state, exportedAt, settings), null, 2)}\n`;
}

/** Local file only. Never Web Share / navigator.share. FR-EXP-001. */
export type LocalExportMode = "native" | "download";

export interface LocalBackupWriter {
  nativeExport?: (json: string, filename: string) => unknown;
  download: (json: string, filename: string) => void;
}

export function chooseLocalExportMode(
  nativeBackup: { exportBackup?: unknown } | null | undefined
): LocalExportMode {
  if (nativeBackup && typeof nativeBackup.exportBackup === "function") {
    return "native";
  }
  return "download";
}

/**
 * User-initiated local JSON backup. Native bridge only when it is a local file
 * operation; otherwise download. Callers must not pass a share implementation.
 */
export function writeLocalBackup(
  json: string,
  filename: string,
  writer: LocalBackupWriter
): LocalExportMode {
  if (typeof writer.nativeExport === "function") {
    try {
      const raw = writer.nativeExport(json, filename);
      let parsed: unknown = raw;
      if (typeof raw === "string") {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = { ok: true };
        }
      }
      if (parsed && typeof parsed === "object" && (parsed as { ok?: boolean }).ok !== false) {
        return "native";
      }
    } catch {
      // fall through to local download
    }
  }
  writer.download(json, filename);
  return "download";
}
