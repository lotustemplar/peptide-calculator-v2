"use strict";

/**
 * Loads the live calculator surfaces for P0.1 legacy-evidence tests.
 *
 * Production files are read from the repo root and evaluated in an isolated
 * vm. This harness does not copy formulas and does not change app.js or
 * runtime-fixes.js on disk.
 *
 * Test-only transforms (never written back):
 * - Skip app.js initialize() so the water-step path can be called without
 *   the full UI boot.
 * - Export runtime-fixes computeOptions onto the vm global so the
 *   draw-target path can be invoked without a browser.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { repoRoot } = require("../ci/lib");

const APP_JS = "app.js";
const RUNTIME_FIXES_JS = "runtime-fixes.js";

const APP_INIT_RE = /^initialize\(\);$/m;
const RUNTIME_HOOK_SITE = "function hasMedianOneSignal() {";
const RUNTIME_HOOK =
  "globalThis.__legacyEvidenceRuntimeComputeOptions = computeOptions;\n  function hasMedianOneSignal() {";

function readProductionSource(relPath) {
  const abs = path.join(repoRoot(), relPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`legacy-evidence harness: missing production file ${relPath}`);
  }
  return fs.readFileSync(abs, "utf8");
}

function createMockElement(id, initialValue) {
  const element = {
    id,
    value: initialValue === undefined ? "" : String(initialValue),
    textContent: "",
    innerHTML: "",
    className: "",
    hidden: false,
    checked: false,
    style: {},
    dataset: {},
    parentNode: null,
    children: [],
    classList: {
      toggle() {
        return false;
      },
      add() {},
      remove() {},
      contains() {
        return false;
      },
    },
    addEventListener() {},
    removeEventListener() {},
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    querySelector(selector) {
      if (selector === ".result-card" && String(this.innerHTML).includes("result-card")) {
        return createMockElement("result-card-hit");
      }
      return null;
    },
    querySelectorAll(selector) {
      const hit = this.querySelector(selector);
      return hit ? [hit] : [];
    },
    closest(selector) {
      if (selector === ".results-card") {
        return createMockElement("results-card");
      }
      return null;
    },
    scrollIntoView() {},
    focus() {},
    click() {},
  };
  return element;
}

function createBrowserShim() {
  const elementsById = new Map();

  function ensure(id, initialValue) {
    if (!elementsById.has(id)) {
      elementsById.set(id, createMockElement(id, initialValue));
    }
    return elementsById.get(id);
  }

  const defaults = {
    "vial-mg": "30",
    "dose-mg": "3",
    "syringe-max": "1",
    "max-water-ml": "3",
    "dose-unit": "mg",
  };
  for (const [id, value] of Object.entries(defaults)) {
    ensure(id, value);
  }

  [
    "calculator-form",
    "water-warning",
    "vial-amount-label",
    "dose-amount-label",
    "results-summary",
    "results-grid",
    "reset-form",
    "selected-fill",
    "current-peptides",
    "dosage-form",
    "fill-source",
    "schedule-dose-amount",
    "schedule-dose-label",
    "start-date",
    "interval-days",
    "reminder-time",
    "reminder-list",
    "calendar-list",
    "enable-notifications",
    "notification-status",
    "theme-toggle",
    "save-fill-modal",
    "save-fill-form",
    "save-fill-preview",
    "save-fill-name",
    "modal-dose-label",
    "modal-dose-display",
    "save-fill-interval",
    "save-fill-time",
    "save-fill-start-date",
    "close-save-fill",
    "cancel-save-fill",
    "peptide-suggestions",
  ].forEach((id) => ensure(id));

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
    clear() {
      storage.clear();
    },
  };

  const head = createMockElement("head");
  head.appendChild = function appendChild(child) {
    this.children.push(child);
    if (child && child.id) {
      elementsById.set(child.id, child);
    }
    return child;
  };

  const document = {
    head,
    body: createMockElement("body"),
    documentElement: createMockElement("html"),
    getElementById(id) {
      return elementsById.has(id) ? elementsById.get(id) : ensure(id);
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    createElement(tag) {
      return createMockElement(`created-${tag}`);
    },
    addEventListener() {},
    createTextNode(text) {
      return { textContent: String(text) };
    },
  };

  class HTMLElement {}

  const window = {
    APP_CONFIG: {},
    PEPTIDE_LIST: [],
    localStorage,
    document,
    HTMLElement,
    alert() {},
    setTimeout(_fn) {
      return 0;
    },
    clearTimeout() {},
    setInterval() {
      return 0;
    },
    clearInterval() {},
    addEventListener() {},
    crypto: globalThis.crypto,
    Intl,
    location: { href: "http://localhost/" },
    navigator: { userAgent: "legacy-evidence-harness" },
  };

  window.window = window;
  window.globalThis = window;

  return { document, window, localStorage, elementsById, ensure };
}

function createVmContext(shim) {
  const context = {
    window: shim.window,
    document: shim.document,
    localStorage: shim.localStorage,
    HTMLElement: shim.window.HTMLElement,
    console,
    setTimeout: shim.window.setTimeout,
    clearTimeout: shim.window.clearTimeout,
    setInterval: shim.window.setInterval,
    clearInterval: shim.window.clearInterval,
    crypto: globalThis.crypto,
    Intl,
    URL,
    Buffer,
    process,
    globalThis: null,
  };
  context.global = context;
  context.globalThis = context;
  shim.window.globalThis = context;
  return vm.createContext(context);
}

function runSource(context, filename, source) {
  const script = new vm.Script(source, { filename });
  script.runInContext(context);
}

function setInputValues(shim, inputs) {
  const mapping = [
    ["vialAmount", "vial-mg"],
    ["doseAmount", "dose-mg"],
    ["syringeMax", "syringe-max"],
    ["maxWaterMl", "max-water-ml"],
    ["unitLabel", "dose-unit"],
  ];
  for (const [key, id] of mapping) {
    if (!Object.prototype.hasOwnProperty.call(inputs, key)) {
      continue;
    }
    const raw = inputs[key];
    const element = shim.ensure(id);
    if (raw === null || raw === undefined) {
      element.value = "";
    } else {
      element.value = String(raw);
    }
  }
}

function emptyStateText(html) {
  const match = String(html).match(/class="empty-state">([\s\S]*?)<\/div>/);
  if (!match) {
    return "";
  }
  return match[1].replace(/\s+/g, " ").trim();
}

function loadAppWaterStepPath() {
  const source = readProductionSource(APP_JS);
  if (!APP_INIT_RE.test(source)) {
    throw new Error("legacy-evidence harness: app.js initialize() call site changed");
  }
  const patched = source.replace(APP_INIT_RE, "/* initialize() skipped by legacy-evidence harness */");
  const shim = createBrowserShim();
  const context = createVmContext(shim);
  runSource(context, APP_JS, patched);

  if (typeof context.renderCalculator !== "function" || typeof context.buildOptions !== "function") {
    throw new Error("legacy-evidence harness: app.js water-step functions were not loaded");
  }

  function run(inputs) {
    setInputValues(shim, inputs);
    context.renderCalculator();
    const resultsGrid = shim.ensure("results-grid");
    const html = String(resultsGrid.innerHTML || "");
    const hasSuccessCards = html.includes("result-card");
    const hasEmptyState = html.includes("empty-state");
    const vialAmount = Number(shim.ensure("vial-mg").value);
    const doseAmount = Number(shim.ensure("dose-mg").value);
    const syringeMax = Number(shim.ensure("syringe-max").value);
    const maxWaterMl = Number(shim.ensure("max-water-ml").value);
    const unitLabel = shim.ensure("dose-unit").value || "mg";

    const valid =
      context.isPositiveNumber(vialAmount) &&
      context.isPositiveNumber(doseAmount) &&
      context.isPositiveNumber(syringeMax) &&
      context.isPositiveNumber(maxWaterMl) &&
      doseAmount <= vialAmount;

    const options = valid
      ? context.buildOptions(vialAmount, doseAmount, syringeMax, maxWaterMl, unitLabel)
      : [];

    return {
      path: "app-js-water-step",
      label: "legacy-evidence",
      minDrawMl: 0.05,
      options,
      error: hasEmptyState ? emptyStateText(html) || "empty-state" : null,
      emptyState: hasEmptyState,
      hasSuccessOptionsList: hasSuccessCards,
      resultsSummary: String(shim.ensure("results-summary").textContent || ""),
    };
  }

  return {
    path: "app-js-water-step",
    label: "legacy-evidence",
    sourceFile: APP_JS,
    run,
  };
}

