import type { StorageLike } from "../ux/persist";
import { IMPORT_QUOTA_ERROR, RESTORE_CORRUPT, RESTORE_EXPIRED, RESTORE_UNAVAILABLE } from "./copy";
import { buildExportDocument } from "./export";
import { cloneJson } from "./fields";
import {
  BACKUP_SCHEMA_V3,
  BASELINE_ENVELOPE_KEY,
  RECOVERY_SLOT_KEY,
  RECOVERY_SLOT_PENDING_KEY,
  RECOVERY_TTL_MS,
} from "./keys";
import { mapToV3 } from "./map";
import type { GitHubAppState, RecoverySnapshot, RestoreResult } from "./types";

export function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  return name === "QuotaExceededError" || /quota/i.test(message);
}

export function guardedSetItem(storage: StorageLike, key: string, value: string): void {
  if (key === BASELINE_ENVELOPE_KEY) {
    throw new Error("Stage 3 import writer must not mutate fitgen-peptide-rebuild-v1");
  }
  storage.setItem(key, value);
}

export function guardedRemoveItem(storage: StorageLike, key: string): void {
  if (key === BASELINE_ENVELOPE_KEY) {
    throw new Error("Stage 3 import writer must not delete fitgen-peptide-rebuild-v1");
  }
  storage.removeItem?.(key);
}

function parseSlot(raw: string | null): RecoverySnapshot | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as RecoverySnapshot;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (typeof parsed.createdAt !== "string" || typeof parsed.expiresAt !== "string") {
      return null;
    }
    if (!parsed.envelope || parsed.envelope.schemaVersion !== BACKUP_SCHEMA_V3) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function recoveryExpiresAt(createdAtIso: string): string {
  const createdMs = Date.parse(createdAtIso);
  return new Date(createdMs + RECOVERY_TTL_MS).toISOString();
}

export function isRecoveryExpired(snapshot: RecoverySnapshot, nowMs: number): boolean {
  const expiresMs = Date.parse(snapshot.expiresAt);
  return !Number.isFinite(expiresMs) || nowMs >= expiresMs;
}

export function readRecoverySlot(storage: StorageLike): {
  snapshot: RecoverySnapshot | null;
  corrupt: boolean;
} {
  const raw = storage.getItem(RECOVERY_SLOT_KEY);
  if (!raw) {
    return { snapshot: null, corrupt: false };
  }
  const snapshot = parseSlot(raw);
  return { snapshot, corrupt: snapshot === null };
}

export function restoreAvailable(storage: StorageLike, nowMs: number): boolean {
  const { snapshot, corrupt } = readRecoverySlot(storage);
  return Boolean(snapshot && !corrupt && !isRecoveryExpired(snapshot, nowMs));
}

export function buildRecoverySnapshot(state: GitHubAppState, createdAt: string): RecoverySnapshot {
  return {
    createdAt,
    expiresAt: recoveryExpiresAt(createdAt),
    envelope: buildExportDocument(state, createdAt),
  };
}

/**
 * Write+verify the newer slot before the prior slot is replaced.
 * Pending is written first; the live slot is replaced only after verify.
 */
export function writeRecoverySlot(
  storage: StorageLike,
  snapshot: RecoverySnapshot
): { ok: true } | { ok: false; code: "QUOTA" | "VERIFY_FAILED"; message: string } {
  const serialized = JSON.stringify(snapshot);
  try {
    guardedSetItem(storage, RECOVERY_SLOT_PENDING_KEY, serialized);
  } catch (error) {
    return {
      ok: false,
      code: isQuotaError(error) ? "QUOTA" : "VERIFY_FAILED",
      message: IMPORT_QUOTA_ERROR,
    };
  }
  const pendingRaw = storage.getItem(RECOVERY_SLOT_PENDING_KEY);
  if (pendingRaw !== serialized || parseSlot(pendingRaw) === null) {
    return { ok: false, code: "VERIFY_FAILED", message: IMPORT_QUOTA_ERROR };
  }
  try {
    guardedSetItem(storage, RECOVERY_SLOT_KEY, serialized);
  } catch (error) {
    return {
      ok: false,
      code: isQuotaError(error) ? "QUOTA" : "VERIFY_FAILED",
      message: IMPORT_QUOTA_ERROR,
    };
  }
  const slotRaw = storage.getItem(RECOVERY_SLOT_KEY);
  if (slotRaw !== serialized || parseSlot(slotRaw) === null) {
    return { ok: false, code: "VERIFY_FAILED", message: IMPORT_QUOTA_ERROR };
  }
  try {
    guardedRemoveItem(storage, RECOVERY_SLOT_PENDING_KEY);
  } catch {
    // Pending leftover is not authoritative; live slot is verified.
  }
  return { ok: true };
}

export function snapshotToGithubState(snapshot: RecoverySnapshot): GitHubAppState | null {
  const mapped = mapToV3(snapshot.envelope);
  if (!mapped.ok) {
    return null;
  }
  return cloneJson(mapped.state);
}

export function restoreFailure(
  code: string,
  message: string,
  extras?: Partial<RestoreResult>
): RestoreResult {
  return {
    ok: false,
    wrote: false,
    code,
    message,
    baselineKeyUnchanged: true,
    ...extras,
  };
}

export { RESTORE_CORRUPT, RESTORE_EXPIRED, RESTORE_UNAVAILABLE };

export function inspectRestore(storage: StorageLike, nowMs: number): RestoreResult | { ok: true; snapshot: RecoverySnapshot } {
  const { snapshot, corrupt } = readRecoverySlot(storage);
  if (corrupt) {
    return restoreFailure("CORRUPT_SNAPSHOT", RESTORE_CORRUPT);
  }
  if (!snapshot) {
    return restoreFailure("UNAVAILABLE", RESTORE_UNAVAILABLE);
  }
  if (isRecoveryExpired(snapshot, nowMs)) {
    return restoreFailure("EXPIRED", RESTORE_EXPIRED, { expired: true });
  }
  return { ok: true, snapshot };
}
