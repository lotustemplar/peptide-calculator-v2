export {
  cloneOccurrence,
  cloneOccurrences,
  cloneSnapshot,
  depletionApplied,
  isSupportedDepletionUnit,
  LOCAL_CIVIL_DATE_RE,
  P0_OCCURRENCE_STATUSES,
  SUPPORTED_DEPLETION_UNITS,
} from "./types";
export type {
  FillDepletionRecord,
  OccurrenceRecord,
  OccurrenceStoreSnapshot,
  P0OccurrenceStatus,
  SupportedDepletionUnit,
  WriterFailure,
  WriterFailureCode,
  WriterResult,
  WriterSuccess,
} from "./types";

export {
  countIdentityMatches,
  deterministicOccurrenceId,
  findDuplicateIdentity,
  lookupOccurrence,
  materializeOccurrence,
  normalizeIanaTimeZone,
  normalizeIsoInstant,
  normalizeLocalCivilDate,
  normalizeScheduleId,
  occurrenceIdentityKey,
  replaceOccurrence,
} from "./identity";
export type { MaterializeFailure, MaterializeInput, MaterializeResult, MaterializeSuccess } from "./identity";

export { explicitLegacyTakenDates, materializeLegacyTakenDates } from "./legacy";
export type { LegacyMaterializeResult, LegacyScheduleSource } from "./legacy";

export {
  assertExactDepletionUnits,
  markTaken,
  reloadSnapshot,
  undoTaken,
} from "./writer";
export type { PersistCommit, TakenInput, UndoInput } from "./writer";