function loadRuntimeDrawTargetPath() {
  const source = readProductionSource(RUNTIME_FIXES_JS);
  if (!source.includes(RUNTIME_HOOK_SITE)) {
    throw new Error("legacy-evidence harness: runtime-fixes.js computeOptions hook site changed");
  }
  const patched = source.replace(RUNTIME_HOOK_SITE, RUNTIME_HOOK);
  const shim = createBrowserShim();
  const context = createVmContext(shim);
  runSource(context, RUNTIME_FIXES_JS, patched);

  const computeOptions = context.__legacyEvidenceRuntimeComputeOptions;
  if (typeof computeOptions !== "function") {
    throw new Error("legacy-evidence harness: runtime-fixes draw-target computeOptions was not exported");
  }

  function run(inputs) {
    setInputValues(shim, inputs);
    const result = computeOptions();
    const options = Array.isArray(result.options) ? result.options : [];
    return {
      path: "runtime-fixes-draw-target",
      label: "legacy-evidence",
      minDrawMl: 0.1,
      options,
      mode: result.mode || null,
      error: result.error || null,
      emptyState: result.mode === "empty" || Boolean(result.error) || options.length === 0,
      hasSuccessOptionsList: options.length > 0 && !result.error,
      resultsSummary: String(shim.ensure("results-summary").textContent || ""),
    };
  }

  return {
    path: "runtime-fixes-draw-target",
    label: "legacy-evidence",
    sourceFile: RUNTIME_FIXES_JS,
    run,
  };
}

module.exports = {
  APP_JS,
  RUNTIME_FIXES_JS,
  loadAppWaterStepPath,
  loadRuntimeDrawTargetPath,
  readProductionSource,
};
