import { occurrenceIdentityKey } from "../occ/identity";
import { cloneJson } from "./fields";
import type { DuplicatePolicy, GitHubAppState } from "./types";

export function applyDuplicatePolicy(
  current: GitHubAppState,
  incoming: GitHubAppState,
  policy: DuplicatePolicy
): GitHubAppState {
  if (policy === "replace-all") {
    return cloneJson(incoming);
  }

  const fillIds = new Set(current.fills.map((row) => row.savedId));
  const scheduleIds = new Set(current.schedules.map((row) => row.id));
  const occKeys = new Set(
    current.occurrences.map((row) => occurrenceIdentityKey(row.scheduleId, row.localCivilDate))
  );
  const medIds = new Set(current.medications.map((row) => row.id));

  return {
    fills: [...cloneJson(current.fills), ...incoming.fills.filter((row) => !fillIds.has(row.savedId))],
    schedules: [
      ...cloneJson(current.schedules),
      ...incoming.schedules.filter((row) => !scheduleIds.has(row.id)),
    ],
    occurrences: [
      ...cloneJson(current.occurrences),
      ...incoming.occurrences.filter(
        (row) => !occKeys.has(occurrenceIdentityKey(row.scheduleId, row.localCivilDate))
      ),
    ],
    medications: [
      ...cloneJson(current.medications),
      ...incoming.medications.filter((row) => !medIds.has(row.id)),
    ],
  };
}

export function githubStateEqual(left: GitHubAppState, right: GitHubAppState): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
