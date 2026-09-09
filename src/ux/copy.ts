/**
 * P0.UX user-facing copy. Measurement/planner framing only.
 * Do not add therapeutic chips, target amounts, or dose advice.
 */

export const DISCARD_TITLE = "Discard this peptide setup?";
export const DISCARD_KEEP = "Keep editing";
export const DISCARD_CONFIRM = "Discard";

export const SAVE_DISCLAIMER =
  "You entered this dose. FitGen only calculates water and draw volume.";
export const SAVE_CONFIRM_TITLE = "Confirm fill";
export const SAVE_CONFIRM_PRIMARY = "Save peptide";
export const SAVE_CONFIRM_CANCEL = "Cancel";

export const FIELD_NUMBER_ERROR = "Enter a number greater than 0.";
export const FIELD_DOSE_GT_VIAL_ERROR = "Dose can’t be larger than the amount in the vial.";
export const SAVE_SCHEDULE_ERROR = "Enter a valid interval, time, and start date.";

export const TAKEN_SNACKBAR_TEXT = "Marked taken";
export const UNDO_LABEL = "Undo";
export const MARK_TAKEN_LABEL = "Mark as taken";

export const PERSIST_FAIL_ERROR = "Could not save this change. Nothing was updated.";

export const CHARACTERIZED_DEFAULTS_NOTE =
  "These are the current on-screen starting values. They are not a target dose.";

export function cabinetDeleteTitle(fillName: string): string {
  return `Delete ${fillName} and its schedules?`;
}

export function cabinetDeleteBody(scheduleCount: number, takenCount: number): string {
  const plans = scheduleCount === 1 ? "1 dosage plan" : `${scheduleCount} dosage plans`;
  const history =
    takenCount > 0
      ? ` Historical taken records (${takenCount}) stay on this device.`
      : " Historical taken records stay on this device.";
  return `Deletes ${plans}. Future pending doses stop.${history}`;
}

export const CABINET_DELETE_PRIMARY = "Delete fill";
export const CABINET_DELETE_CANCEL = "Cancel";

export function writerErrorMessage(code: string): string {
  switch (code) {
    case "PERSIST_FAILED":
      return PERSIST_FAIL_ERROR;
    case "UNIT_MISMATCH":
      return "This plan’s unit does not match the fill unit. Nothing was updated.";
    case "UNSUPPORTED_UNIT":
      return "This unit cannot be tracked as taken. Nothing was updated.";
    case "NOT_FOUND":
      return "This item is no longer available. Nothing was updated.";
    case "INVALID_SNAPSHOT":
      return "This taken record cannot be undone because no stored amount is available.";
    case "INVALID_DOSE":
      return "This plan is missing a usable amount. Nothing was updated.";
    case "FILL_MISMATCH":
      return "Undo does not match the stored fill. Nothing was updated.";
    case "INVALID_IDENTITY":
    case "INVALID_TIMEZONE":
    case "INVALID_INSTANT":
    case "DUPLICATE_IDENTITY":
      return "This change could not be applied. Nothing was updated.";
    default:
      return PERSIST_FAIL_ERROR;
  }
}
