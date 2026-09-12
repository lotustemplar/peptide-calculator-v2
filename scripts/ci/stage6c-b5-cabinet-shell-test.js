#!/usr/bin/env node
"use strict";

/**
 * Stage 6c-B5 — RF-B-010 Cabinet container/card/action shell stop-last-write (Issue #34).
 *
 * Binding: Codex [NEXT_STAGE_AUTHORIZED] comment 5647470771.
 * Binding Spec: docs/recovery/stage-6c-inventory-spec-v2.md (RF-B-010).
 * Stage 6b.3 accordion hosts: PR #38 / ui-polish absorb on main.
 *
 * Characterize live Cabinet render ownership, then prove the overlay-owned
 * renderFallbackCabinet last-write of #current-peptides stands down when
 * app.js renderCurrentPeptides is present. Fail closed if:
 *   - load order is not bind → app.js → runtime-fixes.js
 *   - owner-present path still writes RF cabinet HTML (wipes .fill-toggle)
 *   - owner-absent fallback / RF-C-015 field template / RF-C-013 usage change
 *   - re-render after save/edit/delete/taken/undo skips the maintained owner
 *   - repeated render duplicates RF listeners
 *   - missing-owner fallback disappears
 *   - B3 public FitGenRuntimeBridge contract drifts
 *   - RF-C-020/021/022/023, schedules/calendar, or allowlist change
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
const EVIDENCE_DIR = path.join(ROOT, "docs/evidence/stage-6c-b5-cabinet-shell");

const FROZEN_CABINET_FIELDS = "6cc5043d0df998c32626ae8605149f25126ae0fa2c934fb2d8a770d93fc493ed";
const FROZEN_GET_FILL_USAGE = "b6fb2b0c1681a22f10b231543c1ecc66d9c307dff62a05c25a040ecf02113d7f";
const FROZEN_BUILD_WATER_LINE = "a495e845ff5a972f1dd48b57072a1054ee434d793ff4c9d6f90ccb0f32e2608d";
const FROZEN_RENDER_ALL_FALLBACK = "058119c308cce97265223d43e481011b9359b16e0cb8872fef3d744482983a89";
const FROZEN_SAVE_FALLBACK_FILL = "c196419821b1644f85bbb49020c21657b32b9969b4c17ba6f7b8a4fa9196becd";

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

const MAINTAINED_CABINET_HTML = [
  '<article class="cabinet-card">',
  '  <div class="fill-header">',
  '    <button class="fill-toggle" type="button" data-action="toggle-fill" data-id="syn-a" aria-expanded="false">',
  '      <span class="caret">▸</span>Demo Vial A',
  "    </button>",
  "  </div>",
  '  <div class="usage-grid"></div>',
  '  <div class="vial-row"></div>',
  '  <div class="peptide-fill-list is-collapsed">',
  '    <div class="card-actions">',
  '      <button class="mini-button" type="button" data-action="rename-fill" data-id="syn-a">Rename</button>',
  '      <button class="mini-button" type="button" data-action="delete-fill" data-id="syn-a">Delete</button>',
  "    </div>",
  "  </div>",
  "</article>",
].join("");

const MAINTAINED_EMPTY_HTML = [
  '<div class="empty-state">',
  "        No fills saved yet. Save an option in Fill to start your Peptide Cabinet.",
  "      </div>",
].join("\n");

const WIPED_ACCORDION_HTML = [
  '<article class="cabinet-card">',
  '  <div class="fill-header">',
  '    <button class="fill-toggle" type="button" data-action="toggle-fill" data-id="syn-a">',
  '      <span class="caret">▸</span>Demo Vial A',
  "    </button>",
  "  </div>",
  '  <div class="peptide-fill-list is-collapsed">',
  '    <div class="card-actions">',
  '      <button class="mini-button" type="button" data-action="delete-fill" data-id="syn-a">Delete</button>',
  "    </div>",
  "  </div>",
  "</article>",
].join("");

const REQUIRED_SHOTS = [
  "before-desktop-empty.png",
  "before-mobile-empty.png",
  "before-desktop-populated.png",
  "before-mobile-populated.png",
  "before-desktop-actions.png",
  "before-mobile-actions.png",
  "after-desktop-empty.png",
  "after-mobile-empty.png",
  "after-desktop-populated.png",
  "after-mobile-populated.png",
  "after-desktop-collapsed.png",
  "after-mobile-collapsed.png",
  "after-desktop-expanded.png",
  "after-mobile-expanded.png",
  "after-desktop-actions.png",
  "after-mobile-actions.png",
  "after-desktop-focus-toggle.png",
  "after-mobile-focus-toggle.png",
  "after-desktop-focus-delete.png",
  "after-mobile-focus-delete.png",
];

const RF_C015_MARKERS = [
  "water-amount-emphasis",
  "BAC WATER AMOUNT",
  "vial-row-fallback",
  " remaining",
  " left in the vial",
  "doses left",
  "No dose plan yet.",
  "Next dose ",
  "4 doses or fewer remain. Re-order soon.",
  "Draw each dose",
  ">Dose<",
  "Frequency",
  "No schedule saved for this fill yet.",
  "cabinet-actions-fallback",
  'data-action="edit-fill"',
  'data-action="delete-fill"',
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

function extractCabinetFields(fnSrc) {
  const marker = "const fills = readFills().filter(isActiveRecord);";
  const start = fnSrc.indexOf(marker);
  return start === -1 ? "" : fnSrc.slice(start);
}

function extractOwnerGuard(fnSrc) {
  const fields = fnSrc.indexOf("const fills = readFills().filter(isActiveRecord);");
  return fields === -1 ? fnSrc : fnSrc.slice(0, fields);
}

const SYNTHETIC_FILL = {
  savedId: "syn-a",
  name: "Demo Vial A",
  waterMl: 2,
  unitLabel: "mg",
  vialAmount: 30,
  lifecycle: "active",
};

const SYNTHETIC_SCHEDULE = {
  id: "syn-s",
  fillSavedId: "syn-a",
  doseAmount: 3,
  doseMl: 0.2,
  intervalDays: 7,
  reminderTime: "09:00",
  lifecycle: "active",
};

const SYNTHETIC_USAGE = {
  remainingAmount: 30,
  remainingVolumeMl: 2,
  percentRemaining: 100,
  dosesLeft: 10,
  nextDueKey: "2026-09-12",
};

function installCabinetHarness(runtimeSrc, options) {
  const owners = options.owners !== false;
  const calls = {
    renderCurrentPeptides: 0,
    getFillUsage: 0,
    persistState: 0,
    syncReminders: 0,
    computeOptions: 0,
    saveFallbackFill: 0,
    queueUpcomingBrowserReminder: 0,
    addEventListener: 0,
  };
  const currentPeptides = {
    innerHTML: options.initialHtml || "",
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {
      calls.addEventListener += 1;
    },
  };
  const fillsRef = { value: options.fills !== undefined ? options.fills : [SYNTHETIC_FILL] };
  const schedulesRef = { value: options.schedules !== undefined ? options.schedules : [SYNTHETIC_SCHEDULE] };
  const windowObj = {};
  if (owners) {
    windowObj.renderCurrentPeptides = function renderCurrentPeptides() {
      calls.renderCurrentPeptides += 1;
      if (!fillsRef.value.length) {
        currentPeptides.innerHTML = MAINTAINED_EMPTY_HTML;
        return;
      }
      currentPeptides.innerHTML = options.ownerHtml || MAINTAINED_CABINET_HTML;
    };
  }

  const sandbox = {
    window: windowObj,
    currentPeptides,
    readFills() {
      return fillsRef.value;
    },
    readSchedules() {
      return schedulesRef.value;
    },
    isActiveRecord(record) {
      return Boolean(record) && record.lifecycle !== "archived";
    },
    normalizeSchedule(schedule) {
      return schedule;
    },
    getFillUsage() {
      calls.getFillUsage += 1;
      return options.usage || SYNTHETIC_USAGE;
    },
    escapeHtml(value) {
      return String(value ?? "");
    },
    formatMl(value) {
      return `${value} mL`;
    },
    formatNumber(value) {
      return String(value);
    },
    formatDose(value, unit) {
      return `${value} ${unit}`;
    },
    formatDrawMl(value) {
      return `${value} mL`;
    },
    formatDateTime(key, time) {
      return `${key} ${time}`;
    },
    buildWaterLine() {
      return "Add 2 mL BAC water.";
    },
    persistState() {
      calls.persistState += 1;
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
    queueUpcomingBrowserReminder() {
      calls.queueUpcomingBrowserReminder += 1;
    },
    console,
  };

  vm.createContext(sandbox);
  vm.runInContext(extractNamedFunction(runtimeSrc, "renderFallbackCabinet"), sandbox);

  return {
    calls,
    currentPeptides,
    windowObj,
    fillsRef,
    schedulesRef,
    render() {
      vm.runInContext("renderFallbackCabinet()", sandbox);
    },
    setFills(next) {
      fillsRef.value = next;
    },
    setSchedules(next) {
      schedulesRef.value = next;
    },
  };
}

function cPathQuiet(calls, label) {
  assertEqual(calls.persistState, 0, `${label}: persistState / RF-C-021 not reached`);
  assertEqual(calls.syncReminders, 0, `${label}: syncRemindersToBackend not reached`);
  assertEqual(calls.computeOptions, 0, `${label}: computeOptions not reached`);
  assertEqual(calls.saveFallbackFill, 0, `${label}: saveFallbackFill not reached`);
  assertEqual(calls.queueUpcomingBrowserReminder, 0, `${label}: queueUpcomingBrowserReminder not reached`);
}

function main() {
  console.log("Stage 6c-B5 RF-B-010 Cabinet shell stop-last-write");

  const html = readText(path.join(ROOT, "index.html"));
  const bindSrc = readText(path.join(ROOT, "p0-ux-bind.js"));
  const appSrc = readText(path.join(ROOT, "app.js"));
  const runtimeSrc = readText(path.join(ROOT, "runtime-fixes.js"));
  const uxSrc = readText(path.join(ROOT, "src/ux/p0-ux.browser.js"));
  const loadedSrcs = extractScriptSrcs(html);
  const allowed = parseFixAllowlist();
  const cabinetSrc = extractNamedFunction(runtimeSrc, "renderFallbackCabinet");
  const cabinetFields = extractCabinetFields(cabinetSrc);
  const ownerGuard = extractOwnerGuard(cabinetSrc);
  const renderAllFallbackSrc = extractNamedFunction(runtimeSrc, "renderAllFallback");
  const getFillUsageSrc = extractNamedFunction(runtimeSrc, "getFillUsage");
  const buildWaterLineSrc = extractNamedFunction(runtimeSrc, "buildWaterLine");
  const persistStateSrc = extractNamedFunction(runtimeSrc, "persistState");
  const markTakenSrc = extractNamedFunction(runtimeSrc, "markScheduleTaken");
  const saveFallbackFillSrc = extractNamedFunction(runtimeSrc, "saveFallbackFill");
  const bridgeSrc = extractBridgeAssignment(runtimeSrc);
  const setViewSrc = extractBridgeMethod(bridgeSrc, "setView");
  const closeSaveModalSrc = extractBridgeMethod(bridgeSrc, "closeSaveModal");

  assert(loadedSrcs.includes("p0-ux-bind.js"), "index.html loads p0-ux-bind.js");
  assert(loadedSrcs.includes("app.js"), "index.html loads app.js");
  assert(loadedSrcs.includes("runtime-fixes.js"), "runtime-fixes.js remains loaded by index.html");
  assert(
    loadedSrcs.indexOf("p0-ux-bind.js") < loadedSrcs.indexOf("app.js") &&
      loadedSrcs.indexOf("app.js") < loadedSrcs.indexOf("runtime-fixes.js"),
    "load order: p0-ux-bind.js then app.js then runtime-fixes.js last-writes"
  );
  assert(fs.existsSync(path.join(ROOT, "runtime-fixes.js")), "runtime-fixes.js remains on disk");
  assert(allowed.has("runtime-fixes.js"), "runtime-fix-js allowlist still lists runtime-fixes.js");
  assertEqual([...allowed].sort(), REMAINING_LOADED.slice().sort(), "runtime-fix-js allowlist is unchanged");

  assert(/function\s+renderCurrentPeptides\s*\(/.test(appSrc), "maintained owner renderCurrentPeptides remains in app.js");
  assert(/class="fill-toggle"/.test(appSrc), "app.js cabinet still emits .fill-toggle accordion host");
  assert(/data-action="toggle-fill"/.test(appSrc), "app.js cabinet still emits toggle-fill host");
  assert(/peptide-fill-list/.test(appSrc), "app.js cabinet still emits accordion panel host");
  assert(/data-action="delete-fill"/.test(appSrc), "app.js cabinet still emits Delete action host");
  assert(/function\s+attachCabinetEvents\s*\(/.test(appSrc), "app.js still owns attachCabinetEvents");
  assert(
    /elements\.currentPeptides\.innerHTML/.test(extractNamedFunction(appSrc, "renderCurrentPeptides")),
    "maintained renderer still writes #current-peptides"
  );

  assert(/function\s+applyCabinetAccordionLayout/.test(uxSrc), "6b.3 applyCabinetAccordionLayout remains");
  assert(/function\s+collapseCabinetAtStartup/.test(uxSrc), "6b.3 collapseCabinetAtStartup remains");
  assert(/querySelector\("\.fill-toggle"\)/.test(uxSrc), "6b.3 accordion layout still keys off .fill-toggle");
  assert(/function\s+refreshCabinetPolish/.test(bindSrc), "bind still refreshes 6b.3 accordion polish");
  assert(/closest\("\.fill-toggle"\)/.test(bindSrc), "bind accordion click still keys off .fill-toggle");
  assert(
    /handleEditFill\(event\);[\s\S]*handleDeleteFill\(event\);[\s\S]*true\s*\)/.test(bindSrc),
    "bind capture still owns edit-fill / delete-fill"
  );

  assert(/function\s+renderFallbackCabinet\s*\(/.test(runtimeSrc), "overlay RF-B-010 renderer remains");
  assert(
    /if\s*\(\s*typeof\s+window\.renderCurrentPeptides\s*===\s*["']function["']\s*\)\s*\{\s*window\.renderCurrentPeptides\(\);\s*return;\s*\}/.test(
      ownerGuard
    ),
    "RF-B-010: owner-present guard retargets to renderCurrentPeptides and returns"
  );
  assert(
    ownerGuard.indexOf("typeof window.renderCurrentPeptides") < ownerGuard.indexOf("window.renderCurrentPeptides()") ||
      /typeof\s+window\.renderCurrentPeptides/.test(ownerGuard),
    "RF-B-010: owner check is call-time typeof, matching B3/B4"
  );
  assert(
    !/currentPeptides\.innerHTML/.test(ownerGuard),
    "RF-B-010: owner-present guard does not last-write #current-peptides"
  );
  assert(
    (cabinetFields.match(/currentPeptides\.innerHTML/g) || []).length >= 2,
    "missing-owner fallback still last-writes #current-peptides (empty + populated)"
  );
  assert(
    !/addEventListener/.test(cabinetSrc),
    "renderFallbackCabinet still attaches no Edit/Delete/toggle listeners"
  );
  assert(/No fills saved yet\./.test(cabinetFields), "missing-owner empty copy remains RF empty-state");
  RF_C015_MARKERS.forEach((marker) => {
    assert(cabinetFields.includes(marker), `RF-C-015 / action-host marker frozen: ${marker}`);
  });
  assertEqual(sha256Text(cabinetFields), FROZEN_CABINET_FIELDS, "RF-C-015 fallback field template SHA-256 is unchanged");
  assertEqual(sha256Text(getFillUsageSrc), FROZEN_GET_FILL_USAGE, "RF-C-013 getFillUsage SHA-256 is unchanged");
  assertEqual(sha256Text(buildWaterLineSrc), FROZEN_BUILD_WATER_LINE, "RF-C-015 buildWaterLine SHA-256 is unchanged");
  assertEqual(sha256Text(renderAllFallbackSrc), FROZEN_RENDER_ALL_FALLBACK, "RF-C-018 renderAllFallback body is unchanged");
  assertEqual(sha256Text(saveFallbackFillSrc), FROZEN_SAVE_FALLBACK_FILL, "RF-C-020 saveFallbackFill is unchanged");
  assert(/renderFallbackCabinet\(\);/.test(renderAllFallbackSrc), "renderAllFallback still dispatches renderFallbackCabinet");
  assert(/renderAllFallback\(\);/.test(persistStateSrc), "persistState still re-renders via renderAllFallback after save/edit/delete");
  assert(/renderAllFallback\(\);/.test(markTakenSrc), "markScheduleTaken still re-renders via renderAllFallback after taken");

  assert(
    /typeof\s+window\.setActiveView\s*===\s*["']function["']/.test(setViewSrc),
    "B3 RF-B-017: setView still does a call-time typeof window.setActiveView check"
  );
  assert(/window\.setActiveView\(\s*viewId\s*\)/.test(setViewSrc), "B3 RF-B-017: setView still forwards viewId");
  assert(
    /typeof\s+window\.closeSaveFillModal\s*===\s*["']function["']/.test(closeSaveModalSrc),
    "B3 RF-B-018: closeSaveModal still does a call-time owner check"
  );
  assertEqual(extractBridgeMethod(bridgeSrc, "persistAndRender"), FROZEN_PERSIST_AND_RENDER, "RF-C-021 persistAndRender body is unchanged");
  assertEqual(extractBridgeMethod(bridgeSrc, "renderAll"), FROZEN_RENDER_ALL, "RF-C-022 renderAll body is unchanged");
  assertEqual(extractBridgeMethod(bridgeSrc, "getPendingOption"), FROZEN_GET_PENDING_OPTION, "RF-C-023 getPendingOption body is unchanged");
  assert(
    !C_REACHABLE_RES.some((pattern) => pattern.test(ownerGuard)),
    "owner-present cabinet guard does not reach persist/reminder/calculator C paths"
  );

  assert(runtimeSrc.includes("syncRemindersToBackend"), "RF-C-003 syncRemindersToBackend is untouched");
  assert(runtimeSrc.includes("computeOptions"), "RF-C-007 computeOptions is untouched");
  assert(runtimeSrc.includes("queueUpcomingBrowserReminder"), "RF-C-009 reminder timer is untouched");
  assert(/function\s+renderFallbackSchedules/.test(runtimeSrc), "RF-B-011/C-016 schedule renderer is untouched");
  assert(/function\s+renderFallbackCalendar/.test(runtimeSrc), "RF-C-017 calendar renderer is untouched");
  assert(!/\bmark-missed\b/.test(runtimeSrc), "runtime-fixes.js gained no Mark missed action");
  assert(sha256File("app.js") === FROZEN_APP, "app.js SHA-256 unchanged (owners called, not rewritten)");
  assert(
    sha256File("scripts/calc/fixtures/legacy-evidence-goldens.json") === FROZEN_GOLDENS,
    "calc goldens SHA-256 unchanged"
  );

  const live = installCabinetHarness(runtimeSrc, {
    owners: true,
    initialHtml: WIPED_ACCORDION_HTML,
  });
  live.render();
  assertEqual(live.calls.renderCurrentPeptides, 1, "owner-present initial render retargets to renderCurrentPeptides");
  assertEqual(live.calls.getFillUsage, 0, "owner-present initial render does not invoke RF-C-013 getFillUsage");
  assert(live.currentPeptides.innerHTML.includes("fill-toggle"), "owner-present initial render keeps .fill-toggle");
  assert(live.currentPeptides.innerHTML.includes("peptide-fill-list"), "owner-present initial render keeps accordion panel");
  assert(live.currentPeptides.innerHTML.includes('data-action="delete-fill"'), "owner-present initial render keeps Delete host");
  assert(!live.currentPeptides.innerHTML.includes("cabinet-actions-fallback"), "owner-present initial render does not emit RF action shell");
  assert(!live.currentPeptides.innerHTML.includes("vial-row-fallback"), "owner-present initial render does not emit RF-C-015 fallback fields");
  assertEqual(live.calls.addEventListener, 0, "owner-present initial render attaches no RF listeners");
  cPathQuiet(live.calls, "owner-present initial render");

  live.render();
  live.render();
  assertEqual(live.calls.renderCurrentPeptides, 3, "repeated owner-present renders keep calling the maintained owner");
  assertEqual(live.calls.getFillUsage, 0, "repeated owner-present renders still skip RF-C-013");
  assert(live.currentPeptides.innerHTML.includes("fill-toggle"), "repeated owner-present renders still keep .fill-toggle");
  assertEqual(live.calls.addEventListener, 0, "repeated owner-present renders do not duplicate RF listeners");

  const emptyLive = installCabinetHarness(runtimeSrc, { owners: true, fills: [] });
  emptyLive.render();
  assertEqual(emptyLive.calls.renderCurrentPeptides, 1, "owner-present empty render retargets to maintained owner");
  assert(emptyLive.currentPeptides.innerHTML.includes("Save an option in Fill"), "owner-present empty render uses maintained empty shell");
  assert(!emptyLive.currentPeptides.innerHTML.includes('<div class="empty-state">No fills saved yet.</div>'), "owner-present empty render does not last-write RF empty shell");
  assertEqual(emptyLive.calls.getFillUsage, 0, "owner-present empty render does not invoke RF-C-013");

  const saveLive = installCabinetHarness(runtimeSrc, { owners: true, fills: [] });
  saveLive.render();
  saveLive.setFills([SYNTHETIC_FILL]);
  saveLive.render();
  assertEqual(saveLive.calls.renderCurrentPeptides, 2, "re-render after save hits maintained owner");
  assert(saveLive.currentPeptides.innerHTML.includes("fill-toggle"), "re-render after save restores accordion host");

  const editLive = installCabinetHarness(runtimeSrc, { owners: true });
  editLive.render();
  editLive.setFills([{ ...SYNTHETIC_FILL, name: "Demo Vial A edited" }]);
  editLive.render();
  assertEqual(editLive.calls.renderCurrentPeptides, 2, "re-render after edit hits maintained owner");
  assert(editLive.currentPeptides.innerHTML.includes("fill-toggle"), "re-render after edit keeps accordion host");

  const deleteLive = installCabinetHarness(runtimeSrc, { owners: true });
  deleteLive.render();
  deleteLive.setFills([]);
  deleteLive.render();
  assertEqual(deleteLive.calls.renderCurrentPeptides, 2, "re-render after delete hits maintained owner");
  assert(deleteLive.currentPeptides.innerHTML.includes("Save an option in Fill"), "re-render after delete uses maintained empty shell");
  assert(!deleteLive.currentPeptides.innerHTML.includes("cabinet-actions-fallback"), "re-render after delete does not revive RF shell");

  const takenLive = installCabinetHarness(runtimeSrc, { owners: true });
  takenLive.render();
  takenLive.setSchedules([{ ...SYNTHETIC_SCHEDULE, takenDates: ["2026-09-12"] }]);
  takenLive.render();
  assertEqual(takenLive.calls.renderCurrentPeptides, 2, "re-render after taken hits maintained owner");
  assertEqual(takenLive.calls.getFillUsage, 0, "re-render after taken does not recompute RF-C-013");
  takenLive.setSchedules([SYNTHETIC_SCHEDULE]);
  takenLive.render();
  assertEqual(takenLive.calls.renderCurrentPeptides, 3, "re-render after undo hits maintained owner");
  assert(takenLive.currentPeptides.innerHTML.includes("fill-toggle"), "re-render after undo keeps accordion host");

  const wipe = installCabinetHarness(runtimeSrc, {
    owners: false,
    initialHtml: WIPED_ACCORDION_HTML,
  });
  assert(typeof wipe.windowObj.renderCurrentPeptides !== "function", "missing-owner sandbox has no renderCurrentPeptides");
  assert(wipe.currentPeptides.innerHTML.includes("fill-toggle"), "missing-owner starts from maintained accordion HTML");
  wipe.render();
  assertEqual(wipe.calls.renderCurrentPeptides, 0, "missing-owner populated render does not call maintained owner");
  assert(!wipe.currentPeptides.innerHTML.includes("fill-toggle"), "missing-owner populated last-write wipes .fill-toggle");
  assert(wipe.currentPeptides.innerHTML.includes("cabinet-actions-fallback"), "missing-owner populated last-write emits RF action shell");
  assert(wipe.currentPeptides.innerHTML.includes('data-action="edit-fill"'), "missing-owner populated last-write keeps Edit host");
  assert(wipe.currentPeptides.innerHTML.includes('data-action="delete-fill"'), "missing-owner populated last-write keeps Delete host");
  assert(wipe.currentPeptides.innerHTML.includes("water-amount-emphasis"), "missing-owner populated last-write keeps RF-C-015 water line host");
  assert(wipe.currentPeptides.innerHTML.includes("vial-row-fallback"), "missing-owner populated last-write keeps RF-C-015 usage host");
  assert(wipe.currentPeptides.innerHTML.includes("10 doses left"), "missing-owner populated last-write keeps RF-C-013 doses-left copy");
  assert(wipe.currentPeptides.innerHTML.includes("Next dose 2026-09-12 09:00"), "missing-owner populated last-write keeps RF-C-015 next-dose text");
  assert(wipe.calls.getFillUsage >= 1, "missing-owner populated render still calls RF-C-013 getFillUsage");
  assertEqual(wipe.calls.addEventListener, 0, "missing-owner populated render attaches no RF listeners");
  cPathQuiet(wipe.calls, "missing-owner populated render");

  wipe.render();
  assert(!wipe.currentPeptides.innerHTML.includes("fill-toggle"), "repeated missing-owner render still last-writes without accordion");
  assert(wipe.currentPeptides.innerHTML.includes("cabinet-actions-fallback"), "repeated missing-owner render keeps RF action shell");

  const emptyAbsent = installCabinetHarness(runtimeSrc, { owners: false, fills: [], initialHtml: WIPED_ACCORDION_HTML });
  emptyAbsent.render();
  assertEqual(emptyAbsent.currentPeptides.innerHTML, '<div class="empty-state">No fills saved yet.</div>', "missing-owner empty render last-writes RF empty shell");
  assert(!emptyAbsent.currentPeptides.innerHTML.includes("fill-toggle"), "missing-owner empty render wipes .fill-toggle");

  assert(fs.existsSync(path.join(EVIDENCE_DIR, "STAGE6CB5.md")), "STAGE6CB5 evidence note is present");
  assert(fs.existsSync(path.join(EVIDENCE_DIR, "cabinet-state.json")), "ARIA/focus cabinet-state.json is present");
  assert(fs.existsSync(path.join(EVIDENCE_DIR, "cabinet-state-before.json")), "before cabinet-state JSON is present");
  for (const shot of REQUIRED_SHOTS) {
    const filePath = path.join(EVIDENCE_DIR, shot);
    assert(fs.existsSync(filePath), `evidence PNG exists: ${shot}`);
    if (fs.existsSync(filePath)) {
      const stats = assertPngHasVisibleContent(filePath);
      assert(stats.width >= 300 && stats.height >= 300, `${shot} has reviewable viewport pixels`);
    }
  }

  const beforeState = JSON.parse(readText(path.join(EVIDENCE_DIR, "cabinet-state-before.json")));
  const afterState = JSON.parse(readText(path.join(EVIDENCE_DIR, "cabinet-state.json")));
  assert(beforeState.viewports.length === 2, "before state records desktop and mobile");
  assert(afterState.viewports.length === 2, "after state records desktop and mobile");
  for (const viewport of beforeState.viewports) {
    assertEqual(viewport.shots.populated.state.htmlHasFillToggle, false, `${viewport.viewport} before populated has no .fill-toggle (RF last-write)`);
    assertEqual(viewport.shots.populated.state.htmlHasFallbackActions, true, `${viewport.viewport} before populated has RF action shell`);
    assertEqual(viewport.shots.populated.state.ownerPresent, true, `${viewport.viewport} before populated still had the maintained owner present`);
  }
  for (const viewport of afterState.viewports) {
    assertEqual(viewport.shots.populated.state.htmlHasFillToggle, true, `${viewport.viewport} after populated restores .fill-toggle`);
    assertEqual(viewport.shots.populated.state.htmlHasFallbackActions, false, `${viewport.viewport} after populated does not emit RF action shell`);
    assert(viewport.shots.collapsed.state.htmlHasFillToggle, `${viewport.viewport} after collapsed keeps accordion host`);
    assert(viewport.shots.expanded.state.htmlHasFillToggle, `${viewport.viewport} after expanded keeps accordion host`);
    assert(viewport.shots.actions.state.deleteCount >= 1, `${viewport.viewport} after actions keep Delete host`);
    assertEqual(viewport.shots.focusToggle.focus.ok, true, `${viewport.viewport} after focus lands on .fill-toggle`);
    assertEqual(viewport.shots.focusDelete.focus.action, "delete-fill", `${viewport.viewport} after focus lands on Delete host`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    process.exit(1);
  }
}

main();
