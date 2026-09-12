#!/usr/bin/env node
"use strict";

/**
 * Stage 6b.2 — absorb mobile-polish-fix.js into src/ + bind (Issue #34).
 *
 * Atlas Spec: this is absorb, not prove-and-delete. Suggestion typing hide
 * and the Edit Fill modal must live on FitGenP0Ux + p0-ux-bind.js with
 * commitAppState writes. Tests fail if the overlay is removed without parity.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { parsePathAllowlist } = require("./allowlist-freeze");
const { readText, repoRoot, walkFiles } = require("./lib");
const { compileUxModules } = require("../ux/harness");
const { BUNDLE_REL, emitBrowserBundle } = require("../ux/emit-browser");

const ROOT = repoRoot();
const RETIRED = "mobile-polish-fix.js";
const REMAINING_LOADED = ["runtime-fixes.js"];
const FROZEN_GOLDENS = "659c1865da95c3197395c931e154c4267c802d8aaf7842aee83345962d013acd";
const FROZEN_APP = "489cd7b88b90e00bd2a700518312577cf5a65cf12cacc003d9a181422606a537";
const ENVELOPE_KEY = "peptide-calculator-v2-p0ux-store";
const FILLS_KEY = "peptide-calculator-v2-fills";
const SCHEDULES_KEY = "peptide-calculator-v2-schedules";
const BASELINE_KEY = "fitgen-peptide-rebuild-v1";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${message}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL  ${message}`);
}

function assertEqual(actual, expected, message) {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  assert(left === right, `${message} (actual=${left} expected=${right})`);
}

function sha256File(rel) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, rel))).digest("hex");
}

function extractScriptSrcs(html) {
  const srcs = [];
  const re = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
  let match = re.exec(html);
  while (match) {
    srcs.push(match[1].replace(/^\.\//, "").replace(/^\//, ""));
    match = re.exec(html);
  }
  return srcs;
}

function mentionsBasename(text, basename) {
  const escaped = basename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\w./-])${escaped}(?:$|[^\\w-])`).test(text);
}

function parseFixAllowlist() {
  return parsePathAllowlist(readText(path.join(ROOT, "scripts/ci/allowlists/runtime-fix-js.txt")));
}

function sampleFill(overrides) {
  return {
    savedId: "fill-6b2",
    name: "Cabinet Peptide",
    vialAmount: 10,
    waterMl: 2,
    unitLabel: "mg",
    recommendedDoseAmount: 2,
    syringeMax: 1,
    maxWaterMl: 2,
    concentrationPerMl: 5,
    ...overrides,
  };
}

function sampleSchedule(overrides) {
  return {
    id: "sched-6b2",
    fillSavedId: "fill-6b2",
    doseAmount: 2,
    doseMl: 0.4,
    intervalDays: 7,
    reminderTime: "09:00",
    startDate: "2026-09-11",
    fillSnapshot: sampleFill(),
    ...overrides,
  };
}

function createClassList(initial) {
  const values = new Set(String(initial || "").split(/\s+/).filter(Boolean));
  return {
    add(name) {
      values.add(name);
    },
    remove(name) {
      values.delete(name);
    },
    contains(name) {
      return values.has(name);
    },
    toggle(name, force) {
      if (force === true) {
        values.add(name);
        return true;
      }
      if (force === false) {
        values.delete(name);
        return false;
      }
      if (values.has(name)) {
        values.delete(name);
        return false;
      }
      values.add(name);
      return true;
    },
    toString() {
      return [...values].join(" ");
    },
  };
}

function createMockElement(id, tagName) {
  const listeners = new Map();
  const attrs = {};
  const dataset = {};
  const children = [];
  const style = { removeProperty() {} };
  const element = {
    id: id || "",
    tagName: String(tagName || "div").toUpperCase(),
    children,
    parentNode: null,
    parentElement: null,
    nextElementSibling: null,
    textContent: "",
    innerHTML: "",
    value: "",
    hidden: false,
    disabled: false,
    dataset,
    style,
    classList: createClassList(""),
    getAttribute(name) {
      if (name === "class") {
        return this.classList.toString();
      }
      if (name === "hidden") {
        return this.hidden ? "" : null;
      }
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
    setAttribute(name, value) {
      attrs[name] = String(value);
      if (name === "class") {
        this.classList = createClassList(value);
      }
      if (name === "hidden") {
        this.hidden = true;
      }
      if (name.startsWith("data-")) {
        const key = name
          .slice(5)
          .replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
        dataset[key] = String(value);
      }
    },
    removeAttribute(name) {
      delete attrs[name];
      if (name === "hidden") {
        this.hidden = false;
      }
      if (name === "data-fill-id") {
        delete dataset.fillId;
      }
    },
    closest(selector) {
      let node = this;
      while (node) {
        if (selector.startsWith("#") && node.id === selector.slice(1)) {
          return node;
        }
        if (selector.startsWith(".") && node.classList.contains(selector.slice(1))) {
          return node;
        }
        const attrMatch = /^\[([^=\]]+)=['"]([^'"]+)['"]\]$/.exec(selector);
        if (attrMatch && node.getAttribute(attrMatch[1]) === attrMatch[2]) {
          return node;
        }
        if (selector === "[data-action='edit-fill']" && node.getAttribute("data-action") === "edit-fill") {
          return node;
        }
        node = node.parentNode;
      }
      return null;
    },
    querySelector(selector) {
      const all = this.querySelectorAll(selector);
      return all[0] || null;
    },
    querySelectorAll(selector) {
      const found = [];
      const visit = (node) => {
        if (matchesSelector(node, selector)) {
          found.push(node);
        }
        for (const child of node.children || []) {
          visit(child);
        }
      };
      for (const child of this.children) {
        visit(child);
      }
      return found;
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) {
        listeners.set(type, []);
      }
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const list = listeners.get(type) || [];
      listeners.set(
        type,
        list.filter((item) => item !== fn)
      );
    },
    dispatchEvent(event) {
      for (const fn of listeners.get(event.type) || []) {
        fn(event);
      }
    },
    appendChild(child) {
      if (this.children.length) {
        this.children[this.children.length - 1].nextElementSibling = child;
      }
      child.parentNode = this;
      child.parentElement = this;
      this.children.push(child);
      if (child.id) {
        element._remember?.(child);
      }
      return child;
    },
    replaceChildren(...nodes) {
      for (const child of this.children) {
        child.parentNode = null;
        child.parentElement = null;
        child.nextElementSibling = null;
      }
      this.children.length = 0;
      this._innerHTML = "";
      for (const node of nodes) {
        this.appendChild(node);
      }
    },
    focus() {
      this._focused = true;
    },
    scrollIntoView() {
      this._scrolled = true;
    },
    click() {
      this.dispatchEvent({
        type: "click",
        target: this,
        preventDefault() {},
        stopImmediatePropagation() {},
      });
    },
    _listeners: listeners,
  };
  return element;
}

function matchesSelector(node, selector) {
  if (!node) {
    return false;
  }
  if (selector.startsWith("#")) {
    return node.id === selector.slice(1);
  }
  if (selector.startsWith(".")) {
    return node.classList && node.classList.contains(selector.slice(1));
  }
  const attrMatch = /^\[([^=\]]+)=['"]([^'"]+)['"]\]$/.exec(selector);
  if (attrMatch) {
    return node.getAttribute(attrMatch[1]) === attrMatch[2];
  }
  if (selector === "[data-view-target]") {
    return Boolean(node.getAttribute("data-view-target"));
  }
  if (selector === ".app-view.is-active") {
    return node.classList.contains("app-view") && node.classList.contains("is-active");
  }
  return node.tagName === String(selector).toUpperCase();
}

function createHarness() {
  const elementsById = new Map();
  const documentListeners = new Map();
  const scheduled = [];
  let reminderSyncs = 0;
  let reloads = 0;
  let prompts = 0;
  let alerts = 0;

  function remember(element) {
    if (element.id) {
      elementsById.set(element.id, element);
    }
    element._remember = remember;
    return element;
  }

  function parseInnerHtml(host, html) {
    const idRe = /id="([^"]+)"/g;
    let match = idRe.exec(html);
    while (match) {
      const node = remember(createMockElement(match[1], match[1].includes("form") ? "form" : "div"));
      if (match[1].includes("error")) {
        node.classList.add("is-hidden");
      }
      host.appendChild(node);
      match = idRe.exec(html);
    }
  }

  class Element {}
  class HTMLElement extends Element {}
  class HTMLInputElement extends HTMLElement {}

  for (const id of [
    "export-data",
    "backup-status",
    "restore-backup-btn",
    "fitgen-confirm-dialog",
    "fitgen-confirm-title",
    "fitgen-confirm-body",
    "fitgen-confirm-error",
    "fitgen-confirm-primary",
    "fitgen-confirm-secondary",
    "fitgen-confirm-card",
    "fitgen-confirm-backdrop",
    "fitgen-undo-snackbar",
    "fitgen-undo-snackbar-text",
    "fitgen-undo-snackbar-btn",
    "save-fill-form",
    "medications-card",
    "medications-list",
    "add-medication-form",
  ]) {
    remember(createMockElement(id, id.endsWith("form") ? "form" : "div"));
  }

  const saveInput = remember(createMockElement("save-fill-name", "input"));
  const saveWrap = remember(createMockElement("save-fill-name-chips", "div"));
  saveWrap.classList.add("fitgen-suggestion-wrap");
  const saveParent = remember(createMockElement("save-fill-name-host", "label"));
  saveParent.appendChild(saveInput);
  saveParent.appendChild(saveWrap);
  Object.setPrototypeOf(saveInput, HTMLInputElement.prototype);

  const medInput = remember(createMockElement("med-name", "input"));
  const medWrap = remember(createMockElement("med-name-chips", "div"));
  medWrap.classList.add("fitgen-suggestion-wrap");
  const medParent = remember(createMockElement("med-name-host", "label"));
  medParent.appendChild(medInput);
  medParent.appendChild(medWrap);
  Object.setPrototypeOf(medInput, HTMLInputElement.prototype);

  const editButton = remember(createMockElement("cabinet-edit-fill", "button"));
  editButton.setAttribute("data-action", "edit-fill");
  editButton.dataset.action = "edit-fill";
  editButton.dataset.id = "fill-6b2";
  editButton.setAttribute("data-id", "fill-6b2");
  Object.setPrototypeOf(editButton, HTMLElement.prototype);

  const overlay = remember(createMockElement("fitgen-edit-overlay", "div"));
  overlay.classList.add("fitgen-edit-overlay");
  overlay.hidden = true;
  overlay.innerHTML = "";
  const originalOverlayAppend = overlay.appendChild.bind(overlay);
  overlay.appendChild = function appendOverlay(child) {
    return originalOverlayAppend(child);
  };

  const body = remember(createMockElement("body", "body"));
  Object.setPrototypeOf(body, HTMLElement.prototype);
  const originalCreate = null;
  void originalCreate;

  const storage = new Map();
  const localStorage = {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(String(key), String(value));
    },
    removeItem(key) {
      storage.delete(key);
    },
  };

  const document = {
    readyState: "complete",
    body,
    activeElement: null,
    getElementById(id) {
      return elementsById.get(id) || null;
    },
    querySelector(selector) {
      if (selector.startsWith("#")) {
        return elementsById.get(selector.slice(1)) || null;
      }
      for (const node of elementsById.values()) {
        if (matchesSelector(node, selector)) {
          return node;
        }
      }
      return null;
    },
    querySelectorAll(selector) {
      const found = [];
      for (const node of elementsById.values()) {
        if (matchesSelector(node, selector)) {
          found.push(node);
        }
      }
      return found;
    },
    createElement(tag) {
      const node = createMockElement("", tag);
      Object.setPrototypeOf(node, HTMLElement.prototype);
      const originalAppend = node.appendChild.bind(node);
      node.appendChild = function appendCreated(child) {
        if (child.id) {
          remember(child);
        }
        return originalAppend(child);
      };
      const inner = {
        set(html) {
          node._innerHTML = String(html);
          parseInnerHtml(node, String(html));
        },
        get() {
          return node._innerHTML || "";
        },
      };
      Object.defineProperty(node, "innerHTML", inner);
      return node;
    },
    addEventListener(type, fn, options) {
      if (!documentListeners.has(type)) {
        documentListeners.set(type, []);
      }
      documentListeners.get(type).push({
        fn,
        capture: options === true || (options && options.capture === true),
      });
    },
    removeEventListener(type, fn) {
      const list = documentListeners.get(type) || [];
      documentListeners.set(
        type,
        list.filter((item) => item.fn !== fn)
      );
    },
  };

  class MutationObserver {
    observe() {}
    disconnect() {}
  }

  const window = {
    document,
    localStorage,
    HTMLElement,
    HTMLInputElement,
    Element,
    MutationObserver,
    navigator: { userAgent: "Stage6b2Harness" },
    state: {
      fills: [sampleFill()],
      schedules: [sampleSchedule()],
      occurrences: [],
      medications: [],
    },
    prompt() {
      prompts += 1;
      return null;
    },
    alert() {
      alerts += 1;
    },
    syncRemindersToBackend: async function syncRemindersToBackend() {
      reminderSyncs += 1;
    },
    location: {
      reload() {
        reloads += 1;
      },
    },
    setTimeout(fn, ms) {
      scheduled.push({ fn, ms });
      return scheduled.length;
    },
    clearTimeout() {},
    requestAnimationFrame(fn) {
      fn(0);
      return 1;
    },
    addEventListener() {},
  };
  window.window = window;
  window.globalThis = window;

  overlay.innerHTML = "";
  parseInnerHtml(overlay, [
    'id="fitgen-edit-title"',
    'id="fitgen-edit-note"',
    'id="fitgen-edit-error"',
    'id="fitgen-edit-form"',
    'id="fitgen-edit-name"',
    'id="fitgen-edit-water"',
    'id="fitgen-edit-dose"',
    'id="fitgen-edit-dose-label"',
    'id="fitgen-edit-interval"',
    'id="fitgen-edit-time"',
    'id="fitgen-edit-start"',
    'id="fitgen-edit-close"',
    'id="fitgen-edit-cancel"',
  ].map((part) => `<span ${part}></span>`).join(""));
  elementsById.get("fitgen-edit-error").classList.add("is-hidden");
  remember(overlay);

  function dispatchDocumentClick(target) {
    const event = {
      type: "click",
      target,
      defaultPrevented: false,
      immediateStopped: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopImmediatePropagation() {
        this.immediateStopped = true;
      },
    };
    const list = documentListeners.get("click") || [];
    for (const entry of list) {
      if (event.immediateStopped) {
        break;
      }
      entry.fn(event);
    }
    return event;
  }

  function flush(ms) {
    const due = scheduled.filter((item) => item.ms === ms || item.ms == null);
    for (const item of due) {
      if (typeof item.fn === "function") {
        item.fn();
      }
    }
  }

  return {
    window,
    document,
    localStorage,
    storage,
    elementsById,
    saveInput,
    saveWrap,
    medInput,
    medWrap,
    editButton,
    overlay,
    dispatchDocumentClick,
    flush,
    reminderSyncCount: () => reminderSyncs,
    reloadCount: () => reloads,
    promptCount: () => prompts,
    alertCount: () => alerts,
  };
}

function main() {
  console.log("Stage 6b.2 mobile-polish-fix.js absorbed into src/ + bind");

  const html = readText(path.join(ROOT, "index.html"));
  const css = readText(path.join(ROOT, "styles.css"));
  const bindSrc = readText(path.join(ROOT, "p0-ux-bind.js"));
  const runtimeSrc = readText(path.join(ROOT, "runtime-fixes.js"));
  const loadedSrcs = extractScriptSrcs(html);
  const allowed = parseFixAllowlist();

  assert(!loadedSrcs.includes(RETIRED), "index.html no longer loads mobile-polish-fix.js");
  assert(!mentionsBasename(html, RETIRED), "index.html does not mention mobile-polish-fix.js");
  assert(!fs.existsSync(path.join(ROOT, RETIRED)), "mobile-polish-fix.js is deleted from the repository root");
  const reintroduced = walkFiles(ROOT)
    .map((abs) => path.relative(ROOT, abs).split(path.sep).join("/"))
    .filter((rel) => path.posix.basename(rel) === RETIRED);
  assert(reintroduced.length === 0, "mobile-polish-fix.js is not reintroduced anywhere in the tree");
  assert(!allowed.has(RETIRED), "runtime-fix-js allowlist dropped mobile-polish-fix.js only");

  for (const patch of REMAINING_LOADED) {
    assert(loadedSrcs.includes(patch), `${patch} remains loaded by index.html`);
    assert(fs.existsSync(path.join(ROOT, patch)), `${patch} remains on disk`);
    assert(allowed.has(patch), `runtime-fix-js allowlist still lists ${patch}`);
  }
  assertEqual(
    [...allowed].sort(),
    REMAINING_LOADED.slice().sort(),
    "runtime-fix-js allowlist is exactly the remaining loaded patch"
  );

  assert(html.includes('id="fitgen-edit-overlay"'), "index.html hosts #fitgen-edit-overlay");
  assert(html.includes('role="dialog"') && html.includes('aria-modal="true"'), "edit overlay is an aria-modal dialog");
  assert(html.includes('id="fitgen-edit-title"'), "edit overlay has a labelled title");
  assert(html.includes('id="fitgen-edit-close"') && html.includes('id="fitgen-edit-cancel"'), "edit overlay has close and cancel");
  assert(html.includes('id="save-fill-name"') && html.includes('id="med-name"'), "name fields still exist for suggestion typing");
  assert(!html.includes("fitgen-mobile-polish-style"), "index.html does not inject the overlay style tag");

  assert(/\.fitgen-suggestion-wrap\s*\{/.test(css), "styles.css absorbed .fitgen-suggestion-wrap");
  assert(/\.fitgen-suggestion-wrap\.is-typing\s*\{/.test(css), "styles.css hides wrap while .is-typing");
  assert(/\.fitgen-edit-overlay\s*\{/.test(css), "styles.css absorbed .fitgen-edit-overlay");
  assert(!/fitgen-mobile-polish-style/.test(css), "styles.css does not keep the runtime style id");

  assert(bindSrc.includes("applyEditedFill"), "p0-ux-bind.js calls applyEditedFill");
  assert(bindSrc.includes("commitAppState") && bindSrc.includes("writeAppState"), "edit persist uses Stage 3 writeAppState/commitAppState");
  assert(bindSrc.includes("attachSuggestionTyping"), "p0-ux-bind.js attaches suggestion typing");
  assert(bindSrc.includes("[data-action='edit-fill']"), "p0-ux-bind.js capture-matches edit-fill");
  assert(bindSrc.includes("stopImmediatePropagation()"), "bind still stops later listeners");
  assert(bindSrc.includes("syncRemindersToBackend"), "bind keeps existing reminder sync-after-save call");
  assert(!/window\.alert\s*\(/.test(bindSrc), "bind does not use window.alert (UX-SYS-001)");
  assert(!/window\.prompt\s*\(/.test(bindSrc), "bind does not use window.prompt");
  assert(!/location\.reload\s*\(/.test(bindSrc), "bind does not page-reload after edit save");
  assert(
    !new RegExp(`setItem\\(\\s*["']${FILLS_KEY}["']`).test(bindSrc) &&
      !new RegExp(`setItem\\(\\s*["']${SCHEDULES_KEY}["']`).test(bindSrc),
    "bind does not raw-setItem fill/schedule mirror keys"
  );
  assert(!bindSrc.includes(BASELINE_KEY), "bind does not mention the baseline rebuild key");

  assert(
    runtimeSrc.includes("function editFillRecord") && /window\.prompt\(/.test(runtimeSrc),
    "runtime-fixes.js prompt editFillRecord is untouched (6c)"
  );
  assert(loadedSrcs.includes("runtime-fixes.js"), "runtime-fixes.js remains loaded after bind");
  assert(
    loadedSrcs.indexOf("p0-ux-bind.js") < loadedSrcs.indexOf("runtime-fixes.js"),
    "p0-ux-bind.js loads before runtime-fixes.js so capture owns edit-fill"
  );

  const { ux } = compileUxModules();
  assert(typeof ux.applyEditedFill === "function", "FitGenP0Ux.applyEditedFill exists");
  assert(typeof ux.attachSuggestionTyping === "function", "FitGenP0Ux.attachSuggestionTyping exists");
  assert(typeof ux.findSuggestionWrap === "function", "FitGenP0Ux.findSuggestionWrap exists");
  assertEqual(ux.EDIT_FILL_MIN_DRAW_ML, 0.05, "MIN_DRAW_ML stays 0.05");
  assertEqual(ux.SUGGESTION_INPUT_IDS.slice(), ["save-fill-name", "med-name"], "suggestion hosts are save-fill-name and med-name");
  assertEqual(ux.SUGGESTION_FOCUS_SCROLL_MS, 120, "focus scroll delay stays 120ms");
  assertEqual(ux.SUGGESTION_BLUR_HIDE_MS, 160, "blur hide delay stays 160ms");

  const ok = ux.applyEditedFill({
    fills: [sampleFill()],
    schedules: [sampleSchedule(), { id: "other", fillSavedId: "other", doseAmount: 1 }],
    fillId: "fill-6b2",
    form: {
      name: "  Renamed Fill  ",
      waterMl: "2.00",
      doseAmount: "2.5",
      intervalDays: "3",
      reminderTime: "08:30",
      startDate: "2026-09-12",
    },
  });
  assert(ok.ok === true, "valid edit apply succeeds");
  assertEqual(ok.fill.name, "Renamed Fill", "name is trimmed");
  assertEqual(ok.fill.waterMl, 2, "waterMl stored to two decimals");
  assertEqual(ok.fill.concentrationPerMl, 5, "concentration = vial / water");
  assertEqual(ok.fill.recommendedDoseAmount, 2.5, "recommended dose updates");
  assertEqual(ok.schedules[0].doseAmount, 2.5, "linked schedule dose updates");
  assertEqual(ok.schedules[0].doseMl, 0.5, "doseMl = dose / concentration (2.5 / 5)");
  assertEqual(ok.schedules[0].intervalDays, 3, "interval updates");
  assertEqual(ok.schedules[0].reminderTime, "08:30", "reminder time updates");
  assertEqual(ok.schedules[0].startDate, "2026-09-12", "start date updates");
  assertEqual(ok.schedules[1].doseAmount, 1, "unlinked schedule is unchanged");
  assertEqual(ok.schedules[0].fillSnapshot.name, "Renamed Fill", "fillSnapshot merges the edited fill");

  const invalid = ux.applyEditedFill({
    fills: [sampleFill()],
    schedules: [sampleSchedule()],
    fillId: "fill-6b2",
    form: {
      name: "x",
      waterMl: "0",
      doseAmount: "2",
      intervalDays: "7",
      reminderTime: "09:00",
      startDate: "2026-09-11",
    },
  });
  assert(invalid.ok === false && invalid.code === "INVALID_VALUES", "zero water is rejected");
  assertEqual(invalid.message, ux.EDIT_FILL_INVALID_VALUES, "invalid-values copy stays overlay-parity");

  const tooLarge = ux.applyEditedFill({
    fills: [sampleFill({ syringeMax: 0.3 })],
    schedules: [sampleSchedule()],
    fillId: "fill-6b2",
    form: {
      name: "x",
      waterMl: "2",
      doseAmount: "8",
      intervalDays: "7",
      reminderTime: "09:00",
      startDate: "2026-09-11",
    },
  });
  assert(tooLarge.ok === false && tooLarge.code === "DRAW_RANGE", "draw above syringe max is rejected");
  assert(
    tooLarge.message.includes("1.60 mL") && tooLarge.message.includes("supported draw range"),
    "draw-range message keeps overlay copy and 2-decimal mL"
  );

  const missing = ux.applyEditedFill({
    fills: [sampleFill()],
    schedules: [],
    fillId: "missing",
    form: {
      name: "x",
      waterMl: "2",
      doseAmount: "1",
      intervalDays: "7",
      reminderTime: "09:00",
      startDate: "2026-09-11",
    },
  });
  assert(missing.ok === false && missing.code === "NOT_FOUND", "unknown fill id is a silent not-found");

  const defaults = ux.editFillFormDefaults(sampleFill(), sampleSchedule(), "2026-09-11", 2);
  assertEqual(defaults.doseLabel, "Dose amount (mg)", "dose label includes unit");
  assert(defaults.note.includes("2 linked schedules"), "note reports linked schedule count");

  const timers = [];
  const wrap = {
    classList: createClassList("fitgen-suggestion-wrap"),
  };
  const input = {
    dataset: {},
    parentElement: {
      querySelector(selector) {
        return selector === ".fitgen-suggestion-wrap" ? wrap : null;
      },
    },
    nextElementSibling: wrap,
    listeners: {},
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
    scrollIntoView(options) {
      this.scrolled = options;
    },
  };
  assert(ux.findSuggestionWrap(input) === wrap, "findSuggestionWrap prefers parent child wrap");
  assert(ux.attachSuggestionTyping(input, {
    setTimeout(fn, ms) {
      timers.push({ fn, ms });
      return 1;
    },
  }) === true, "attachSuggestionTyping binds when wrap exists");
  assertEqual(input.dataset.fitgenTypingManaged, "true", "input is marked typing-managed");
  input.listeners.focus();
  assert(wrap.classList.contains("is-typing"), "focus adds is-typing immediately");
  assertEqual(timers[0].ms, 120, "scroll is scheduled at 120ms");
  timers[0].fn();
  assertEqual(input.scrolled, { behavior: "smooth", block: "center" }, "focus scrolls input into view");
  input.listeners.blur();
  assertEqual(timers[1].ms, 160, "blur removes is-typing after 160ms");
  timers[1].fn();
  assert(wrap.classList.contains("is-typing") === false, "blur removes is-typing");
  assert(
    ux.attachSuggestionTyping({ dataset: {}, parentElement: null, addEventListener() {} }, { setTimeout() {} }) === false,
    "attachSuggestionTyping no-ops when wrap is absent"
  );

  emitBrowserBundle();
  const harness = createHarness();
  const context = {
    window: harness.window,
    document: harness.document,
    localStorage: harness.localStorage,
    navigator: harness.window.navigator,
    HTMLElement: harness.window.HTMLElement,
    HTMLInputElement: harness.window.HTMLInputElement,
    Element: harness.window.Element,
    MutationObserver: harness.window.MutationObserver,
    setTimeout: harness.window.setTimeout,
    clearTimeout: harness.window.clearTimeout,
    requestAnimationFrame: harness.window.requestAnimationFrame,
    state: harness.window.state,
    console,
  };
  context.window = harness.window;
  context.globalThis = harness.window;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, BUNDLE_REL), "utf8"), context);
  context.FitGenP0Ux = context.window.FitGenP0Ux;
  context.window.FitGenP0Ux.commitAppState(harness.localStorage, {
    fills: [sampleFill()],
    schedules: [sampleSchedule()],
    occurrences: [],
  }, { medications: [] });
  try {
    vm.runInContext(fs.readFileSync(path.join(ROOT, "p0-ux-bind.js"), "utf8"), context);
    assert(true, "p0-ux-bind.js loaded in harness");
  } catch (error) {
    assert(false, `p0-ux-bind.js loaded in harness (${error && error.message})`);
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(1);
  }
  assert(context.window.FitGenP0UxBind, "p0-ux-bind.js installed FitGenP0UxBind");
  assert(typeof context.window.FitGenP0UxBind.openEditFill === "function", "bind exposes openEditFill");
  assertEqual(harness.saveInput.dataset.fitgenTypingManaged, "true", "bind attached suggestion typing on #save-fill-name");
  assertEqual(harness.medInput.dataset.fitgenTypingManaged, "true", "bind attached suggestion typing on #med-name");

  harness.saveInput._listeners.get("focus").forEach((fn) => fn());
  assert(harness.saveWrap.classList.contains("is-typing"), "bound focus hides #save-fill-name wrap");
  harness.flush(120);
  assert(harness.saveInput._scrolled === true, "bound focus scrolls #save-fill-name into view");

  const clickEvent = harness.dispatchDocumentClick(harness.editButton);
  assert(clickEvent.defaultPrevented, "bind preventDefault on edit-fill click");
  assert(clickEvent.immediateStopped, "bind stopImmediatePropagation so runtime-fixes prompt cannot win");
  assertEqual(harness.promptCount(), 0, "edit-fill click does not open window.prompt");
  assert(harness.overlay.hidden === false, "edit overlay is shown");
  assertEqual(harness.elementsById.get("fitgen-edit-name").value, "Cabinet Peptide", "overlay fills the current name");
  assertEqual(harness.elementsById.get("fitgen-edit-dose-label").textContent, "Dose amount (mg)", "dose label is unit-aware");
  harness.flush(40);
  assert(harness.elementsById.get("fitgen-edit-name")._focused === true, "focus moves to the name field on open");

  harness.elementsById.get("fitgen-edit-name").value = "Envelope Fill";
  harness.elementsById.get("fitgen-edit-water").value = "2";
  harness.elementsById.get("fitgen-edit-dose").value = "2.5";
  harness.elementsById.get("fitgen-edit-interval").value = "4";
  harness.elementsById.get("fitgen-edit-time").value = "07:15";
  harness.elementsById.get("fitgen-edit-start").value = "2026-09-13";
  const submitEvent = { type: "submit", preventDefault() { this.defaultPrevented = true; } };
  const form = harness.elementsById.get("fitgen-edit-form");
  form.dispatchEvent(submitEvent);
  return Promise.resolve()
    .then(() => new Promise((resolve) => setImmediate(resolve)))
    .then(() => {
      const envelopeRaw = harness.localStorage.getItem(ENVELOPE_KEY);
      assert(typeof envelopeRaw === "string" && envelopeRaw.length > 0, "edit save wrote the Stage 3 envelope");
      const envelope = JSON.parse(envelopeRaw);
      assertEqual(envelope.version, 1, "envelope version stays 1");
      assertEqual(envelope.fills[0].name, "Envelope Fill", "envelope fill name updated");
      assertEqual(envelope.fills[0].concentrationPerMl, 5, "envelope stores overlay-parity concentration");
      assertEqual(envelope.schedules[0].doseMl, 0.5, "envelope stores overlay-parity doseMl");
      assertEqual(envelope.schedules[0].intervalDays, 4, "envelope stores new interval");
      assertEqual(JSON.parse(harness.localStorage.getItem(FILLS_KEY))[0].name, "Envelope Fill", "legacy fill mirror is written by commitAppState, not raw overlay writeJson");
      assertEqual(harness.reminderSyncCount(), 1, "syncRemindersToBackend is called once after save");
      assertEqual(harness.reloadCount(), 0, "edit save does not location.reload");
      assertEqual(harness.alertCount(), 0, "valid save does not alert");
      assert(harness.overlay.hidden === true, "overlay closes after save");
      assert(!harness.storage.has(BASELINE_KEY), "baseline rebuild key was not written");

      assert(sha256File("app.js") === FROZEN_APP, "app.js SHA-256 unchanged (no formula-builder edits)");
      assert(
        sha256File("scripts/calc/fixtures/legacy-evidence-goldens.json") === FROZEN_GOLDENS,
        "calc goldens SHA-256 unchanged vs Stage 5/6a/6b.1 freeze"
      );

      console.log(`\n${passed} passed, ${failed} failed`);
      if (failed) {
        process.exit(1);
      }
    });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
