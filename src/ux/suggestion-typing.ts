/**
 * Stage 6b.2 — hide sibling suggestion wrap while a name field is focused.
 * Retired from mobile-polish-fix.js attachSuggestionBehavior.
 */

export const SUGGESTION_WRAP_CLASS = "fitgen-suggestion-wrap";
export const SUGGESTION_TYPING_CLASS = "is-typing";
export const SUGGESTION_FOCUS_SCROLL_MS = 120;
export const SUGGESTION_BLUR_HIDE_MS = 160;
export const SUGGESTION_INPUT_IDS = ["save-fill-name", "med-name"] as const;

export interface SuggestionClassList {
  contains(name: string): boolean;
  add(name: string): void;
  remove(name: string): void;
}

export interface SuggestionWrapNode {
  classList: SuggestionClassList;
}

export interface SuggestionInputNode {
  dataset: { fitgenTypingManaged?: string };
  parentElement?: { querySelector(selector: string): SuggestionWrapNode | null } | null;
  nextElementSibling?: SuggestionWrapNode | null;
  addEventListener(type: string, listener: () => void): void;
  scrollIntoView?(options?: { behavior?: string; block?: string }): void;
}

export interface SuggestionTimers {
  setTimeout(fn: () => void, ms: number): unknown;
}

export function findSuggestionWrap(input: SuggestionInputNode): SuggestionWrapNode | null {
  const nested = input.parentElement?.querySelector(`.${SUGGESTION_WRAP_CLASS}`) || null;
  const wrap = nested || input.nextElementSibling || null;
  if (!wrap || !wrap.classList || !wrap.classList.contains(SUGGESTION_WRAP_CLASS)) {
    return null;
  }
  return wrap;
}

export function planSuggestionFocus(): {
  addTyping: true;
  scrollDelayMs: number;
  scroll: { behavior: "smooth"; block: "center" };
} {
  return {
    addTyping: true,
    scrollDelayMs: SUGGESTION_FOCUS_SCROLL_MS,
    scroll: { behavior: "smooth", block: "center" },
  };
}

export function planSuggestionBlur(): { removeTypingDelayMs: number } {
  return { removeTypingDelayMs: SUGGESTION_BLUR_HIDE_MS };
}

/** Bind focus/blur when a `.fitgen-suggestion-wrap` sibling (or parent child) exists. */
export function attachSuggestionTyping(
  input: SuggestionInputNode | null | undefined,
  timers: SuggestionTimers
): boolean {
  if (!input || input.dataset.fitgenTypingManaged === "true") {
    return false;
  }
  const wrap = findSuggestionWrap(input);
  if (!wrap) {
    return false;
  }
  input.dataset.fitgenTypingManaged = "true";
  const focusPlan = planSuggestionFocus();
  input.addEventListener("focus", () => {
    wrap.classList.add(SUGGESTION_TYPING_CLASS);
    timers.setTimeout(() => {
      if (typeof input.scrollIntoView === "function") {
        input.scrollIntoView(focusPlan.scroll);
      }
    }, focusPlan.scrollDelayMs);
  });
  const blurPlan = planSuggestionBlur();
  input.addEventListener("blur", () => {
    timers.setTimeout(() => wrap.classList.remove(SUGGESTION_TYPING_CLASS), blurPlan.removeTypingDelayMs);
  });
  return true;
}
