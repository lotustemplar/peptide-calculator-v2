import { commitAppState, readAppState, type StorageLike } from "../ux/persist";
import { IMPORT_APPLY_ERROR } from "./copy";
import { cloneJson } from "./fields";
import { BASELINE_ENVELOPE_KEY, MEDICATIONS_STORAGE_KEY } from "./keys";
import { githubMedicationFromUnknown } from "./map-github";
import { guardedSetItem } from "./recovery";
import type { GitHubAppState, GitHubMedication } from "./types";

export function readGithubState(storage: StorageLike): GitHubAppState {
  const persisted = readAppState(storage);
  const medications: GitHubMedication[] = [];
  const raw = storage.getItem(MEDICATIONS_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const row of parsed) {
          const mapped = githubMedicationFromUnknown(row, []);
          if (mapped) {
            medications.push(mapped);
          }
        }
      }
    } catch {
      // Unreadable medications stay empty; import preview still runs.
    }
  }
  return {
    fills: persisted.fills as GitHubAppState["fills"],
    schedules: persisted.schedules as GitHubAppState["schedules"],
    occurrences: persisted.occurrences,
    medications,
  };
}

export function readBaselineRaw(storage: StorageLike): string | null {
  return storage.getItem(BASELINE_ENVELOPE_KEY);
}

export function baselineKeyUnchanged(storage: StorageLike, before: string | null): boolean {
  return storage.getItem(BASELINE_ENVELOPE_KEY) === before;
}

export function commitGithubState(storage: StorageLike, next: GitHubAppState): void {
  commitAppState(storage, {
    fills: next.fills,
    schedules: next.schedules,
    occurrences: next.occurrences,
  });
  guardedSetItem(storage, MEDICATIONS_STORAGE_KEY, JSON.stringify(next.medications));
}

export function tryRollbackGithubState(
  storage: StorageLike,
  previous: GitHubAppState
): { ok: boolean; message?: string } {
  try {
    commitGithubState(storage, previous);
    return { ok: true };
  } catch {
    return { ok: false, message: IMPORT_APPLY_ERROR };
  }
}

export function cloneGithubState(state: GitHubAppState): GitHubAppState {
  return cloneJson(state);
}
