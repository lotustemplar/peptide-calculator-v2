#!/usr/bin/env node
"use strict";

/**
 * Stage 6c-B3 — RF-B-017 / RF-B-018 FitGenRuntimeBridge chrome retarget (Issue #34).
 *
 * Binding: Codex [NEXT_STAGE_AUTHORIZED] comment 5647266001.
 * Binding Spec: docs/recovery/stage-6c-inventory-spec-v2.md (RF-B-017 / RF-B-018).
 *
 * Characterize the public window.FitGenRuntimeBridge contract, then prove
 * setView / closeSaveModal retarget to already-approved app.js owners
 * (setActiveView / closeSaveFillModal) at call time. Fail closed if:
 *   - public method names, arguments, or return/side-effect shape drift
 *   - live ownership leaves the maintained owners
 *   - bind-absent fallbacks disappear
 *   - RF-C-021/022/023 bodies or persist/render/pending coupling change
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

const ROOT = repoRoot();
const REMAINING_LOADED = ["runtime-fixes.js"];
const FROZEN_GOLDENS = "659c1865da95c3197395c931e154c4267c802d8aaf7842aee83345962d013acd";
const FROZEN_APP = "489cd7b88b90e00bd2a700518312577cf5a65cf12cacc003d9a181422606a537";
const ACTIVE_VIEW_KEY = "peptide-calculator-v2-active-view";

const BRIDGE_METHODS = [
  "persistAndRender",
  "renderAll",
  "setView",
  "closeSaveModal",
  "getPendingOption",
];

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

function extractTopLevelMethodNames(objectSrc) {
  const names = [];
  const start = objectSrc.indexOf("{");
  let depth = 0;
  for (let index = start; index < objectSrc.length; index += 1) {
    const ch = objectSrc[index];
    if (ch === "{") {
      depth += 1;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      continue;
    }
    if (depth !== 1) {
      continue;
    }
    const match = /^([A-Za-z][A-Za-z0-9]*)\s*\(/.exec(objectSrc.slice(index));
    if (match) {
      names.push(match[1]);
      index += match[0].length - 1;
    }
  }
  return names;
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

function createView(viewId, active) {
  return {
    dataset: { view: viewId },
    classList: createClassList(active ? "app-view is-active" : "app-view"),
  };
}

function createTab(viewId, active) {
  return {
    dataset: { viewTarget: viewId },
    classList: createClassList(active ? "is-active" : ""),
  };
}

function createModal(open) {
  const attrs = {
    "aria-hidden": open ? "false" : "true",
  };
  return {
    classList: createClassList(open ? "modal-shell" : "modal-shell is-hidden"),
    setAttribute(name, value) {
      attrs[name] = String(value);
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
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

function installBridge(runtimeSrc, options) {
  const owners = options.owners !== false;
  const calls = {
    persistState: [],
    renderAllFallback: 0,
    setActiveViewFallback: [],
    closeFallbackSaveFillModal: 0,
    setActiveView: [],
    closeSaveFillModal: 0,
    syncReminders: 0,
    computeOptions: 0,
    saveFallbackFill: 0,
  };
  const views = [
    createView("calculator-view", true),
    createView("cabinet-view", false),
    createView("schedule-view", false),
  ];
  const viewTabs = [
    createTab("calculator-view", true),
    createTab("cabinet-view", false),
    createTab("schedule-view", false),
  ];
  const saveFillModal = createModal(true);
  const storage = createMemoryStorage({
    [ACTIVE_VIEW_KEY]: JSON.stringify("calculator-view"),
  });
  const state = {
    activeView: "calculator-view",
    pendingSaveOptionId: "opt-b3",
    latestOptions: [{ id: "opt-b3" }],
  };
  const windowObj = {
    localStorage: storage,
  };
  const sandbox = {
    window: windowObj,
    pendingOption: { id: "opt-b3", doseAmount: 2 },
    saveFillModal,
    state,
    elements: {
      views,
      viewTabs,
      saveFillModal,
    },
    STORAGE_KEYS: { activeView: ACTIVE_VIEW_KEY },
    persistState(...args) {
      calls.persistState.push(args);
    },
    renderAllFallback() {
      calls.renderAllFallback += 1;
    },
    setActiveViewFallback(viewId) {
      calls.setActiveViewFallback.push(viewId);
    },
    closeFallbackSaveFillModal() {
      calls.closeFallbackSaveFillModal += 1;
      sandbox.pendingOption = null;
      saveFillModal.classList.add("is-hidden");
      saveFillModal.setAttribute("aria-hidden", "true");
    },
    syncRemindersToBackend() {
      calls.syncReminders += 1;
    },
    computeOptions() {
      calls.computeOptions += 1;
      return { error: null, options: [], mode: "precision" };
    },
    saveFallbackFill() {
      calls.saveFallbackFill += 1;
    },
    console,
  };

  const appSrc = options.appSrc || "";
  const writeStorageSrc = extractNamedFunction(appSrc, "writeStorage");
  const setActiveViewSrc = extractNamedFunction(appSrc, "setActiveView");
  const closeSaveFillModalSrc = extractNamedFunction(appSrc, "closeSaveFillModal");

  vm.createContext(sandbox);
  if (owners) {
    vm.runInContext(`${writeStorageSrc}\n${setActiveViewSrc}\n${closeSaveFillModalSrc}`, sandbox);
    windowObj.setActiveView = function setActiveViewProxy(viewId, persist) {
      calls.setActiveView.push(viewId);
      return sandbox.setActiveView(viewId, persist);
    };
    windowObj.closeSaveFillModal = function closeSaveFillModalProxy() {
      calls.closeSaveFillModal += 1;
      return sandbox.closeSaveFillModal();
    };
  }

  const bridgeSrc = extractBridgeAssignment(runtimeSrc);
  vm.runInContext(bridgeSrc, sandbox);
  return {
    bridge: sandbox.window.FitGenRuntimeBridge,
    sandbox,
    calls,
    views,
    viewTabs,
    saveFillModal,
    storage,
    state,
    windowObj,
    reinstall() {
      vm.runInContext(bridgeSrc, sandbox);
      return sandbox.window.FitGenRuntimeBridge;
    },
  };
}

function cPathQuiet(calls, label) {
  assertEqual(calls.persistState, [], `${label}: persistState / RF-C-021 not reached`);
  assertEqual(calls.renderAllFallback, 0, `${label}: renderAllFallback / RF-C-022 not reached`);
  assertEqual(calls.syncReminders, 0, `${label}: syncRemindersToBackend not reached`);
  assertEqual(calls.computeOptions, 0, `${label}: computeOptions not reached`);
  assertEqual(calls.saveFallbackFill, 0, `${label}: saveFallbackFill not reached`);
}

function main() {
  console.log("Stage 6c-B3 RF-B-017/018 FitGenRuntimeBridge chrome retarget");

  const html = readText(path.join(ROOT, "index.html"));
  const bindSrc = readText(path.join(ROOT, "p0-ux-bind.js"));
  const appSrc = readText(path.join(ROOT, "app.js"));
  const runtimeSrc = readText(path.join(ROOT, "runtime-fixes.js"));
  const loadedSrcs = extractScriptSrcs(html);
  const allowed = parseFixAllowlist();
  const bridgeSrc = extractBridgeAssignment(runtimeSrc);
  const setViewSrc = extractBridgeMethod(bridgeSrc, "setView");
  const closeSaveModalSrc = extractBridgeMethod(bridgeSrc, "closeSaveModal");
  const persistAndRenderSrc = extractBridgeMethod(bridgeSrc, "persistAndRender");
  const renderAllSrc = extractBridgeMethod(bridgeSrc, "renderAll");
  const getPendingSrc = extractBridgeMethod(bridgeSrc, "getPendingOption");

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

  assert(Boolean(bridgeSrc), "FitGenRuntimeBridge assignment is extractable");
  for (const name of BRIDGE_METHODS) {
    assert(new RegExp(`\\b${name}\\s*\\(`).test(bridgeSrc), `bridge installs ${name}`);
  }
  assertEqual(
    extractTopLevelMethodNames(bridgeSrc),
    BRIDGE_METHODS,
    "bridge public method set is exactly persistAndRender, renderAll, setView, closeSaveModal, getPendingOption"
  );

  assert(
    /typeof\s+window\.setActiveView\s*===\s*["']function["']/.test(setViewSrc),
    "RF-B-017: setView does a call-time typeof window.setActiveView check"
  );
  assert(/window\.setActiveView\(\s*viewId\s*\)/.test(setViewSrc), "RF-B-017: setView forwards viewId to window.setActiveView");
  assert(/setActiveViewFallback\(\s*viewId\s*\)/.test(setViewSrc), "RF-B-017: setView keeps setActiveViewFallback as bind/app-absent fallback");
  assert(
    !C_REACHABLE_RES.some((pattern) => pattern.test(setViewSrc)),
    "RF-B-017: setView does not reach persist/render/reminder/calculator C paths"
  );

  assert(
    /typeof\s+window\.closeSaveFillModal\s*===\s*["']function["']/.test(closeSaveModalSrc),
    "RF-B-018: closeSaveModal does a call-time typeof window.closeSaveFillModal check"
  );
  assert(
    /window\.closeSaveFillModal\(\s*\)/.test(closeSaveModalSrc),
    "RF-B-018: closeSaveModal forwards to window.closeSaveFillModal with no arguments"
  );
  assert(/pendingOption\s*=\s*null/.test(closeSaveModalSrc), "RF-B-018: closeSaveModal still clears pendingOption for RF-C-023");
  assert(
    /closeFallbackSaveFillModal\(\s*\)/.test(closeSaveModalSrc),
    "RF-B-018: closeSaveModal keeps closeFallbackSaveFillModal as bind/app-absent fallback"
  );
  assert(!/\bpersistState\b/.test(closeSaveModalSrc), "RF-B-018: closeSaveModal does not call persistState");
  assert(!/\brenderAllFallback\b/.test(closeSaveModalSrc), "RF-B-018: closeSaveModal does not call renderAllFallback");
  assert(!/\bsaveFallbackFill\b/.test(closeSaveModalSrc), "RF-B-018: closeSaveModal does not call saveFallbackFill");
  assert(!/\bsyncRemindersToBackend\b/.test(closeSaveModalSrc), "RF-B-018: closeSaveModal does not call syncRemindersToBackend");

  assertEqual(persistAndRenderSrc, FROZEN_PERSIST_AND_RENDER, "RF-C-021 persistAndRender body is unchanged");
  assertEqual(renderAllSrc, FROZEN_RENDER_ALL, "RF-C-022 renderAll body is unchanged");
  assertEqual(getPendingSrc, FROZEN_GET_PENDING_OPTION, "RF-C-023 getPendingOption body is unchanged");

  assert(
    /function\s+setActiveView\s*\(\s*viewId/.test(appSrc) && /function\s+closeSaveFillModal\s*\(/.test(appSrc),
    "maintained owners setActiveView and closeSaveFillModal remain in app.js"
  );
  assert(
    /function\s+setActiveViewFallback\s*\(\s*viewId/.test(runtimeSrc) &&
      /function\s+closeFallbackSaveFillModal\s*\(/.test(runtimeSrc),
    "fallback owners remain in runtime-fixes.js for bind-absent and in-file C/B4 paths"
  );
  assert(
    /closeFallbackSaveFillModal\(\s*\)/.test(extractNamedFunction(runtimeSrc, "saveFallbackFill")) &&
      /setActiveViewFallback\(\s*"cabinet-view"\s*\)/.test(extractNamedFunction(runtimeSrc, "saveFallbackFill")),
    "RF-C-020 saveFallbackFill still uses in-file fallbacks, not the retargeted bridge"
  );

  assert(bindSrc.includes("window.FitGenRuntimeBridge?.closeSaveModal"), "bind save-confirm still calls bridge.closeSaveModal");
  assert(
    bindSrc.includes('window.FitGenRuntimeBridge.setView("cabinet-view")') ||
      bindSrc.includes("window.FitGenRuntimeBridge?.setView"),
    "bind still calls bridge.setView"
  );
  assert(
    /FitGenRuntimeBridge\?\.closeSaveModal\)[\s\S]{0,80}FitGenRuntimeBridge\.closeSaveModal\(\s*\)/.test(bindSrc) &&
      /FitGenRuntimeBridge\?\.setView\)[\s\S]{0,80}FitGenRuntimeBridge\.setView\(\s*["']cabinet-view["']\s*\)/.test(bindSrc),
    "bind caller shape remains closeSaveModal() then setView(\"cabinet-view\")"
  );
  assert(bindSrc.includes("window.FitGenRuntimeBridge.getPendingOption"), "bind still reads RF-C-023 getPendingOption");
  assert(bindSrc.includes("window.FitGenRuntimeBridge?.persistAndRender"), "bind still calls RF-C-021 persistAndRender");
  assert(
    /if \(window\.FitGenRuntimeBridge && typeof window\.FitGenRuntimeBridge.renderAll === "function"\)/.test(bindSrc),
    "bind still calls RF-C-022 renderAll"
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

  const live = installBridge(runtimeSrc, { owners: true, appSrc });
  assert(Boolean(live.bridge), "bridge installs on window when owners are present");
  assertEqual(
    BRIDGE_METHODS.filter((name) => typeof live.bridge[name] === "function"),
    BRIDGE_METHODS,
    "installed bridge exposes all five public methods as functions"
  );

  const setViewReturn = live.bridge.setView("cabinet-view");
  assertEqual(setViewReturn, undefined, "setView return value is undefined");
  assertEqual(live.calls.setActiveView, ["cabinet-view"], "setView delegates viewId to maintained setActiveView");
  assertEqual(live.calls.setActiveViewFallback, [], "setView does not call setActiveViewFallback when owner is present");
  assertEqual(live.state.activeView, "cabinet-view", "setView owner writes state.activeView");
  assert(
    live.views[1].classList.contains("is-active") && !live.views[0].classList.contains("is-active"),
    "setView owner toggles .is-active onto cabinet-view"
  );
  assert(
    live.viewTabs[1].classList.contains("is-active") && !live.viewTabs[0].classList.contains("is-active"),
    "setView owner toggles tab .is-active onto Cabinet"
  );
  assertEqual(
    JSON.parse(live.storage.getItem(ACTIVE_VIEW_KEY)),
    "cabinet-view",
    "setView owner persists peptide-calculator-v2-active-view"
  );
  assert(
    live.saveFillModal.classList.contains("is-hidden") === false,
    "setView does not close the save modal"
  );
  cPathQuiet(live.calls, "setView");

  live.bridge.setView("schedule-view");
  live.bridge.setView("schedule-view");
  assertEqual(
    live.calls.setActiveView,
    ["cabinet-view", "schedule-view", "schedule-view"],
    "repeated setView calls keep hitting the maintained owner"
  );
  assertEqual(live.state.activeView, "schedule-view", "repeated setView last write is schedule-view");

  assertEqual(live.bridge.getPendingOption(), { id: "opt-b3", doseAmount: 2 }, "getPendingOption returns pending before close");
  const closeReturn = live.bridge.closeSaveModal();
  assertEqual(closeReturn, undefined, "closeSaveModal return value is undefined");
  assertEqual(live.calls.closeSaveFillModal, 1, "closeSaveModal delegates to maintained closeSaveFillModal");
  assertEqual(live.calls.closeFallbackSaveFillModal, 0, "closeSaveModal does not wrap closeFallbackSaveFillModal when owner is present");
  assertEqual(live.bridge.getPendingOption(), null, "closeSaveModal preserves pendingOption = null for RF-C-023");
  assertEqual(live.state.pendingSaveOptionId, null, "closeSaveModal owner clears state.pendingSaveOptionId");
  assert(live.saveFillModal.classList.contains("is-hidden"), "closeSaveModal owner adds is-hidden chrome");
  assertEqual(live.saveFillModal.getAttribute("aria-hidden"), "true", "closeSaveModal owner sets aria-hidden=true");
  assertEqual(live.state.activeView, "schedule-view", "closeSaveModal does not change the active view");
  cPathQuiet(live.calls, "closeSaveModal");

  live.bridge.closeSaveModal();
  assertEqual(live.calls.closeSaveFillModal, 2, "repeated closeSaveModal calls keep hitting the maintained owner");
  assertEqual(live.bridge.getPendingOption(), null, "repeated closeSaveModal leaves pendingOption null");
  assertEqual(live.calls.closeFallbackSaveFillModal, 0, "repeated closeSaveModal still does not wrap the fallback");

  live.bridge.persistAndRender("fill-a", "sched-b");
  assertEqual(live.calls.persistState, [["fill-a", "sched-b"]], "RF-C-021 persistAndRender still forwards to persistState");
  live.bridge.renderAll();
  assertEqual(live.calls.renderAllFallback, 1, "RF-C-022 renderAll still forwards to renderAllFallback");
  assertEqual(live.calls.setActiveViewFallback, [], "C methods do not spill into setActiveViewFallback");

  const reloaded = live.reinstall();
  assert(reloaded === live.windowObj.FitGenRuntimeBridge, "reload/re-render replaces the same window.FitGenRuntimeBridge slot");
  assertEqual(
    BRIDGE_METHODS.filter((name) => typeof reloaded[name] === "function"),
    BRIDGE_METHODS,
    "reload/re-render keeps the public method set"
  );
  reloaded.setView("calculator-view");
  assertEqual(live.calls.setActiveView.at(-1), "calculator-view", "reload/re-render setView still hits maintained owner");
  live.sandbox.pendingOption = { id: "opt-reload" };
  reloaded.closeSaveModal();
  assertEqual(reloaded.getPendingOption(), null, "reload/re-render closeSaveModal still clears pendingOption");
  assertEqual(live.calls.closeSaveFillModal, 3, "reload/re-render closeSaveModal still hits maintained owner");

  const absent = installBridge(runtimeSrc, { owners: false, appSrc });
  assert(typeof absent.windowObj.setActiveView !== "function", "bind/app-absent sandbox has no setActiveView");
  assert(typeof absent.windowObj.closeSaveFillModal !== "function", "bind/app-absent sandbox has no closeSaveFillModal");
  absent.bridge.setView("cabinet-view");
  assertEqual(absent.calls.setActiveView, [], "bind/app-absent setView does not invent a maintained owner");
  assertEqual(absent.calls.setActiveViewFallback, ["cabinet-view"], "bind/app-absent setView uses setActiveViewFallback");
  assertEqual(absent.bridge.getPendingOption(), { id: "opt-b3", doseAmount: 2 }, "bind/app-absent getPendingOption still returns pending");
  absent.bridge.closeSaveModal();
  assertEqual(absent.calls.closeSaveFillModal, 0, "bind/app-absent closeSaveModal does not invent a maintained owner");
  assertEqual(absent.calls.closeFallbackSaveFillModal, 1, "bind/app-absent closeSaveModal uses closeFallbackSaveFillModal");
  assertEqual(absent.bridge.getPendingOption(), null, "bind/app-absent closeSaveModal still clears pendingOption");
  assert(absent.saveFillModal.classList.contains("is-hidden"), "bind/app-absent closeSaveModal still hides chrome");
  assertEqual(absent.saveFillModal.getAttribute("aria-hidden"), "true", "bind/app-absent closeSaveModal still sets aria-hidden");
  cPathQuiet(absent.calls, "bind/app-absent chrome");

  absent.windowObj.setActiveView = function lateOwner(viewId) {
    absent.calls.setActiveView.push(viewId);
  };
  absent.windowObj.closeSaveFillModal = function lateClose() {
    absent.calls.closeSaveFillModal += 1;
  };
  absent.sandbox.pendingOption = { id: "opt-late" };
  absent.bridge.setView("calendar-view");
  absent.bridge.closeSaveModal();
  assertEqual(absent.calls.setActiveView, ["calendar-view"], "call-time lookup picks up a later-installed setActiveView");
  assertEqual(absent.calls.setActiveViewFallback, ["cabinet-view"], "late owner does not replay the earlier fallback call");
  assertEqual(absent.calls.closeSaveFillModal, 1, "call-time lookup picks up a later-installed closeSaveFillModal");
  assertEqual(absent.calls.closeFallbackSaveFillModal, 1, "late owner does not wrap fallback after it appears");
  assertEqual(absent.bridge.getPendingOption(), null, "late-owner closeSaveModal still clears pendingOption");

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    process.exit(1);
  }
}

main();
