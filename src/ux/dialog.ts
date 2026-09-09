/**
 * UX-A11Y-002..004 — accessible in-app dialog contract.
 * Labeled dialogs, focus trap, Escape where non-destructive, focus restore.
 */

export const MIN_TARGET_PX = 44;
export const UNDO_SNACKBAR_MS = 8000;
export const FOCUS_VISIBLE_PX = 2;

export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export type ConfirmKind =
  | "discard-dirty"
  | "save-confirm"
  | "cabinet-delete"
  | "export-warning"
  | "import-preview"
  | "import-replace"
  | "import-restore";

export interface ConfirmDialogModel {
  kind: ConfirmKind;
  title: string;
  bodyText: string;
  primaryLabel: string;
  secondaryLabel: string;
  allowEscape: boolean;
  labelledBy: string;
}

export function confirmAllowsEscape(_kind: ConfirmKind): boolean {
  // Escape cancels the confirm (non-destructive). None of these confirms commit on Escape.
  return true;
}

export function nextFocusIndex(current: number, count: number, direction: 1 | -1): number {
  if (count <= 0) {
    return 0;
  }
  return (current + direction + count) % count;
}

export function trapTabKey(
  key: string,
  shiftKey: boolean,
  currentIndex: number,
  focusableCount: number
): { handled: boolean; nextIndex: number } {
  if (key !== "Tab" || focusableCount <= 0) {
    return { handled: false, nextIndex: currentIndex };
  }
  return {
    handled: true,
    nextIndex: nextFocusIndex(currentIndex, focusableCount, shiftKey ? -1 : 1),
  };
}

export function shouldCloseOnKey(key: string, allowEscape: boolean): boolean {
  return allowEscape && key === "Escape";
}

export function dialogAria(titleId: string): { role: "dialog"; ariaModal: "true"; ariaLabelledby: string } {
  return {
    role: "dialog",
    ariaModal: "true",
    ariaLabelledby: titleId,
  };
}
