import { classifyBackup, detectGeneration } from "./classify";
import { IMPORT_BLOCKED_CORRUPT, IMPORT_BLOCKED_NEWER } from "./copy";
import { mapBaselineDocument } from "./map-baseline";
import { mapGithubDocument } from "./map-github";
import type { MapResult } from "./types";

export function mapToV3(raw: unknown, timeZone?: string, nowIso?: string): MapResult {
  const classified = classifyBackup(raw);
  if (classified.class === "corrupt") {
    return {
      ok: false,
      generation: "unknown",
      state: { fills: [], schedules: [], occurrences: [], medications: [] },
      settings: { timeZone: "UTC", theme: null, updatedAt: nowIso || "2026-09-09T00:00:00.000Z" },
      quarantine: [{ entity: "document", id: null, reason: IMPORT_BLOCKED_CORRUPT, payload: raw }],
      historyCount: 0,
      notes: [],
    };
  }
  if (classified.class === "unknown-newer") {
    return {
      ok: false,
      generation: "unknown",
      state: { fills: [], schedules: [], occurrences: [], medications: [] },
      settings: { timeZone: "UTC", theme: null, updatedAt: nowIso || "2026-09-09T00:00:00.000Z" },
      quarantine: [{ entity: "document", id: null, reason: IMPORT_BLOCKED_NEWER, payload: raw }],
      historyCount: 0,
      notes: ["unknown-newer-not-applied-as-v3"],
    };
  }
  const generation = classified.generation === "unknown" ? detectGeneration(raw) : classified.generation;
  if (generation === "baseline-rebuild") {
    return mapBaselineDocument(raw, timeZone, nowIso);
  }
  const mapped = mapGithubDocument(raw, timeZone, nowIso);
  if (generation === "backup-v3") {
    return { ...mapped, generation: "backup-v3" };
  }
  return mapped;
}
