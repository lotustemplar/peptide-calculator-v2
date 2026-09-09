import { occurrenceIdentityKey } from "../occ/identity";
import {
  BASELINE_COEXIST_NOTE,
  IMPORT_BLOCKED_CORRUPT,
  IMPORT_BLOCKED_EMPTY,
  IMPORT_BLOCKED_NEWER,
  IMPORT_REPLACE_LINK,
  importClassLabel,
} from "./copy";
import { classifyBackup } from "./classify";
import { asRecord, escapeHtml } from "./fields";
import { mapToV3 } from "./map";
import type { CollisionReport, GitHubAppState, ImportPreview, QuarantineItem } from "./types";

export function parseBackupText(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  if (typeof text !== "string" || !text.trim()) {
    return { ok: false, error: IMPORT_BLOCKED_CORRUPT };
  }
  try {
    const value = JSON.parse(text) as unknown;
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, error: IMPORT_BLOCKED_CORRUPT };
    }
    return { ok: true, value };
  } catch {
    return { ok: false, error: IMPORT_BLOCKED_CORRUPT };
  }
}

function emptyIncoming(): GitHubAppState {
  return { fills: [], schedules: [], occurrences: [], medications: [] };
}

function collisionsBetween(current: GitHubAppState, incoming: GitHubAppState): CollisionReport {
  const fillIds = new Set(current.fills.map((row) => row.savedId));
  const scheduleIds = new Set(current.schedules.map((row) => row.id));
  const occKeys = new Set(
    current.occurrences.map((row) => occurrenceIdentityKey(row.scheduleId, row.localCivilDate))
  );
  const medIds = new Set(current.medications.map((row) => row.id));
  return {
    fills: incoming.fills.filter((row) => fillIds.has(row.savedId)).map((row) => row.savedId),
    schedules: incoming.schedules.filter((row) => scheduleIds.has(row.id)).map((row) => row.id),
    occurrences: incoming.occurrences
      .filter((row) => occKeys.has(occurrenceIdentityKey(row.scheduleId, row.localCivilDate)))
      .map((row) => occurrenceIdentityKey(row.scheduleId, row.localCivilDate)),
    medications: incoming.medications.filter((row) => medIds.has(row.id)).map((row) => row.id),
  };
}

function blockedPreview(
  current: GitHubAppState,
  baselineKeyPresent: boolean,
  extra: Partial<ImportPreview>
): ImportPreview {
  return {
    class: "corrupt",
    generation: "unknown",
    schemaVersion: null,
    mapped: false,
    applyBlocked: true,
    applyBlockedReason: IMPORT_BLOCKED_CORRUPT,
    classLabel: importClassLabel("corrupt", "unknown"),
    counts: {
      fills: 0,
      schedules: 0,
      occurrences: 0,
      medications: 0,
      histories: 0,
      quarantined: 0,
    },
    collisions: { fills: [], schedules: [], occurrences: [], medications: [] },
    quarantine: [],
    incoming: emptyIncoming(),
    baselineKeyPresent,
    baselineKeyWillMutate: false,
    replaceAllWouldRemove: {
      fills: current.fills.length,
      schedules: current.schedules.length,
      occurrences: current.occurrences.length,
      medications: current.medications.length,
    },
    warningLines: [],
    ...extra,
  };
}

