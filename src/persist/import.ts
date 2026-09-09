import type { StorageLike } from "../ux/persist";
import {
  IMPORT_APPLY_ERROR,
  IMPORT_QUOTA_ERROR,
  RESTORE_CORRUPT,
} from "./copy";
import { applyDuplicatePolicy, githubStateEqual } from "./policy";
import { previewImport } from "./preview";
import {
  buildRecoverySnapshot,
  inspectRestore,
  snapshotToGithubState,
  writeRecoverySlot,
} from "./recovery";
import type { ApplyResult, DuplicatePolicy, ImportPreview, RestoreResult } from "./types";
import {
  baselineKeyUnchanged,
  cloneGithubState,
  commitGithubState,
  readBaselineRaw,
  readGithubState,
  tryRollbackGithubState,
} from "./writer";

function isoFromMs(nowMs: number): string {
  return new Date(nowMs).toISOString();
}

export function previewImportFromStorage(
  storage: StorageLike,
  text: string,
  timeZone?: string,
  nowIso?: string
): ImportPreview {
  return previewImport({
    text,
    current: readGithubState(storage),
    baselineKeyPresent: readBaselineRaw(storage) !== null,
    timeZone,
    nowIso,
  });
}

/**
 * Cancel is a no-op: never call applyImport.
 * Apply writes GitHub-generation keys only after a verified recovery snapshot.
 */
export function applyImport(
  storage: StorageLike,
  preview: ImportPreview,
  policy: DuplicatePolicy,
  nowMs: number,
  confirmReplaceAll = false
): ApplyResult {
  const baselineBefore = readBaselineRaw(storage);
  const unchanged = (): boolean => baselineKeyUnchanged(storage, baselineBefore);

  if (preview.applyBlocked) {
    return {
      ok: false,
      noop: true,
      wrote: false,
      code: "APPLY_BLOCKED",
      message: preview.applyBlockedReason || IMPORT_APPLY_ERROR,
      policy,
      baselineKeyUnchanged: unchanged(),
    };
  }
  if (policy === "replace-all" && !confirmReplaceAll) {
    return {
      ok: false,
      noop: true,
      wrote: false,
      code: "REPLACE_CONFIRM_REQUIRED",
      message: "Replace all requires a destructive confirm.",
      policy,
      baselineKeyUnchanged: unchanged(),
    };
  }

  const before = cloneGithubState(readGithubState(storage));
  const next = applyDuplicatePolicy(before, preview.incoming, policy);
  if (githubStateEqual(before, next)) {
    return {
      ok: true,
      noop: true,
      wrote: false,
      policy,
      baselineKeyUnchanged: unchanged(),
    };
  }

  const snapshot = buildRecoverySnapshot(before, isoFromMs(nowMs));
  const slot = writeRecoverySlot(storage, snapshot);
  if (!slot.ok) {
    return {
      ok: false,
      noop: false,
      wrote: false,
      code: slot.code,
      message: slot.message || IMPORT_QUOTA_ERROR,
      policy,
      baselineKeyUnchanged: unchanged(),
    };
  }

  try {
    commitGithubState(storage, next);
  } catch {
    const rolled = tryRollbackGithubState(storage, before);
    return {
      ok: false,
      noop: false,
      wrote: false,
      code: rolled.ok ? "APPLY_FAILED_ROLLED_BACK" : "APPLY_FAILED",
      message: IMPORT_APPLY_ERROR,
      policy,
      baselineKeyUnchanged: unchanged(),
    };
  }

  return {
    ok: true,
    noop: false,
    wrote: true,
    policy,
    baselineKeyUnchanged: unchanged(),
  };
}

export function restoreFromSlot(storage: StorageLike, nowMs: number): RestoreResult {
  const baselineBefore = readBaselineRaw(storage);
  const inspect = inspectRestore(storage, nowMs);
  if (!("snapshot" in inspect) || inspect.ok !== true) {
    return inspect as RestoreResult;
  }
  const state = snapshotToGithubState(inspect.snapshot);
  if (!state) {
    return {
      ok: false,
      wrote: false,
      code: "CORRUPT_SNAPSHOT",
      message: RESTORE_CORRUPT,
      baselineKeyUnchanged: baselineKeyUnchanged(storage, baselineBefore),
    };
  }
  try {
    commitGithubState(storage, state);
  } catch {
    return {
      ok: false,
      wrote: false,
      code: "RESTORE_FAILED",
      message: IMPORT_APPLY_ERROR,
      baselineKeyUnchanged: baselineKeyUnchanged(storage, baselineBefore),
    };
  }
  return {
    ok: true,
    wrote: true,
    baselineKeyUnchanged: baselineKeyUnchanged(storage, baselineBefore),
  };
}
