/**
 * Stage 6b.3 — absorb cabinet accordion + duplicate Due Today banner
 * from ui-polish-fix.js (Atlas Spec 5641278084).
 *
 * Forbidden (not ported): reminder/sync/notif stubs, hiding #medications-card,
 * hiding notification/theme chrome, catalog name dropdowns, raw expanded-fill writes.
 */

export const EXPANDED_FILL_STORAGE_KEY = "peptide-calculator-v2-expanded-fill";
export const UI_POLISH_EXPANDED_CARET = "▾";
export const DUE_TODAY_BANNER_RE = /due today/i;

export interface PolishStyleNode {
  style: { display: string };
}

export interface PolishQueryNode extends PolishStyleNode {
  textContent?: string | null;
  children?: ArrayLike<PolishQueryNode>;
  classList?: { add(name: string): void; remove(name: string): void };
  parentElement?: { removeChild?(node: PolishQueryNode): unknown } | null;
  querySelector(selector: string): PolishQueryNode | null;
  querySelectorAll(selector: string): ArrayLike<PolishQueryNode>;
  closest?(selector: string): PolishQueryNode | null;
  click?(): void;
  remove?(): void;
}

export interface CabinetCollapseState {
  collapsedOnce: boolean;
}

export interface CabinetCollapseResult {
  collapsedOnce: boolean;
  clicked: boolean;
}

export interface DuplicateBannerInput {
  childCount: number;
  hasDueTodayCard: boolean;
  markTakenCount: number;
}

export function isExpandedCaret(text: string | null | undefined): boolean {
  return String(text || "").includes(UI_POLISH_EXPANDED_CARET);
}

export function isDueTodayBannerText(text: string | null | undefined): boolean {
  return DUE_TODAY_BANNER_RE.test(String(text || ""));
}

export function shouldShowCabinetChild(options: { isTopRow: boolean; expanded: boolean }): boolean {
  return options.isTopRow || options.expanded;
}

export function shouldRemoveDuplicateDueTodayBanner(input: DuplicateBannerInput): boolean {
  return input.childCount >= 2 && input.hasDueTodayCard && input.markTakenCount > 1;
}

export function applyCabinetAccordionLayout(container: PolishQueryNode | null | undefined): number {
  if (!container || typeof container.querySelectorAll !== "function") {
    return 0;
  }
  const cards = container.querySelectorAll(".cabinet-card");
  let applied = 0;
  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index];
    const toggle = card.querySelector(".fill-toggle");
    if (!toggle) {
      continue;
    }
    const caret = toggle.querySelector(".caret");
    const expanded = Boolean(caret && isExpandedCaret(caret.textContent));
    const topRow =
      (typeof toggle.closest === "function"
        ? toggle.closest(".fill-header, .list-topline, .card-topline")
        : null) || toggle;
    const children = card.children || [];
    for (let childIndex = 0; childIndex < children.length; childIndex += 1) {
      const child = children[childIndex];
      if (!child.style) {
        continue;
      }
      child.style.display = shouldShowCabinetChild({
        isTopRow: child === topRow,
        expanded,
      })
        ? ""
        : "none";
    }
    if (card.classList) {
      if (expanded) {
        card.classList.remove("is-collapsed");
      } else {
        card.classList.add("is-collapsed");
      }
    }
    applied += 1;
  }
  return applied;
}

/**
 * Force-collapse the first open cabinet card via its existing toggle click.
 * Marks collapsedOnce before click so a sync re-render cannot double-toggle.
 * Does not read or write EXPANDED_FILL_STORAGE_KEY.
 */
export function collapseCabinetAtStartup(
  container: PolishQueryNode | null | undefined,
  state: CabinetCollapseState
): CabinetCollapseResult {
  if (state.collapsedOnce) {
    applyCabinetAccordionLayout(container);
    return { collapsedOnce: true, clicked: false };
  }
  if (!container || typeof container.querySelectorAll !== "function") {
    return { collapsedOnce: false, clicked: false };
  }

  const toggles = container.querySelectorAll(".fill-toggle");
  let openToggle: PolishQueryNode | null = null;
  for (let index = 0; index < toggles.length; index += 1) {
    const button = toggles[index];
    const caret = button.querySelector(".caret");
    if (caret && isExpandedCaret(caret.textContent)) {
      openToggle = button;
      break;
    }
  }

  if (openToggle && typeof openToggle.click === "function") {
    state.collapsedOnce = true;
    openToggle.click();
    return { collapsedOnce: true, clicked: true };
  }

  if (container.querySelector(".cabinet-card")) {
    applyCabinetAccordionLayout(container);
    state.collapsedOnce = true;
    return { collapsedOnce: true, clicked: false };
  }

  return { collapsedOnce: false, clicked: false };
}

export function removeDuplicateScheduleBanner(list: PolishQueryNode | null | undefined): boolean {
  if (!list || !list.children || typeof list.querySelectorAll !== "function") {
    return false;
  }
  const cards: PolishQueryNode[] = [];
  for (let index = 0; index < list.children.length; index += 1) {
    cards.push(list.children[index]);
  }
  const dueTodayCard = cards.find((card) => isDueTodayBannerText(card.textContent));
  const markButtons = list.querySelectorAll('[data-action="mark-taken"]');
  if (
    !dueTodayCard ||
    !shouldRemoveDuplicateDueTodayBanner({
      childCount: cards.length,
      hasDueTodayCard: true,
      markTakenCount: markButtons.length,
    })
  ) {
    return false;
  }
  if (typeof dueTodayCard.remove === "function") {
    dueTodayCard.remove();
    return true;
  }
  if (dueTodayCard.parentElement && typeof dueTodayCard.parentElement.removeChild === "function") {
    dueTodayCard.parentElement.removeChild(dueTodayCard);
    return true;
  }
  dueTodayCard.style.display = "none";
  return true;
}