export function previewImport(input: {
  text: string;
  current: GitHubAppState;
  baselineKeyPresent?: boolean;
  timeZone?: string;
  nowIso?: string;
}): ImportPreview {
  const baselineKeyPresent = Boolean(input.baselineKeyPresent);
  const parsed = parseBackupText(input.text);
  if (!parsed.ok) {
    return blockedPreview(input.current, baselineKeyPresent, {
      applyBlockedReason: parsed.error,
      quarantine: [{ entity: "document", id: null, reason: "corrupt-json" }],
      counts: {
        fills: 0,
        schedules: 0,
        occurrences: 0,
        medications: 0,
        histories: 0,
        quarantined: 1,
      },
    });
  }

  const classified = classifyBackup(parsed.value);
  if (classified.class === "unknown-newer") {
    const record = asRecord(parsed.value);
    const quarantine: QuarantineItem[] = [
      {
        entity: "document",
        id: null,
        reason: IMPORT_BLOCKED_NEWER,
        payload: { schemaVersion: classified.schemaVersion, keys: record ? Object.keys(record) : [] },
      },
    ];
    return blockedPreview(input.current, baselineKeyPresent, {
      class: "unknown-newer",
      schemaVersion: classified.schemaVersion,
      applyBlockedReason: IMPORT_BLOCKED_NEWER,
      classLabel: importClassLabel("unknown-newer", "unknown"),
      quarantine,
      warningLines: [IMPORT_BLOCKED_NEWER],
      counts: {
        fills: 0,
        schedules: 0,
        occurrences: 0,
        medications: 0,
        histories: 0,
        quarantined: quarantine.length,
      },
    });
  }

  const mapped = mapToV3(parsed.value, input.timeZone, input.nowIso);
  const incoming = mapped.state;
  const hasEntities =
    incoming.fills.length > 0 ||
    incoming.schedules.length > 0 ||
    incoming.medications.length > 0 ||
    incoming.occurrences.length > 0;
  const applyBlocked = classified.applyBlocked || !mapped.ok || !hasEntities;
  const applyBlockedReason = applyBlocked
    ? classified.applyBlockedReason || (!mapped.ok ? IMPORT_BLOCKED_CORRUPT : IMPORT_BLOCKED_EMPTY)
    : null;
  const warningLines: string[] = [];
  if (baselineKeyPresent) {
    warningLines.push(BASELINE_COEXIST_NOTE);
  }
  if (applyBlockedReason) {
    warningLines.push(applyBlockedReason);
  }

  return {
    class: classified.class,
    generation: mapped.generation,
    schemaVersion: classified.schemaVersion,
    mapped: mapped.ok,
    applyBlocked,
    applyBlockedReason,
    classLabel: importClassLabel(classified.class, mapped.generation),
    counts: {
      fills: incoming.fills.length,
      schedules: incoming.schedules.length,
      occurrences: incoming.occurrences.length,
      medications: incoming.medications.length,
      histories: mapped.historyCount,
      quarantined: mapped.quarantine.length,
    },
    collisions: collisionsBetween(input.current, incoming),
    quarantine: mapped.quarantine,
    incoming,
    baselineKeyPresent,
    baselineKeyWillMutate: false,
    replaceAllWouldRemove: {
      fills: input.current.fills.length,
      schedules: input.current.schedules.length,
      occurrences: input.current.occurrences.length,
      medications: input.current.medications.length,
    },
    warningLines,
  };
}

export function previewBodyHtml(preview: ImportPreview): string {
  const collisionCount =
    preview.collisions.fills.length +
    preview.collisions.schedules.length +
    preview.collisions.occurrences.length +
    preview.collisions.medications.length;
  const parts = [
    `<p>${escapeHtml(preview.classLabel)}</p>`,
    `<p>Fills ${preview.counts.fills} · schedules ${preview.counts.schedules} · occurrences ${preview.counts.occurrences} · medications ${preview.counts.medications}</p>`,
    `<p>ID collisions: ${collisionCount} (skip keeps existing). Quarantined fields: ${preview.counts.quarantined}.</p>`,
  ];
  if (preview.counts.histories > 0) {
    parts.push(`<p>Rebuild histories mapped: ${preview.counts.histories}.</p>`);
  }
  for (const line of preview.warningLines) {
    parts.push(`<p>${escapeHtml(line)}</p>`);
  }
  if (!preview.applyBlocked) {
    parts.push(
      `<p><button type="button" class="secondary-button" id="fitgen-import-replace">${escapeHtml(
        IMPORT_REPLACE_LINK
      )}</button></p>`
    );
  }
  return parts.join("");
}
