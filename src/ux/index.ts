export {
  CABINET_DELETE_CANCEL,
  CABINET_DELETE_PRIMARY,
  CHARACTERIZED_DEFAULTS_NOTE,
  DISCARD_CONFIRM,
  DISCARD_KEEP,
  DISCARD_TITLE,
  FIELD_DOSE_GT_VIAL_ERROR,
  FIELD_NUMBER_ERROR,
  MARK_TAKEN_LABEL,
  PERSIST_FAIL_ERROR,
  SAVE_CONFIRM_CANCEL,
  SAVE_CONFIRM_PRIMARY,
  SAVE_CONFIRM_TITLE,
  SAVE_DISCLAIMER,
  SAVE_SCHEDULE_ERROR,
  TAKEN_SNACKBAR_TEXT,
  UNDO_LABEL,
  cabinetDeleteBody,
  cabinetDeleteTitle,
  writerErrorMessage,
} from "./copy";

export {
  CHARACTERIZED_DEFAULTS,
  characterizedDefaults,
  discardWizardDraft,
  firstInvalidField,
  isWizardDirty,
  normalizeWizardValue,
  parsePositiveNumber,
  validateWizardStep,
} from "./wizard";
export type { FieldError, StepValidation, WizardStep, WizardValues } from "./wizard";

export {
  buildSaveSummary,
  summaryContainsForbiddenFraming,
  validateSaveSchedule,
} from "./save-summary";
export type { SaveScheduleValidation, SaveSummary, SaveSummaryInput, SaveSummaryRow } from "./save-summary";

export {
  FILL_LIFECYCLE_ACTIVE,
  FILL_LIFECYCLE_ARCHIVED,
  activeFills,
  activeSchedules,
  applyCabinetArchive,
  isArchivedLifecycle,
  planCabinetCascade,
} from "./cabinet-cascade";
export type { CascadeApplyInput, CascadeApplyResult, CascadeFill, CascadePlan, CascadeSchedule } from "./cabinet-cascade";

export {
  FOCUSABLE_SELECTOR,
  FOCUS_VISIBLE_PX,
  MIN_TARGET_PX,
  UNDO_SNACKBAR_MS,
  confirmAllowsEscape,
  dialogAria,
  nextFocusIndex,
  shouldCloseOnKey,
  trapTabKey,
} from "./dialog";
export type { ConfirmDialogModel, ConfirmKind } from "./dialog";

export {
  OCCURRENCES_STORAGE_KEY,
  applyWriterSnapshot,
  canUndoTaken,
  createTakenAdapter,
  fillToDepletion,
  hydrateLegacyOccurrences,
  isScheduleTakenOnDate,
  mirrorTakenDate,
  resolveScheduleFillId,
  resolveTimeZone,
  toWriterSnapshot,
} from "./adapter";
export type {
  AdapterFill,
  AdapterResult,
  AdapterSchedule,
  AppPersistState,
  TakenAdapter,
  TakenAdapterDeps,
} from "./adapter";

export {
  explicitLegacyTakenDates,
  lookupOccurrence,
  markTaken,
  materializeLegacyTakenDates,
  reloadSnapshot,
  undoTaken,
} from "../occ/index";
