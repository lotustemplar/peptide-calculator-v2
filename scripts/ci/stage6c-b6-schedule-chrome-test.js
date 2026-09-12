#!/usr/bin/env node
"use strict";

/**
 * Stage 6c-B6 — RF-B-011 schedule/calendar chrome + RF-B-012 banner-at-source
 * (Issue #34).
 *
 * Binding: Codex [NEXT_STAGE_AUTHORIZED] comment 5648096793.
 * Binding Spec: docs/recovery/stage-6c-inventory-spec-v2.md (RF-B-011 / RF-B-012).
 * Stage 6b.3 banner removal: PR #38 / ui-polish absorb on main.
 *
 * Characterize live schedule/calendar render ownership, then prove:
 *   - load order is bind → app.js → runtime-fixes.js
 *   - owner-present path retargets to renderSchedules / renderCalendar
 *   - owner-present path never writes the Due Today banner class
 *   - missing-owner fallback still last-writes frozen RF-C-016 / RF-C-017
 *     fields but does not emit the banner class (6b.3 visible-result parity)
 *   - repeated render, empty/populated, date navigation, and every
 *     renderAllFallback re-render entry point keep the maintained owner
 *   - RF-C-012/014/016/017 function bodies stay frozen
 *   - runtime-fixes.js stays loaded + allowlisted
 *   - app.js / calc goldens are unchanged
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
const EVIDENCE_DIR = path.join(ROOT, "docs/evidence/stage-6c-b6-schedule-chrome");

const FROZEN_SCHEDULE_FIELDS = "64f71f6d4838744560ae6cc1cd70d6529e8108da115ff9160a788ae09b41f2b5";
const FROZEN_CALENDAR_FIELDS = "e71e647540ca99539338bf2a1de78ff8a5047cdc03b9c61864c693c3917399c9";
const FROZEN_GET_TODAY_DUE = "4913881b2ea84ddea6c15e4084a14f7c5605ac600a264fcae1fb94c12fa2c1d9";
const FROZEN_IS_DUE_ON_DATE = "2fd2b9398c1f58d7fdde754f9951ea75690e1365db347026f75b2303c2ab39a8";
const FROZEN_GET_NEXT_DUE = "f1bd4eb20320c8e62ebd657d1bed8e19753a10d7e084fb9654d8db6c65e07517";
const FROZEN_IS_TAKEN_TODAY = "3e6ce6284261fd61a26b02d7cff20e9f997a8bf545d54df1beeb810e4d776f22";
const FROZEN_MARK_TAKEN = "4b264f54a8f42ef56e92f04dda16198d0608b37b5d1deae118feb5585565af31";
const FROZEN_INDICATOR = "0488c419aae55796df2f48dd031ba83f8c20f7d21bd331bbc7c3223c2cbb4e10";
const FROZEN_RENDER_ALL_FALLBACK = "058119c308cce97265223d43e481011b9359b16e0cb8872fef3d744482983a89";
const FROZEN_SAVE_FALLBACK_FILL = "c196419821b1644f85bbb49020c21657b32b9969b4c17ba6f7b8a4fa9196becd";
const FROZEN_CABINET_FIELDS = "6cc5043d0df998c32626ae8605149f25126ae0fa2c934fb2d8a770d93fc493ed";

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

const MAINTAINED_SCHEDULE_HTML = [
  '<article class="list-card">',
  '  <div class="list-topline">',
  "    <div>",
  "      <h3>Demo Vial A</h3>",
  '      <p class="card-note">3 mg • draw 0.20 mL every 7 days</p>',
  "    </div>",
  '    <span class="schedule-status-pill is-ready">Due today</span>',
  "  </div>",
  '  <div class="card-actions">',
  '    <button class="primary-button" type="button" data-action="mark-taken" data-id="syn-s" data-date="2026-09-12">Mark as taken</button>',
  '    <button class="mini-button" type="button" data-action="test-reminder" data-id="syn-s">Test Alert</button>',
  "  </div>",
  "</article>",
].join("");

const MAINTAINED_SCHEDULE_EMPTY = [
  '<div class="empty-state">',
  "        No dosage plans yet. Saving a fill can create the first schedule automatically.",
  "      </div>",
].join("\n");

const MAINTAINED_CALENDAR_HTML = [
  '<div class="calendar-section-header">Upcoming</div>',
  '<article class="calendar-day">',
  '  <div class="calendar-day-list">',
  '    <div class="calendar-item is-today">',
  "      <h4>Demo Vial A</h4>",
  '      <button class="mini-button" type="button" data-action="mark-taken" data-id="syn-s" data-date="2026-09-12">Mark as taken</button>',
  "    </div>",
  "  </div>",
  "</article>",
].join("");

const MAINTAINED_CALENDAR_DATES_HTML = [
  '<div class="calendar-section-header">Past Doses</div>',
  '<article class="calendar-day"><h3>August 29, 2026</h3></article>',
  '<div class="calendar-section-header">Upcoming</div>',
  '<article class="calendar-day"><h3>September 12, 2026</h3></article>',
].join("");

const MAINTAINED_CALENDAR_EMPTY = [
  '<div class="empty-state">',
  "        Your calendar is empty right now. Save a fill or add a dosage plan to see your dose timeline here.",
  "      </div>",
].join("\n");

const REQUIRED_SHOTS = [
  "before-desktop-schedule-empty.png",
  "before-mobile-schedule-empty.png",
  "before-desktop-schedule-populated.png",
  "before-mobile-schedule-populated.png",
  "before-desktop-calendar-empty.png",
  "before-mobile-calendar-empty.png",
  "before-desktop-calendar-populated.png",
  "before-mobile-calendar-populated.png",
  "before-desktop-calendar-dates.png",
  "before-mobile-calendar-dates.png",
  "after-desktop-schedule-empty.png",
  "after-mobile-schedule-empty.png",
  "after-desktop-schedule-populated.png",
  "after-mobile-schedule-populated.png",
  "after-desktop-calendar-empty.png",
  "after-mobile-calendar-empty.png",
  "after-desktop-calendar-populated.png",
  "after-mobile-calendar-populated.png",
  "after-desktop-calendar-dates.png",
  "after-mobile-calendar-dates.png",
  "after-desktop-focus-mark-taken.png",
  "after-mobile-focus-mark-taken.png",
  "after-desktop-focus-calendar.png",
  "after-mobile-focus-calendar.png",
];

const RF_C016_MARKERS = [
  "schedule-status-pill",
  "Taken today",
  "Due today",
  "Upcoming",
  "Draw each dose",
  "Next dose",
  'data-action="mark-taken"',
  'data-action="undo-taken"',
  "today-schedule-actions",
  "No schedules saved yet. Save a fill first.",
  "No peptides are due today.",
];

const RF_C017_MARKERS = [
  "calendar-day",
  "Next due ",
  "Frequency",
  "Every ",
  "Draw each dose",
  "No calendar items yet.",
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

function extractFields(fnSrc) {
  const marker = "const fills = readFills().filter(isActiveRecord);";
  const start = fnSrc.indexOf(marker);
  return start === -1 ? "" : fnSrc.slice(start);
}

function extractOwnerGuard(fnSrc) {
  const fields = fnSrc.indexOf("const fills = readFills().filter(isActiveRecord);");
  return fields === -1 ? fnSrc : fnSrc.slice(0, fields);
}

function createListNode(initialHtml) {
  const listeners = [];
  const node = {
    innerHTML: initialHtml || "",
    listeners,
    querySelector(selector) {
      if (selector === ".today-schedule-banner" && node.innerHTML.includes("today-schedule-banner")) {
        return { className: "today-schedule-banner" };
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-action="mark-taken"]') {
        const count = (node.innerHTML.match(/data-action="mark-taken"/g) || []).length;
        return Array.from({ length: count }, () => ({
          dataset: { id: "syn-s", date: "2026-09-12" },
          addEventListener() {
            listeners.push(selector);
          },
        }));
      }
      return [];
    },
    addEventListener() {
      listeners.push("node");
    },
  };
  return node;
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
  startDate: "2026-09-12",
  takenDates: [],
  lifecycle: "active",
  unitLabel: "mg",
  fillSnapshot: SYNTHETIC_FILL,
};

function installHarness(runtimeSrc, options) {
  const owners = options.owners !== false;
  const calls = {
    renderSchedules: 0,
    renderCalendar: 0,
    getTodayDueSchedules: 0,
    getNextDue: 0,
    isScheduleDueOnDate: 0,
    isTakenToday: 0,
    persistState: 0,
    syncReminders: 0,
    computeOptions: 0,
    saveFallbackFill: 0,
    queueUpcomingBrowserReminder: 0,
  };
  const reminderList = createListNode(options.reminderHtml);
  const calendarList = createListNode(options.calendarHtml);
  const fillsRef = { value: options.fills !== undefined ? options.fills : [SYNTHETIC_FILL] };
  const schedulesRef = { value: options.schedules !== undefined ? options.schedules : [SYNTHETIC_SCHEDULE] };
  const windowObj = {};
  if (owners) {
    windowObj.renderSchedules = function renderSchedules() {
      calls.renderSchedules += 1;
      if (!schedulesRef.value.length) {
        reminderList.innerHTML = MAINTAINED_SCHEDULE_EMPTY;
        return;
      }
      reminderList.innerHTML = options.ownerScheduleHtml || MAINTAINED_SCHEDULE_HTML;
    };
    windowObj.renderCalendar = function renderCalendar() {
      calls.renderCalendar += 1;
      if (!schedulesRef.value.length) {
        calendarList.innerHTML = MAINTAINED_CALENDAR_EMPTY;
        return;
      }
      const start = schedulesRef.value[0] && schedulesRef.value[0].startDate;
      if (start && start < "2026-09-12") {
        calendarList.innerHTML = options.ownerCalendarDatesHtml || MAINTAINED_CALENDAR_DATES_HTML;
        return;
      }
      calendarList.innerHTML = options.ownerCalendarHtml || MAINTAINED_CALENDAR_HTML;
    };
  }

  const sandbox = {
    window: windowObj,
    reminderList,
    calendarList,
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
    getTodayDueSchedules() {
      calls.getTodayDueSchedules += 1;
      return options.todayDue !== undefined
        ? options.todayDue
        : schedulesRef.value.map((schedule) => ({ schedule, fill: SYNTHETIC_FILL }));
    },
    getNextDue() {
      calls.getNextDue += 1;
      return "2026-09-12";
    },
    isScheduleDueOnDate() {
      calls.isScheduleDueOnDate += 1;
      return true;
    },
    isTakenToday() {
      calls.isTakenToday += 1;
      return false;
    },
    todayKey() {
      return "2026-09-12";
    },
    escapeHtml(value) {
      return String(value ?? "");
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
    markScheduleTaken() {},
    console,
  };

  vm.createContext(sandbox);
  vm.runInContext(extractNamedFunction(runtimeSrc, "renderFallbackSchedules"), sandbox);
  vm.runInContext(extractNamedFunction(runtimeSrc, "renderFallbackCalendar"), sandbox);

  return {
    calls,
    reminderList,
    calendarList,
    windowObj,
    renderSchedules() {
      vm.runInContext("renderFallbackSchedules()", sandbox);
    },
    renderCalendar() {
      vm.runInContext("renderFallbackCalendar()", sandbox);
    },
    renderBoth() {
      vm.runInContext("renderFallbackSchedules(); renderFallbackCalendar();", sandbox);
    },
    setSchedules(next) {
      schedulesRef.value = next;
    },
    setFills(next) {
      fillsRef.value = next;
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
  console.log("Stage 6c-B6 RF-B-011/012 schedule/calendar chrome + banner-at-source");

  const html = readText(path.join(ROOT, "index.html"));
  const bindSrc = readText(path.join(ROOT, "p0-ux-bind.js"));
  const appSrc = readText(path.join(ROOT, "app.js"));
  const runtimeSrc = readText(path.join(ROOT, "runtime-fixes.js"));
  const uxSrc = readText(path.join(ROOT, "src/ux/p0-ux.browser.js"));
  const css = readText(path.join(ROOT, "styles.css"));
  const loadedSrcs = extractScriptSrcs(html);
  const allowed = parseFixAllowlist();
  const scheduleSrc = extractNamedFunction(runtimeSrc, "renderFallbackSchedules");
  const calendarSrc = extractNamedFunction(runtimeSrc, "renderFallbackCalendar");
  const scheduleFields = extractFields(scheduleSrc);
  const calendarFields = extractFields(calendarSrc);
  const scheduleGuard = extractOwnerGuard(scheduleSrc);
  const calendarGuard = extractOwnerGuard(calendarSrc);
  const renderAllFallbackSrc = extractNamedFunction(runtimeSrc, "renderAllFallback");
  const persistStateSrc = extractNamedFunction(runtimeSrc, "persistState");
  const markTakenSrc = extractNamedFunction(runtimeSrc, "markScheduleTaken");
  const saveFallbackFillSrc = extractNamedFunction(runtimeSrc, "saveFallbackFill");
  const cabinetSrc = extractNamedFunction(runtimeSrc, "renderFallbackCabinet");
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

  assert(/function\s+renderSchedules\s*\(/.test(appSrc), "maintained owner renderSchedules remains in app.js");
  assert(/function\s+renderCalendar\s*\(/.test(appSrc), "maintained owner renderCalendar remains in app.js");
  assert(
    /elements\.reminderList\.innerHTML/.test(extractNamedFunction(appSrc, "renderSchedules")),
    "maintained schedule renderer still writes #reminder-list"
  );
  assert(
    /elements\.calendarList\.innerHTML/.test(extractNamedFunction(appSrc, "renderCalendar")),
    "maintained calendar renderer still writes #calendar-list"
  );
  assert(/No dosage plans yet/.test(appSrc), "maintained schedule empty chrome remains");
  assert(/Your calendar is empty right now/.test(appSrc), "maintained calendar empty chrome remains");
  assert(/calendar-section-header/.test(appSrc), "maintained calendar still emits Past/Upcoming date chrome");

  assert(/function\s+removeDuplicateScheduleBanner/.test(uxSrc), "6b.3 removeDuplicateScheduleBanner remains");
  assert(/function\s+shouldRemoveDuplicateDueTodayBanner/.test(uxSrc), "6b.3 duplicate-banner predicate remains");
  assert(/watchDuplicateScheduleBanner/.test(bindSrc), "bind still watches leftover banner mutations");
  assert(/removeDuplicateScheduleBanner/.test(bindSrc), "bind still calls the 6b.3 banner helper");

  assert(!runtimeSrc.includes("today-schedule-banner"), "RF-B-012: overlay source no longer names the banner class");
  assert(!/class=["']today-schedule-banner["']/.test(runtimeSrc), "RF-B-012: overlay source does not write the banner class attribute");
  assert(/\.today-schedule-banner\s*\{/.test(css), "styles.css still keeps the leftover banner rule (B1 CSS absorb)");

  assert(
    /if\s*\(\s*typeof\s+window\.renderSchedules\s*===\s*["']function["']\s*\)\s*\{\s*window\.renderSchedules\(\);\s*return;\s*\}/.test(
      scheduleGuard
    ),
    "RF-B-011: schedule owner-present guard retargets to renderSchedules and returns"
  );
  assert(
    /if\s*\(\s*typeof\s+window\.renderCalendar\s*===\s*["']function["']\s*\)\s*\{\s*window\.renderCalendar\(\);\s*return;\s*\}/.test(
      calendarGuard
    ),
    "RF-B-011: calendar owner-present guard retargets to renderCalendar and returns"
  );
  assert(!/reminderList\.innerHTML/.test(scheduleGuard), "RF-B-011: schedule owner guard does not last-write #reminder-list");
  assert(!/calendarList\.innerHTML/.test(calendarGuard), "RF-B-011: calendar owner guard does not last-write #calendar-list");
  assert(
    (scheduleFields.match(/reminderList\.innerHTML/g) || []).length >= 1,
    "missing-owner schedule fallback still last-writes #reminder-list"
  );
  assert(
    (calendarFields.match(/calendarList\.innerHTML/g) || []).length >= 2,
    "missing-owner calendar fallback still last-writes #calendar-list (empty + populated)"
  );

  RF_C016_MARKERS.forEach((marker) => {
    assert(scheduleFields.includes(marker), `RF-C-016 fallback marker frozen: ${marker}`);
  });
  RF_C017_MARKERS.forEach((marker) => {
    assert(calendarFields.includes(marker), `RF-C-017 fallback marker frozen: ${marker}`);
  });
  assertEqual(sha256Text(scheduleFields), FROZEN_SCHEDULE_FIELDS, "RF-C-016 fallback field template SHA-256 is frozen");
  assertEqual(sha256Text(calendarFields), FROZEN_CALENDAR_FIELDS, "RF-C-017 fallback field template SHA-256 is frozen");
  assertEqual(sha256Text(extractNamedFunction(runtimeSrc, "getTodayDueSchedules")), FROZEN_GET_TODAY_DUE, "RF-C-012 getTodayDueSchedules SHA-256 is unchanged");
  assertEqual(sha256Text(extractNamedFunction(runtimeSrc, "isScheduleDueOnDate")), FROZEN_IS_DUE_ON_DATE, "RF-C-012 isScheduleDueOnDate SHA-256 is unchanged");
  assertEqual(sha256Text(extractNamedFunction(runtimeSrc, "getNextDue")), FROZEN_GET_NEXT_DUE, "RF-C-012 getNextDue SHA-256 is unchanged");
  assertEqual(sha256Text(extractNamedFunction(runtimeSrc, "isTakenToday")), FROZEN_IS_TAKEN_TODAY, "RF-C-012 isTakenToday SHA-256 is unchanged");
  assertEqual(sha256Text(markTakenSrc), FROZEN_MARK_TAKEN, "RF-C-019 / markScheduleTaken SHA-256 is unchanged");
  assertEqual(sha256Text(extractNamedFunction(runtimeSrc, "renderScheduleIndicator")), FROZEN_INDICATOR, "RF-C-014 renderScheduleIndicator SHA-256 is unchanged");
  assertEqual(sha256Text(renderAllFallbackSrc), FROZEN_RENDER_ALL_FALLBACK, "RF-C-018 renderAllFallback body is unchanged");
  assertEqual(sha256Text(saveFallbackFillSrc), FROZEN_SAVE_FALLBACK_FILL, "RF-C-020 saveFallbackFill is unchanged");
  assertEqual(sha256Text(extractFields(cabinetSrc)), FROZEN_CABINET_FIELDS, "RF-C-015 cabinet fallback fields stay frozen");
  assert(/renderFallbackSchedules\(\);/.test(renderAllFallbackSrc), "renderAllFallback still dispatches renderFallbackSchedules");
  assert(/renderFallbackCalendar\(\);/.test(renderAllFallbackSrc), "renderAllFallback still dispatches renderFallbackCalendar");
  assert(/renderAllFallback\(\);/.test(persistStateSrc), "persistState still re-renders via renderAllFallback after save/edit/delete");
  assert(/renderAllFallback\(\);/.test(markTakenSrc), "markScheduleTaken still re-renders via renderAllFallback after taken");
  assert(/renderAllFallback\(\);/.test(saveFallbackFillSrc), "saveFallbackFill still re-renders via renderAllFallback");
  assert(/renderAllFallback\(\);/.test(bridgeSrc), "FitGenRuntimeBridge.renderAll still dispatches renderAllFallback");

  assert(
    /typeof\s+window\.setActiveView\s*===\s*["']function["']/.test(setViewSrc),
    "B3 RF-B-017: setView still does a call-time typeof window.setActiveView check"
  );
  assert(
    /typeof\s+window\.closeSaveFillModal\s*===\s*["']function["']/.test(closeSaveModalSrc),
    "B3 RF-B-018: closeSaveModal still does a call-time owner check"
  );
  assertEqual(extractBridgeMethod(bridgeSrc, "persistAndRender"), FROZEN_PERSIST_AND_RENDER, "RF-C-021 persistAndRender body is unchanged");
  assertEqual(extractBridgeMethod(bridgeSrc, "renderAll"), FROZEN_RENDER_ALL, "RF-C-022 renderAll body is unchanged");
  assertEqual(extractBridgeMethod(bridgeSrc, "getPendingOption"), FROZEN_GET_PENDING_OPTION, "RF-C-023 getPendingOption body is unchanged");
  assert(
    !C_REACHABLE_RES.some((pattern) => pattern.test(scheduleGuard) || pattern.test(calendarGuard)),
    "owner-present schedule/calendar guards do not reach persist/reminder/calculator C paths"
  );

  assert(runtimeSrc.includes("syncRemindersToBackend"), "RF-C-003 syncRemindersToBackend is untouched");
  assert(runtimeSrc.includes("computeOptions"), "RF-C-007 computeOptions is untouched");
  assert(runtimeSrc.includes("queueUpcomingBrowserReminder"), "RF-C-009 reminder timer is untouched");
  assert(/function\s+renderFallbackCabinet/.test(runtimeSrc), "RF-B-010 cabinet renderer remains");
  assert(!/\bmark-missed\b/.test(runtimeSrc), "runtime-fixes.js gained no Mark missed action");
  assert(sha256File("app.js") === FROZEN_APP, "app.js SHA-256 unchanged (owners called, not rewritten)");
  assert(
    sha256File("scripts/calc/fixtures/legacy-evidence-goldens.json") === FROZEN_GOLDENS,
    "calc goldens SHA-256 unchanged"
  );

  const live = installHarness(runtimeSrc, { owners: true });
  live.renderBoth();
  assertEqual(live.calls.renderSchedules, 1, "owner-present initial schedule render retargets to renderSchedules");
  assertEqual(live.calls.renderCalendar, 1, "owner-present initial calendar render retargets to renderCalendar");
  assertEqual(live.calls.getTodayDueSchedules, 0, "owner-present initial render does not invoke RF-C-012 getTodayDueSchedules");
  assertEqual(live.calls.getNextDue, 0, "owner-present initial render does not invoke RF-C-012 getNextDue");
  assertEqual(live.calls.isScheduleDueOnDate, 0, "owner-present initial render does not invoke RF-C-012 isScheduleDueOnDate");
  assertEqual(live.calls.isTakenToday, 0, "owner-present initial render does not invoke RF-C-012 isTakenToday");
  assert(!live.reminderList.innerHTML.includes("today-schedule-banner"), "owner-present initial schedule does not emit the banner class");
  assert(live.reminderList.innerHTML.includes("list-card"), "owner-present initial schedule keeps maintained card chrome");
  assert(live.reminderList.innerHTML.includes("card-actions"), "owner-present initial schedule keeps maintained action chrome");
  assert(live.calendarList.innerHTML.includes("calendar-section-header"), "owner-present initial calendar keeps date-section chrome");
  assert(live.calendarList.innerHTML.includes("calendar-item"), "owner-present initial calendar keeps maintained item chrome");
  assertEqual(live.reminderList.listeners.length, 0, "owner-present initial schedule attaches no RF mark-taken listeners");
  cPathQuiet(live.calls, "owner-present initial render");

  live.renderBoth();
  live.renderBoth();
  assertEqual(live.calls.renderSchedules, 3, "repeated owner-present schedule renders keep calling the maintained owner");
  assertEqual(live.calls.renderCalendar, 3, "repeated owner-present calendar renders keep calling the maintained owner");
  assertEqual(live.calls.getTodayDueSchedules, 0, "repeated owner-present renders still skip RF-C-012 due-count");
  assert(!live.reminderList.innerHTML.includes("today-schedule-banner"), "repeated owner-present renders still omit the banner class");
  assertEqual(live.reminderList.listeners.length, 0, "repeated owner-present renders do not duplicate RF listeners");

  const emptyLive = installHarness(runtimeSrc, { owners: true, fills: [], schedules: [] });
  emptyLive.renderBoth();
  assertEqual(emptyLive.calls.renderSchedules, 1, "owner-present empty schedule retargets to maintained owner");
  assertEqual(emptyLive.calls.renderCalendar, 1, "owner-present empty calendar retargets to maintained owner");
  assert(emptyLive.reminderList.innerHTML.includes("No dosage plans yet"), "owner-present empty schedule uses maintained empty chrome");
  assert(emptyLive.calendarList.innerHTML.includes("Your calendar is empty right now"), "owner-present empty calendar uses maintained empty chrome");
  assert(!emptyLive.reminderList.innerHTML.includes("No peptides are due today."), "owner-present empty schedule does not last-write RF due-today empty chrome");
  assert(!emptyLive.calendarList.innerHTML.includes("No calendar items yet."), "owner-present empty calendar does not last-write RF empty chrome");
  assertEqual(emptyLive.calls.getTodayDueSchedules, 0, "owner-present empty render does not invoke RF-C-012");

  const saveLive = installHarness(runtimeSrc, { owners: true, schedules: [] });
  saveLive.renderBoth();
  saveLive.setSchedules([SYNTHETIC_SCHEDULE]);
  saveLive.renderBoth();
  assertEqual(saveLive.calls.renderSchedules, 2, "re-render after save hits maintained schedule owner");
  assertEqual(saveLive.calls.renderCalendar, 2, "re-render after save hits maintained calendar owner");
  assert(saveLive.reminderList.innerHTML.includes("list-card"), "re-render after save restores maintained schedule card chrome");
  assert(saveLive.calendarList.innerHTML.includes("calendar-section-header"), "re-render after save restores maintained calendar date chrome");

  const takenLive = installHarness(runtimeSrc, { owners: true });
  takenLive.renderBoth();
  takenLive.setSchedules([{ ...SYNTHETIC_SCHEDULE, takenDates: ["2026-09-12"] }]);
  takenLive.renderBoth();
  assertEqual(takenLive.calls.renderSchedules, 2, "re-render after taken hits maintained schedule owner");
  assertEqual(takenLive.calls.getTodayDueSchedules, 0, "re-render after taken does not recompute RF-C-012");
  takenLive.setSchedules([SYNTHETIC_SCHEDULE]);
  takenLive.renderBoth();
  assertEqual(takenLive.calls.renderSchedules, 3, "re-render after undo hits maintained schedule owner");
  assert(!takenLive.reminderList.innerHTML.includes("today-schedule-banner"), "re-render after undo still omits the banner class");

  const dateLive = installHarness(runtimeSrc, { owners: true });
  dateLive.renderCalendar();
  assert(dateLive.calendarList.innerHTML.includes("Upcoming"), "owner-present calendar starts on the upcoming date section");
  assert(!dateLive.calendarList.innerHTML.includes("Past Doses"), "owner-present same-day seed has no past section");
  dateLive.setSchedules([{ ...SYNTHETIC_SCHEDULE, startDate: "2026-08-29" }]);
  dateLive.renderCalendar();
  assertEqual(dateLive.calls.renderCalendar, 2, "date navigation re-render hits maintained calendar owner");
  assert(dateLive.calendarList.innerHTML.includes("Past Doses"), "date navigation reveals the maintained Past Doses chrome");
  assert(dateLive.calendarList.innerHTML.includes("Upcoming"), "date navigation keeps the maintained Upcoming chrome");
  assertEqual(dateLive.calls.getNextDue, 0, "date navigation does not invoke overlay RF-C-017 getNextDue");

  const wipe = installHarness(runtimeSrc, {
    owners: false,
    reminderHtml: MAINTAINED_SCHEDULE_HTML,
    calendarHtml: MAINTAINED_CALENDAR_HTML,
  });
  assert(typeof wipe.windowObj.renderSchedules !== "function", "missing-owner sandbox has no renderSchedules");
  assert(typeof wipe.windowObj.renderCalendar !== "function", "missing-owner sandbox has no renderCalendar");
  wipe.renderBoth();
  assertEqual(wipe.calls.renderSchedules, 0, "missing-owner populated schedule does not call maintained owner");
  assertEqual(wipe.calls.renderCalendar, 0, "missing-owner populated calendar does not call maintained owner");
  assert(!wipe.reminderList.innerHTML.includes("today-schedule-banner"), "RF-B-012: missing-owner populated schedule does not emit the banner class");
  assert(!wipe.reminderList.innerHTML.includes("Due Today"), "RF-B-012: missing-owner populated schedule does not emit Due Today banner copy");
  assert(wipe.reminderList.innerHTML.includes("list-card"), "missing-owner populated schedule still emits RF list-card chrome");
  assert(wipe.reminderList.innerHTML.includes("schedule-status-pill"), "missing-owner populated schedule keeps RF-C-016 status pill");
  assert(wipe.reminderList.innerHTML.includes("Draw each dose"), "missing-owner populated schedule keeps RF-C-016 draw copy");
  assert(wipe.reminderList.innerHTML.includes("Next dose"), "missing-owner populated schedule keeps RF-C-016 next-due copy");
  assert(wipe.reminderList.innerHTML.includes('data-action="mark-taken"'), "missing-owner populated schedule keeps Mark Taken host");
  assert(wipe.calendarList.innerHTML.includes("calendar-day"), "missing-owner populated calendar still emits RF calendar-day chrome");
  assert(wipe.calendarList.innerHTML.includes("Next due "), "missing-owner populated calendar keeps RF-C-017 next-due copy");
  assert(!wipe.calendarList.innerHTML.includes("calendar-section-header"), "missing-owner populated calendar does not invent maintained date sections");
  assert(wipe.calls.getTodayDueSchedules >= 1, "missing-owner populated schedule still calls RF-C-012 getTodayDueSchedules");
  assert(wipe.calls.getNextDue >= 1, "missing-owner populated calendar still calls RF-C-017 getNextDue");
  assertEqual(wipe.reminderList.listeners.length, 1, "missing-owner populated schedule still attaches one RF mark-taken listener");
  cPathQuiet(wipe.calls, "missing-owner populated render");

  wipe.renderBoth();
  assert(!wipe.reminderList.innerHTML.includes("today-schedule-banner"), "repeated missing-owner render still omits the banner class");
  assert(wipe.reminderList.innerHTML.includes("list-card"), "repeated missing-owner render keeps RF list-card chrome");

  const emptyAbsent = installHarness(runtimeSrc, {
    owners: false,
    fills: [],
    schedules: [],
    todayDue: [],
    reminderHtml: MAINTAINED_SCHEDULE_HTML,
    calendarHtml: MAINTAINED_CALENDAR_HTML,
  });
  emptyAbsent.renderBoth();
  assert(emptyAbsent.reminderList.innerHTML.includes("No peptides are due today."), "missing-owner empty schedule keeps RF due-today empty chrome");
  assert(emptyAbsent.reminderList.innerHTML.includes("No schedules saved yet. Save a fill first."), "missing-owner empty schedule keeps RF list empty chrome");
  assertEqual(
    emptyAbsent.calendarList.innerHTML,
    '<div class="empty-state">No calendar items yet.</div>',
    "missing-owner empty calendar last-writes RF empty chrome"
  );
  assert(!emptyAbsent.reminderList.innerHTML.includes("today-schedule-banner"), "missing-owner empty schedule does not emit the banner class");

  const leftover = {
    children: [
      { textContent: "Due Today — 2 peptide doses due today.", className: "today-schedule-banner", remove() { leftover.removed = true; } },
      { textContent: "Demo Vial A", className: "list-card" },
    ],
    querySelectorAll(selector) {
      if (selector === '[data-action="mark-taken"]') {
        return [{}, {}];
      }
      return [];
    },
    removed: false,
  };
  leftover.children[0].parentElement = leftover;
  leftover.children[0].style = { display: "" };
  leftover.removeChild = () => {
    leftover.removed = true;
  };
  assert(/function\s+shouldRemoveDuplicateDueTodayBanner/.test(uxSrc), "6b.3 leftover helper still exists for injected banner DOM");

  assert(fs.existsSync(path.join(EVIDENCE_DIR, "STAGE6CB6.md")), "STAGE6CB6 evidence note is present");
  assert(fs.existsSync(path.join(EVIDENCE_DIR, "schedule-state.json")), "ARIA/focus schedule-state.json is present");
  assert(fs.existsSync(path.join(EVIDENCE_DIR, "schedule-state-before.json")), "before schedule-state JSON is present");
  for (const shot of REQUIRED_SHOTS) {
    const filePath = path.join(EVIDENCE_DIR, shot);
    assert(fs.existsSync(filePath), `evidence PNG exists: ${shot}`);
    if (fs.existsSync(filePath)) {
      const stats = assertPngHasVisibleContent(filePath);
      assert(stats.width >= 300 && stats.height >= 300, `${shot} has reviewable viewport pixels`);
    }
  }

  const beforeState = JSON.parse(readText(path.join(EVIDENCE_DIR, "schedule-state-before.json")));
  const afterState = JSON.parse(readText(path.join(EVIDENCE_DIR, "schedule-state.json")));
  assert(beforeState.viewports.length === 2, "before state records desktop and mobile");
  assert(afterState.viewports.length === 2, "after state records desktop and mobile");
  for (const viewport of beforeState.viewports) {
    assertEqual(viewport.shots.scheduleEmpty.state.emptyText.includes("No schedules saved yet. Save a fill first."), true, `${viewport.viewport} before empty schedule is RF empty chrome`);
    assertEqual(viewport.shots.calendarEmpty.state.emptyText.includes("No calendar items yet."), true, `${viewport.viewport} before empty calendar is RF empty chrome`);
    assertEqual(viewport.shots.schedulePopulated.state.htmlHasBanner, false, `${viewport.viewport} before populated schedule already has 6b.3 banner stripped`);
    assertEqual(viewport.shots.schedulePopulated.state.cardCount >= 1, true, `${viewport.viewport} before populated schedule keeps the row`);
    assertEqual(viewport.shots.calendarPopulated.state.htmlHasSectionHeaders, false, `${viewport.viewport} before populated calendar is RF flat chrome`);
    assertEqual(viewport.shots.schedulePopulated.state.ownerPresent, true, `${viewport.viewport} before populated still had the maintained owner present`);
  }
  for (const viewport of afterState.viewports) {
    assertEqual(viewport.shots.scheduleEmpty.state.emptyText.some((text) => /dosage plans yet/i.test(text)), true, `${viewport.viewport} after empty schedule uses maintained empty chrome`);
    assertEqual(viewport.shots.calendarEmpty.state.emptyText.some((text) => /calendar is empty/i.test(text)), true, `${viewport.viewport} after empty calendar uses maintained empty chrome`);
    assertEqual(viewport.shots.schedulePopulated.state.htmlHasBanner, false, `${viewport.viewport} after populated schedule still has no banner`);
    assert(viewport.shots.schedulePopulated.state.cardCount >= 1, `${viewport.viewport} after populated schedule keeps the row`);
    assertEqual(viewport.shots.calendarPopulated.state.htmlHasSectionHeaders, true, `${viewport.viewport} after populated calendar uses maintained date sections`);
    assert(viewport.shots.calendarDates.state.sectionHeaders.includes("Past Doses"), `${viewport.viewport} after date navigation shows Past Doses`);
    assert(viewport.shots.calendarDates.state.sectionHeaders.includes("Upcoming"), `${viewport.viewport} after date navigation shows Upcoming`);
    assertEqual(viewport.shots.focusMarkTaken.focus.ok, true, `${viewport.viewport} after focus lands on a schedule action host`);
    assertEqual(viewport.shots.focusCalendar.focus.ok, true, `${viewport.viewport} after focus lands on a calendar host`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    process.exit(1);
  }
}

main();
