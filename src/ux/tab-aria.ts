/**
 * Stage 4 chrome a11y — keep tab aria-current aligned to the visible view.
 * Covers restore after later app.js initialize(), capture-phase tab clicks
 * that stopImmediatePropagation, and programmatic setActiveView class toggles.
 */

export interface TabAriaNode {
  id?: string;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  closest?(selector: string): TabAriaNode | null;
}

export interface TabAriaClickEvent {
  target: TabAriaNode | null;
}

export interface TabAriaRoot {
  querySelector(selector: string): TabAriaNode | null;
  querySelectorAll(selector: string): ArrayLike<TabAriaNode>;
  addEventListener(
    type: string,
    listener: (event: TabAriaClickEvent) => void,
    options?: boolean | { capture?: boolean }
  ): void;
  removeEventListener?(
    type: string,
    listener: (event: TabAriaClickEvent) => void,
    options?: boolean | { capture?: boolean }
  ): void;
}

export function currentActiveViewId(root: TabAriaRoot): string {
  const active = root.querySelector(".app-view.is-active");
  return active && active.id ? String(active.id) : "";
}

export function syncTabAria(root: TabAriaRoot): void {
  const viewId = currentActiveViewId(root);
  const tabs = root.querySelectorAll("[data-view-target]");
  for (let index = 0; index < tabs.length; index += 1) {
    const tab = tabs[index];
    if (tab.getAttribute("data-view-target") === viewId) {
      tab.setAttribute("aria-current", "page");
    } else {
      tab.removeAttribute("aria-current");
    }
  }
}

function closestTab(node: TabAriaNode | null): TabAriaNode | null {
  if (!node) {
    return null;
  }
  if (node.getAttribute("data-view-target")) {
    return node;
  }
  if (typeof node.closest === "function") {
    return node.closest("[data-view-target]");
  }
  return null;
}

export function installTabAriaSync(root: TabAriaRoot): () => void {
  syncTabAria(root);

  const Observer = typeof MutationObserver === "function" ? MutationObserver : null;
  const observer = Observer
    ? new Observer(() => {
        syncTabAria(root);
      })
    : null;
  const views = root.querySelectorAll(".app-view");
  if (observer) {
    for (let index = 0; index < views.length; index += 1) {
      observer.observe(views[index] as unknown as Node, { attributes: true, attributeFilter: ["class"] });
    }
  }

  const onClick = (event: TabAriaClickEvent) => {
    if (!closestTab(event.target)) {
      return;
    }
    const raf =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : (callback: (time: number) => void) => setTimeout(() => callback(0), 0);
    raf(() => {
      syncTabAria(root);
    });
  };
  root.addEventListener("click", onClick, true);

  return () => {
    observer?.disconnect();
    root.removeEventListener?.("click", onClick, true);
  };
}
