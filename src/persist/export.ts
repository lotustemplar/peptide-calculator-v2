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
