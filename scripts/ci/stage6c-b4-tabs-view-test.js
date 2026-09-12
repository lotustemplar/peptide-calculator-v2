#!/usr/bin/env node
"use strict";

/**
 * Stage 6c-B4 — RF-B-016 tabs/view chrome retarget (Issue #34).
 *
 * Binding: Codex [NEXT_STAGE_AUTHORIZED] comment 5647362529.
 * Binding Spec: docs/recovery/stage-6c-inventory-spec-v2.md (RF-B-016).
 *
 * Characterize the live tab/view contract, then prove the overlay-owned
 * bindFallbackTabs capture steal and boot setActiveViewFallback chrome
 * stand down when app.js setActiveView is present. Fail closed if:
 *   - click ownership or phase drifts
 *   - default/restored view, active classes, or storage format drift
 *   - state.activeView writes leave the maintained owner
 *   - repeated clicks, reload/re-render, or invalid/missing targets change
 *   - bind/app-absent fallback disappears
 *   - B3 public FitGenRuntimeBridge setView / closeSaveModal contract drifts
 *   - RF-C-021/022/023, schedule-count, cabinet render, or allowlist change
 *   - runtime-fixes.js is de-allowlisted or unloaded
 *   - app.js / calc goldens change
 *
 * Does not execute calculator math, reminder architecture, or RF-C write paths.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { parsePathAllowlist } = require("./allowlist-freeze");
const { readText, repoRoot } = require("./lib");
const { assertPngHasVisibleContent } = require("./png-evidence");

const ROOT = repoRoot();
const REMAINING_LOADED = ["runtime-fixes.js"];
const FROZEN_GOLDENS = "659c1865da95c3197395c931e154c4267c802d8aaf7842aee83345962d013acd";
const FROZEN_APP = "489cd7b88b90e00bd2a700518312577cf5a65cf12cacc003d9a181422606a537";
const ACTIVE_VIEW_KEY = "peptide-calculator-v2-active-view";
const DEFAULT_VIEW = "calculator-view";
const VIEW_IDS = ["calculator-view", "schedule-view", "calendar-view", "cabinet-view"];
const EVIDENCE_DIR = path.join(ROOT, "docs/evidence/stage-6c-b4-tabs-view");

const FROZEN_ADJACENT = {
  setActiveViewFallback: "1bb03e5218e06da58a7b03311e44b6614d07dac70c26cdec794feb1716f6247a",
  bindNotificationButton: "d3d023c9efd955930914ae79d8f4fc50b92433999f8dd6a30cdeaf5fcb854259",
  renderScheduleIndicator: "0488c419aae55796df2f48dd031ba83f8c20f7d21bd331bbc7c3223c2cbb4e10",
  renderAllFallback: "058119c308cce97265223d43e481011b9359b16e0cb8872fef3d744482983a89",
  saveFallbackFill: "c196419821b1644f85bbb49020c21657b32b9969b4c17ba6f7b8a4fa9196becd",
  renderFallbackCabinetFields: "6cc5043d0df998c32626ae8605149f25126ae0fa2c934fb2d8a770d93fc493ed",
};

const FROZEN_PERSIST_AND_RENDER = [
  "persistAndRender(fills, schedules) {",
  "      persistState(fills, schedules);",
  "    }",
].join("\n");

const FROZEN_RENDER_ALL = [
  "renderAll() {",
  "      renderAllFallback();",
  "    }",
].join("\n");

const FROZEN_GET_PENDING_OPTION = [
  "getPendingOption() {",
  "      return pendingOption;",
  "    }",
].join("\n");

const REQUIRED_SHOTS = [
  "before-desktop-calculator.png",
  "before-mobile-calculator.png",
  "before-desktop-schedule.png",
  "before-mobile-schedule.png",
  "after-desktop-calculator.png",
  "after-mobile-calculator.png",
  "after-desktop-schedule.png",
  "after-mobile-schedule.png",
  "after-desktop-calendar.png",
  "after-mobile-calendar.png",
  "after-desktop-cabinet.png",
  "after-mobile-cabinet.png",
  "after-desktop-schedule-focus.png",
  "after-mobile-schedule-focus.png",
];

const C_REACHABLE_RES = [
  /\bpersistAndRender\b/,
  /\bpersistState\b/,
  /\brenderAllFallback\b/,
  /\bsyncRemindersToBackend\b/,
  /\bqueueUpcomingBrowserReminder\b/,
  /\bcomputeOptions\b/,
  /\bsaveFallbackFill\b/,
  /\bwriteFills\b/,
  /\bwriteSchedules\b/,
  /\bmaybeShowDailyBrowserPrompt\b/,
];

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

function sha256Text(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function sha256File(rel) {
  return sha256Text(fs.readFileSync(path.join(ROOT, rel)));
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

function parseFixAllowlist() {
  return parsePathAllowlist(readText(path.join(ROOT, "scripts/ci/allowlists/runtime-fix-js.txt")));
}

function extractNamedFunction(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) {
    return "";
  }
  const brace = src.indexOf("{", start);
  if (brace === -1) {
    return "";
  }
  let depth = 0;
  for (let index = brace; index < src.length; index += 1) {
    if (src[index] === "{") {
      depth += 1;
    } else if (src[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return src.slice(start, index + 1);
      }
    }
  }
  return "";
}

function extractBalanced(src, startNeedle) {
  const start = src.indexOf(startNeedle);
  if (start === -1) {
    return "";
  }
  const brace = src.indexOf("{", start);
  if (brace === -1) {
    return "";
  }
  let depth = 0;
  for (let index = brace; index < src.length; index += 1) {
    if (src[index] === "{") {
      depth += 1;
    } else if (src[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return src.slice(start, index + 1);
      }
    }
  }
  return "";
}

function extractBridgeAssignment(src) {
  return extractBalanced(src, "window.FitGenRuntimeBridge = {");
}

function extractBridgeMethod(bridgeSrc, name) {
  const start = bridgeSrc.search(new RegExp(`(?:^|\\n)\\s*${name}\\s*\\(`));
  if (start === -1) {
    return "";
  }
  const brace = bridgeSrc.indexOf("{", start);
  if (brace === -1) {
    return "";
  }
  let depth = 0;
  for (let index = brace; index < bridgeSrc.length; index += 1) {
    if (bridgeSrc[index] === "{") {
      depth += 1;
    } else if (bridgeSrc[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return bridgeSrc.slice(start, index + 1).trim();
      }
    }
  }
  return "";
}

function extractBootRestore(src) {
  const start = src.indexOf("  bindFallbackTabs();\n  bindNotificationButton();");
  if (start === -1) {
    return "";
  }
  const end = src.indexOf("  window.setTimeout(() => renderFallbackOptions(false), 50);", start);
  if (end === -1) {
    return "";
  }
  return src.slice(start, end);
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

function createMemoryStorage(initial) {
  const data = { ...initial };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    },
    snapshot() {
      return { ...data };
    },
  };
}

function createView(viewId, active) {
  return {
    dataset: { view: viewId },
    classList: createClassList(active ? "app-view is-active" : "app-view"),
  };
}

function createTab(viewId, active) {
  return {
    dataset: { viewTarget: viewId },
    classList: createClassList(active ? "tab-button is-active" : "tab-button"),
    listeners: { capture: [], bubble: [] },
    addEventListener(type, listener, options) {
      const capture = options === true || (options && options.capture);
      this.listeners[capture ? "capture" : "bubble"].push({ type, listener });
    },
  };
}

function dispatchClick(tab) {
  const event = {
    type: "click",
    target: tab,
    defaultPrevented: false,
    immediateStopped: false,
    propagationStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopImmediatePropagation() {
      this.immediateStopped = true;
      this.propagationStopped = true;
    },
    stopPropagation() {
      this.propagationStopped = true;
    },
  };
  for (const entry of tab.listeners.capture) {
    if (entry.type !== "click") {
      continue;
    }
    if (event.immediateStopped) {
      break;
    }
    entry.listener(event);
  }
  if (!event.immediateStopped) {
    for (const entry of tab.listeners.bubble) {
      if (entry.type !== "click") {
        continue;
      }
      if (event.immediateStopped) {
        break;
      }
      entry.listener(event);
    }
  }
  return event;
}

function activeViewIds(nodes, key) {
  return nodes.filter((node) => node.classList.contains("is-active")).map((node) => node.dataset[key]);
}

function installTabHarness(runtimeSrc, appSrc, options) {
  const owners = options.owners !== false;
  const calls = {
    setActiveView: [],
    setActiveViewFallback: [],
    bindNotificationButton: 0,
    renderAllFallback: 0,
    persistState: [],
    syncReminders: 0,
    computeOptions: 0,
    saveFallbackFill: 0,
    maybeShowDailyBrowserPrompt: 0,
  };
  const views = VIEW_IDS.map((viewId, index) => createView(viewId, index === 0));
  const viewTabs = VIEW_IDS.map((viewId, index) => createTab(viewId, index === 0));
  if (options.includeEmptyTarget) {
    viewTabs.push(createTab("", false));
    viewTabs[viewTabs.length - 1].dataset.viewTarget = options.emptyTargetValue;
  }
  const storage = createMemoryStorage(options.storage || {});
  const state = {
    activeView: options.stateView || DEFAULT_VIEW,
  };
  const windowObj = {
    localStorage: storage,
  };
  const sandbox = {
    window: windowObj,
    localStorage: storage,
    views,
    viewTabs,
    elements: { views, viewTabs },
    state,
    STORAGE_KEYS: { activeView: ACTIVE_VIEW_KEY },
    RUNTIME_FIX_STORAGE_KEYS: { activeView: ACTIVE_VIEW_KEY },
    persistState(...args) {
      calls.persistState.push(args);
    },
    bindNotificationButton() {
      calls.bindNotificationButton += 1;
    },
    renderAllFallback() {
      calls.renderAllFallback += 1;
    },
    readJsonStorage(key, fallback) {
      try {
        const value = storage.getItem(key);
        return value ? JSON.parse(value) : fallback;
      } catch {
        return fallback;
      }
    },
    syncRemindersToBackend() {
      calls.syncReminders += 1;
    },
    computeOptions() {
      calls.computeOptions += 1;
      return [];
    },
    saveFallbackFill() {
      calls.saveFallbackFill += 1;
    },
    maybeShowDailyBrowserPrompt() {
      calls.maybeShowDailyBrowserPrompt += 1;
    },
    console,
  };

  const writeStorageSrc = extractNamedFunction(appSrc, "writeStorage");
  const setActiveViewSrc = extractNamedFunction(appSrc, "setActiveView");
  const setActiveViewFallbackSrc = extractNamedFunction(runtimeSrc, "setActiveViewFallback");
  const bindFallbackTabsSrc = extractNamedFunction(runtimeSrc, "bindFallbackTabs");

  vm.createContext(sandbox);
  vm.runInContext(`${writeStorageSrc}\n${setActiveViewSrc}\n${setActiveViewFallbackSrc}`, sandbox);
  const ownerImpl = sandbox.setActiveView;
  const fallbackImpl = sandbox.setActiveViewFallback;
  sandbox.setActiveView = function setActiveViewProxy(viewId, persist) {
    calls.setActiveView.push(viewId);
    return ownerImpl(viewId, persist);
  };
  sandbox.setActiveViewFallback = function setActiveViewFallbackProxy(viewId) {
    calls.setActiveViewFallback.push(viewId);
    return fallbackImpl(viewId);
  };
  if (owners) {
    windowObj.setActiveView = sandbox.setActiveView;
  }

  vm.runInContext(bindFallbackTabsSrc, sandbox);
  const bindAppTabsSrc = `
    viewTabs.forEach((button) => {
      button.addEventListener("click", () => {
        setActiveView(button.dataset.viewTarget);
      });
    });
  `;
  if (options.bindAppTabs !== false && owners) {
    vm.runInContext(bindAppTabsSrc, sandbox);
  }
  vm.runInContext("bindFallbackTabs()", sandbox);

  return {
    sandbox,
    calls,
    views,
    viewTabs,
    storage,
    state,
    windowObj,
    rebind() {
      vm.runInContext("bindFallbackTabs()", sandbox);
    },
    bootRestore() {
      const bootSrc = extractBootRestore(runtimeSrc);
      vm.runInContext(bootSrc, sandbox);
    },
    click(viewId) {
      const tab = viewTabs.find((button) => button.dataset.viewTarget === viewId);
      if (!tab) {
        throw new Error(`missing tab ${viewId}`);
      }
      return dispatchClick(tab);
    },
  };
}

function cPathQuiet(calls, label) {
  assertEqual(calls.persistState, [], `${label}: persistState / RF-C-021 not reached`);
  assertEqual(calls.renderAllFallback, 0, `${label}: renderAllFallback / RF-C-022 not reached`);
  assertEqual(calls.syncReminders, 0, `${label}: syncRemindersToBackend not reached`);
  assertEqual(calls.computeOptions, 0, `${label}: computeOptions not reached`);
  assertEqual(calls.saveFallbackFill, 0, `${label}: saveFallbackFill not reached`);
  assertEqual(calls.maybeShowDailyBrowserPrompt, 0, `${label}: maybeShowDailyBrowserPrompt / RF-C-014 not reached`);
}

function main() {
  console.log("Stage 6c-B4 RF-B-016 tabs/view chrome retarget");

  const html = readText(path.join(ROOT, "index.html"));
  const bindSrc = readText(path.join(ROOT, "p0-ux-bind.js"));
  const appSrc = readText(path.join(ROOT, "app.js"));
  const runtimeSrc = readText(path.join(ROOT, "runtime-fixes.js"));
  const loadedSrcs = extractScriptSrcs(html);
  const allowed = parseFixAllowlist();
  const bindFallbackTabsSrc = extractNamedFunction(runtimeSrc, "bindFallbackTabs");
  const setActiveViewFallbackSrc = extractNamedFunction(runtimeSrc, "setActiveViewFallback");
  const bindEventsSrc = extractNamedFunction(appSrc, "bindEvents");
  const setActiveViewSrc = extractNamedFunction(appSrc, "setActiveView");
  const initializeSrc = extractNamedFunction(appSrc, "initialize");
  const bootSrc = extractBootRestore(runtimeSrc);
  const bridgeSrc = extractBridgeAssignment(runtimeSrc);
  const setViewSrc = extractBridgeMethod(bridgeSrc, "setView");
  const closeSaveModalSrc = extractBridgeMethod(bridgeSrc, "closeSaveModal");

  assert(loadedSrcs.includes("p0-ux-bind.js"), "index.html loads p0-ux-bind.js");
  assert(loadedSrcs.includes("app.js"), "index.html loads app.js");
  assert(loadedSrcs.includes("runtime-fixes.js"), "runtime-fixes.js remains loaded by index.html");
  assert(
    loadedSrcs.indexOf("p0-ux-bind.js") < loadedSrcs.indexOf("app.js") &&
      loadedSrcs.indexOf("app.js") < loadedSrcs.indexOf("runtime-fixes.js"),
    "load order: p0-ux-bind.js then app.js then runtime-fixes.js"
  );
  assert(fs.existsSync(path.join(ROOT, "runtime-fixes.js")), "runtime-fixes.js remains on disk");
  assert(allowed.has("runtime-fixes.js"), "runtime-fix-js allowlist still lists runtime-fixes.js");
  assertEqual([...allowed].sort(), REMAINING_LOADED.slice().sort(), "runtime-fix-js allowlist is unchanged");

  assert(
    /function\s+setActiveView\s*\(\s*viewId/.test(appSrc),
    "maintained owner setActiveView remains in app.js"
  );
  assert(
    /elements\.viewTabs\.forEach\(\(button\) => \{\s*button\.addEventListener\("click", \(\) => \{\s*setActiveView\(button\.dataset\.viewTarget\);\s*\}\);\s*\}\);/.test(
      bindEventsSrc
    ),
    "app.js tab owner is bubble-phase click -> setActiveView(dataset.viewTarget)"
  );
  assert(
    !/addEventListener\("click", \(\) => \{\s*setActiveView\(button\.dataset\.viewTarget\);[\s\S]{0,40},\s*true\s*\)/.test(
      bindEventsSrc
    ),
    "app.js tab owner is not capture-phase"
  );
  assert(!/stopImmediatePropagation/.test(bindEventsSrc), "app.js bindEvents does not steal tab clicks");
  assert(
    /state\.activeView = viewId;[\s\S]*classList\.toggle\("is-active", view\.dataset\.view === viewId\)[\s\S]*classList\.toggle\("is-active", button\.dataset\.viewTarget === viewId\)[\s\S]*writeStorage\(STORAGE_KEYS\.activeView, viewId\)/.test(
      setActiveViewSrc
    ),
    "setActiveView writes state.activeView, .is-active classes, and storage when persist is true"
  );
  assert(
    /if \(!elements\.views\.some\(\(view\) => view\.dataset\.view === state\.activeView\)\) \{\s*state\.activeView = "calculator-view";\s*\}/.test(
      initializeSrc
    ),
    "initialize fail-closes an unknown stored view to calculator-view"
  );
  assert(
    /setActiveView\(state\.activeView, false\)/.test(initializeSrc),
    "initialize restores the stored view without rewriting storage"
  );
  assert(
    /activeView:\s*readStorage\(STORAGE_KEYS\.activeView,\s*"calculator-view"\)/.test(appSrc),
    "default/missing stored view is calculator-view"
  );

  assert(
    /if\s*\(\s*typeof\s+window\.setActiveView\s*===\s*["']function["']\s*\)\s*\{\s*return;\s*\}/.test(bindFallbackTabsSrc),
    "RF-B-016: bindFallbackTabs returns without attaching capture when setActiveView exists"
  );
  assert(
    /addEventListener\(\s*"click",\s*\(event\)\s*=>\s*\{\s*event\.preventDefault\(\);\s*event\.stopImmediatePropagation\(\);\s*setActiveViewFallback\(button\.dataset\.viewTarget\);\s*\},\s*true\s*\)/.test(
      bindFallbackTabsSrc
    ),
    "RF-B-016: bind/app-absent path still capture-steals and calls setActiveViewFallback"
  );
  assert(
    /if\s*\(\s*typeof\s+window\.setActiveView\s*!==\s*["']function["']\s*\)\s*\{[\s\S]*readJsonStorage\(RUNTIME_FIX_STORAGE_KEYS\.activeView,\s*"calculator-view"\)[\s\S]*setActiveViewFallback\(savedView\)/.test(
      bootSrc
    ),
    "RF-B-016: boot restore calls setActiveViewFallback only when the maintained owner is absent"
  );
  assert(/bindFallbackTabs\(\);/.test(bootSrc), "boot still invokes bindFallbackTabs");
  assert(/bindNotificationButton\(\);/.test(bootSrc), "boot still invokes bindNotificationButton");
  assert(/renderAllFallback\(\);/.test(bootSrc), "boot still invokes renderAllFallback");

  assertEqual(
    sha256Text(setActiveViewFallbackSrc),
    FROZEN_ADJACENT.setActiveViewFallback,
    "setActiveViewFallback chrome body is unchanged"
  );
  assertEqual(
    sha256Text(extractNamedFunction(runtimeSrc, "bindNotificationButton")),
    FROZEN_ADJACENT.bindNotificationButton,
    "bindNotificationButton is unchanged"
  );
  assertEqual(
    sha256Text(extractNamedFunction(runtimeSrc, "renderScheduleIndicator")),
    FROZEN_ADJACENT.renderScheduleIndicator,
    "renderScheduleIndicator / schedule-count chrome is unchanged"
  );
  assertEqual(
    sha256Text(extractNamedFunction(runtimeSrc, "renderAllFallback")),
    FROZEN_ADJACENT.renderAllFallback,
    "renderAllFallback body is unchanged"
  );
  assertEqual(
    sha256Text(extractNamedFunction(runtimeSrc, "saveFallbackFill")),
    FROZEN_ADJACENT.saveFallbackFill,
    "RF-C-020 saveFallbackFill is unchanged"
  );
  const cabinetSrc = extractNamedFunction(runtimeSrc, "renderFallbackCabinet");
  const cabinetFieldsStart = cabinetSrc.indexOf("const fills = readFills().filter(isActiveRecord);");
  assert(cabinetFieldsStart !== -1, "RF-C-015 fallback cabinet field body remains extractable");
  assertEqual(
    sha256Text(cabinetSrc.slice(cabinetFieldsStart)),
    FROZEN_ADJACENT.renderFallbackCabinetFields,
    "RF-C-015 fallback cabinet field template is unchanged (B5 owns only the owner-present guard)"
  );
  assert(
    /setActiveViewFallback\(\s*"cabinet-view"\s*\)/.test(extractNamedFunction(runtimeSrc, "saveFallbackFill")),
    "RF-C-020 saveFallbackFill still uses in-file setActiveViewFallback"
  );

  assert(
    /typeof\s+window\.setActiveView\s*===\s*["']function["']/.test(setViewSrc),
    "B3 RF-B-017: setView still does a call-time typeof window.setActiveView check"
  );
  assert(/window\.setActiveView\(\s*viewId\s*\)/.test(setViewSrc), "B3 RF-B-017: setView still forwards viewId");
  assert(/setActiveViewFallback\(\s*viewId\s*\)/.test(setViewSrc), "B3 RF-B-017: setView still keeps the absent fallback");
  assert(
    /typeof\s+window\.closeSaveFillModal\s*===\s*["']function["']/.test(closeSaveModalSrc),
    "B3 RF-B-018: closeSaveModal still does a call-time owner check"
  );
  assertEqual(extractBridgeMethod(bridgeSrc, "persistAndRender"), FROZEN_PERSIST_AND_RENDER, "RF-C-021 persistAndRender body is unchanged");
  assertEqual(extractBridgeMethod(bridgeSrc, "renderAll"), FROZEN_RENDER_ALL, "RF-C-022 renderAll body is unchanged");
  assertEqual(extractBridgeMethod(bridgeSrc, "getPendingOption"), FROZEN_GET_PENDING_OPTION, "RF-C-023 getPendingOption body is unchanged");
  assert(
    !C_REACHABLE_RES.some((pattern) => pattern.test(bindFallbackTabsSrc)),
    "bindFallbackTabs does not reach persist/render/reminder/calculator C paths"
  );
  assert(
    !C_REACHABLE_RES.some((pattern) => pattern.test(setActiveViewFallbackSrc)),
    "setActiveViewFallback does not reach persist/render/reminder/calculator C paths"
  );

  assert(bindSrc.includes("installTabAriaSync"), "bind still installs tab aria-current sync");
  assert(/function syncTabAria/.test(bindSrc), "bind still has syncTabAria");
  assert(
    /data-view-target="calculator-view" aria-current="page"/.test(html),
    "index.html default Add tab is aria-current=page"
  );
  assertEqual(
    [...html.matchAll(/data-view-target="([^"]+)"/g)].map((match) => match[1]),
    VIEW_IDS,
    "index.html tab targets are calculator, schedule, calendar, cabinet"
  );
  assert(runtimeSrc.includes("syncRemindersToBackend"), "RF-C-003 syncRemindersToBackend is untouched");
  assert(runtimeSrc.includes("computeOptions"), "RF-C-007 computeOptions is untouched");
  assert(runtimeSrc.includes("queueUpcomingBrowserReminder"), "RF-C-009 reminder timer is untouched");
  assert(!/\bmark-missed\b/.test(runtimeSrc), "runtime-fixes.js gained no Mark missed action");
  assert(sha256File("app.js") === FROZEN_APP, "app.js SHA-256 unchanged (owners called, not rewritten)");
  assert(
    sha256File("scripts/calc/fixtures/legacy-evidence-goldens.json") === FROZEN_GOLDENS,
    "calc goldens SHA-256 unchanged"
  );

  const live = installTabHarness(runtimeSrc, appSrc, { owners: true });
  assertEqual(
    live.viewTabs.map((tab) => tab.listeners.capture.length),
    [0, 0, 0, 0],
    "owner-present bindFallbackTabs attaches no capture listeners"
  );
  assertEqual(
    live.viewTabs.map((tab) => tab.listeners.bubble.length),
    [1, 1, 1, 1],
    "owner-present tabs keep exactly the app.js bubble listener"
  );

  const firstClick = live.click("cabinet-view");
  assertEqual(firstClick.immediateStopped, false, "owner-present tab click is not capture-stopped");
  assertEqual(firstClick.defaultPrevented, false, "owner-present tab click is not preventDefaulted");
  assertEqual(live.calls.setActiveView, ["cabinet-view"], "owner-present click hits maintained setActiveView");
  assertEqual(live.calls.setActiveViewFallback, [], "owner-present click does not call setActiveViewFallback");
  assertEqual(live.state.activeView, "cabinet-view", "owner-present click writes state.activeView");
  assertEqual(activeViewIds(live.views, "view"), ["cabinet-view"], "owner-present click activates cabinet-view");
  assertEqual(activeViewIds(live.viewTabs, "viewTarget"), ["cabinet-view"], "owner-present click activates Cabinet tab");
  assertEqual(live.storage.getItem(ACTIVE_VIEW_KEY), JSON.stringify("cabinet-view"), "stored value is JSON string cabinet-view");
  assertEqual(JSON.parse(live.storage.getItem(ACTIVE_VIEW_KEY)), "cabinet-view", "stored peptide-calculator-v2-active-view parses to cabinet-view");
  cPathQuiet(live.calls, "owner-present click");

  live.click("schedule-view");
  live.click("schedule-view");
  assertEqual(
    live.calls.setActiveView,
    ["cabinet-view", "schedule-view", "schedule-view"],
    "repeated clicks keep hitting the maintained owner"
  );
  assertEqual(live.calls.setActiveViewFallback, [], "repeated clicks still skip setActiveViewFallback");
  assertEqual(live.state.activeView, "schedule-view", "repeated clicks last write is schedule-view");
  assertEqual(activeViewIds(live.views, "view"), ["schedule-view"], "repeated clicks keep .is-active on schedule-view");
  assertEqual(live.storage.getItem(ACTIVE_VIEW_KEY), JSON.stringify("schedule-view"), "repeated clicks persist JSON schedule-view");

  live.rebind();
  live.click("calendar-view");
  assertEqual(live.calls.setActiveView.at(-1), "calendar-view", "reload/re-render still hits maintained owner");
  assertEqual(
    live.viewTabs.map((tab) => tab.listeners.capture.length),
    [0, 0, 0, 0],
    "reload/re-render does not attach overlay capture when owner is present"
  );
  assertEqual(live.calls.setActiveViewFallback, [], "reload/re-render does not revive overlay chrome");
  assertEqual(live.state.activeView, "calendar-view", "reload/re-render writes state.activeView");

  const missing = live.click("calculator-view");
  live.windowObj.setActiveView("not-a-view");
  assertEqual(live.state.activeView, "not-a-view", "invalid target still writes state.activeView through the owner");
  assertEqual(activeViewIds(live.views, "view"), [], "invalid target leaves no view .is-active");
  assertEqual(activeViewIds(live.viewTabs, "viewTarget"), [], "invalid target leaves no tab .is-active");
  assertEqual(live.storage.getItem(ACTIVE_VIEW_KEY), JSON.stringify("not-a-view"), "invalid target persists JSON not-a-view");
  assertEqual(missing.immediateStopped, false, "return to calculator is still an unstopped owner click");

  const restored = installTabHarness(runtimeSrc, appSrc, {
    owners: true,
    storage: { [ACTIVE_VIEW_KEY]: JSON.stringify("schedule-view") },
    stateView: "schedule-view",
    bindAppTabs: false,
  });
  restored.windowObj.setActiveView("schedule-view", false);
  assertEqual(restored.state.activeView, "schedule-view", "restored view writes state.activeView");
  assertEqual(activeViewIds(restored.views, "view"), ["schedule-view"], "restored view activates schedule-view");
  assertEqual(restored.storage.getItem(ACTIVE_VIEW_KEY), JSON.stringify("schedule-view"), "restore persist=false keeps stored JSON schedule-view");

  const missingStore = installTabHarness(runtimeSrc, appSrc, {
    owners: true,
    storage: {},
    stateView: DEFAULT_VIEW,
    bindAppTabs: false,
  });
  missingStore.windowObj.setActiveView(DEFAULT_VIEW, false);
  assertEqual(missingStore.state.activeView, DEFAULT_VIEW, "default/missing storage stays calculator-view");
  assertEqual(activeViewIds(missingStore.views, "view"), [DEFAULT_VIEW], "default view activates calculator-view");
  assertEqual(missingStore.storage.getItem(ACTIVE_VIEW_KEY), null, "default restore does not invent a storage write");

  const invalidStore = installTabHarness(runtimeSrc, appSrc, {
    owners: true,
    storage: { [ACTIVE_VIEW_KEY]: JSON.stringify("bogus-view") },
    stateView: DEFAULT_VIEW,
  });
  invalidStore.windowObj.setActiveView(DEFAULT_VIEW, false);
  invalidStore.bootRestore();
  assertEqual(invalidStore.calls.setActiveViewFallback, [], "owner-present boot does not replay an invalid stored view");
  assertEqual(invalidStore.state.activeView, DEFAULT_VIEW, "owner-present boot leaves initialize correction at calculator-view");
  assertEqual(invalidStore.storage.getItem(ACTIVE_VIEW_KEY), JSON.stringify("bogus-view"), "owner-present boot does not rewrite invalid storage");
  assertEqual(invalidStore.calls.bindNotificationButton, 1, "owner-present boot still calls bindNotificationButton");
  assertEqual(invalidStore.calls.renderAllFallback, 1, "owner-present boot still calls renderAllFallback");

  const absent = installTabHarness(runtimeSrc, appSrc, { owners: false, bindAppTabs: false });
  assert(typeof absent.windowObj.setActiveView !== "function", "bind/app-absent sandbox has no setActiveView");
  assertEqual(
    absent.viewTabs.map((tab) => tab.listeners.capture.length),
    [1, 1, 1, 1],
    "bind/app-absent bindFallbackTabs attaches capture listeners"
  );
  const stolen = absent.click("cabinet-view");
  assertEqual(stolen.immediateStopped, true, "bind/app-absent tab click is capture-stopped");
  assertEqual(stolen.defaultPrevented, true, "bind/app-absent tab click is preventDefaulted");
  assertEqual(absent.calls.setActiveView, [], "bind/app-absent click does not invent a maintained owner");
  assertEqual(absent.calls.setActiveViewFallback, ["cabinet-view"], "bind/app-absent click uses setActiveViewFallback");
  assertEqual(absent.state.activeView, "cabinet-view", "bind/app-absent click writes state.activeView");
  assertEqual(activeViewIds(absent.views, "view"), ["cabinet-view"], "bind/app-absent click activates cabinet-view");
  assertEqual(absent.storage.getItem(ACTIVE_VIEW_KEY), JSON.stringify("cabinet-view"), "bind/app-absent persists JSON cabinet-view");
  cPathQuiet(absent.calls, "bind/app-absent click");

  absent.click("schedule-view");
  absent.click("schedule-view");
  assertEqual(
    absent.calls.setActiveViewFallback,
    ["cabinet-view", "schedule-view", "schedule-view"],
    "bind/app-absent repeated clicks keep using the fallback"
  );
  assertEqual(absent.state.activeView, "schedule-view", "bind/app-absent repeated clicks last write is schedule-view");

  absent.rebind();
  absent.click("calendar-view");
  assertEqual(absent.calls.setActiveViewFallback.at(-1), "calendar-view", "bind/app-absent reload/re-render still uses fallback");

  const absentBoot = installTabHarness(runtimeSrc, appSrc, {
    owners: false,
    bindAppTabs: false,
    storage: { [ACTIVE_VIEW_KEY]: JSON.stringify("calendar-view") },
    stateView: DEFAULT_VIEW,
  });
  absentBoot.bootRestore();
  assertEqual(absentBoot.calls.setActiveViewFallback, ["calendar-view"], "bind/app-absent boot restores stored calendar-view");
  assertEqual(absentBoot.state.activeView, "calendar-view", "bind/app-absent boot writes state.activeView");
  assertEqual(activeViewIds(absentBoot.views, "view"), ["calendar-view"], "bind/app-absent boot activates calendar-view");

  const emptyTarget = installTabHarness(runtimeSrc, appSrc, {
    owners: true,
    includeEmptyTarget: true,
    emptyTargetValue: undefined,
  });
  const emptyEvent = dispatchClick(emptyTarget.viewTabs[4]);
  assertEqual(emptyEvent.immediateStopped, false, "missing target click is not stolen when owner is present");
  assertEqual(emptyTarget.calls.setActiveView, [undefined], "missing target is forwarded to setActiveView");
  assertEqual(emptyTarget.calls.setActiveViewFallback, [], "missing target does not call setActiveViewFallback when owner is present");

  const absentEmpty = installTabHarness(runtimeSrc, appSrc, {
    owners: false,
    bindAppTabs: false,
    includeEmptyTarget: true,
    emptyTargetValue: undefined,
  });
  dispatchClick(absentEmpty.viewTabs[4]);
  assertEqual(absentEmpty.calls.setActiveViewFallback, [undefined], "bind/app-absent missing target still uses fallback");

  assert(fs.existsSync(path.join(EVIDENCE_DIR, "STAGE6CB4.md")), "STAGE6CB4 evidence note is present");
  assert(fs.existsSync(path.join(EVIDENCE_DIR, "chrome-state.json")), "ARIA/focus chrome-state.json is present");
  for (const shot of REQUIRED_SHOTS) {
    const filePath = path.join(EVIDENCE_DIR, shot);
    assert(fs.existsSync(filePath), `evidence PNG exists: ${shot}`);
    if (fs.existsSync(filePath)) {
      const stats = assertPngHasVisibleContent(filePath);
      assert(stats.width >= 300 && stats.height >= 300, `${shot} has reviewable viewport pixels`);
    }
  }
  const identicalPairs = [
    ["before-desktop-calculator.png", "after-desktop-calculator.png"],
    ["before-mobile-calculator.png", "after-mobile-calculator.png"],
    ["before-desktop-schedule.png", "after-desktop-schedule.png"],
    ["before-mobile-schedule.png", "after-mobile-schedule.png"],
    ["before-desktop-calendar.png", "after-desktop-calendar.png"],
    ["before-mobile-calendar.png", "after-mobile-calendar.png"],
    ["before-desktop-cabinet.png", "after-desktop-cabinet.png"],
    ["before-mobile-cabinet.png", "after-mobile-cabinet.png"],
  ];
  for (const [beforeShot, afterShot] of identicalPairs) {
    const beforeBuf = fs.readFileSync(path.join(EVIDENCE_DIR, beforeShot));
    const afterBuf = fs.readFileSync(path.join(EVIDENCE_DIR, afterShot));
    assert(beforeBuf.equals(afterBuf), `${beforeShot} is byte-identical to ${afterShot}`);
  }

  const chromeState = JSON.parse(readText(path.join(EVIDENCE_DIR, "chrome-state.json")));
  assertEqual(chromeState.activeViewKey, ACTIVE_VIEW_KEY, "chrome-state records peptide-calculator-v2-active-view");
  assert(Array.isArray(chromeState.views) && chromeState.views.length >= 4, "chrome-state records each tab view");
  assert(
    chromeState.views.every((row) => row.ariaCurrent === "page" && row.tabActive === true && row.viewActive === true),
    "chrome-state aria-current=page tracks the active tab/view"
  );
  assert(chromeState.focus && chromeState.focus.ariaCurrent === "page", "chrome-state records keyboard/focus current tab");

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    process.exit(1);
  }
}

main();
