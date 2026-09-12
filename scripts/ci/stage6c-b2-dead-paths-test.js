#!/usr/bin/env node
"use strict";

/**
 * Stage 6c-B2 — RF-A-003 dead-path proof/deletion (Issue #34).
 *
 * Binding: Codex [NEXT_STAGE_AUTHORIZED] comment 5646357576.
 * Binding Spec: docs/recovery/stage-6c-inventory-spec-v2.md (RF-A-003).
 *
 * Prove p0-ux-bind.js document-capture owns Cabinet Edit/Delete, then
 * delete only the redundant runtime-fixes.js per-button bubble listeners.
 * Fail closed if:
 *   - index.html load order is not bind before runtime-fixes.js
 *   - bind no longer capture-stops edit-fill / delete-fill
 *   - extracted handleEditFill / handleDeleteFill no longer stop the event
 *   - runtime-fixes.js re-attaches those bubble listeners
 *   - prompt editFillRecord / guarded deleteFillRecord function bodies vanish
 *   - runtime-fixes.js is de-allowlisted or unloaded
 *
 * RF-A-001 / RF-A-004 / RF-A-005 are characterized but not deleted:
 * proof is incomplete (see CHARACTERIZATION below).
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

const EDIT_BUBBLE_WIRE = /querySelectorAll\(\s*['"]\[data-action=["']edit-fill["']\]['"]\s*\)[\s\S]{0,240}addEventListener\(\s*["']click["']/;
const DELETE_BUBBLE_WIRE = /querySelectorAll\(\s*['"]\[data-action=["']delete-fill["']\]['"]\s*\)[\s\S]{0,240}addEventListener\(\s*["']click["']/;
const EDIT_RECORD_LISTENER = /addEventListener\(\s*["']click["']\s*,\s*\(?\s*\)?\s*=>\s*editFillRecord/;
const DELETE_RECORD_LISTENER = /addEventListener\(\s*["']click["']\s*,\s*\(?\s*\)?\s*=>\s*deleteFillRecord/;
const DOCUMENT_CLICK_CAPTURE = /document\.addEventListener\(\s*"click",[\s\S]*?handleEditFill\(event\);[\s\S]*?handleDeleteFill\(event\);[\s\S]*?true\s*\)/;

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

function matchesActionSelector(node, selector) {
  const attrEq = /^\[([^=\]]+)=['"]([^'"]+)['"]\]$/.exec(selector);
  if (!attrEq) {
    return false;
  }
  return node.getAttribute(attrEq[1]) === attrEq[2];
}

class Element {
  constructor(tag, attrs = {}) {
    this.tagName = String(tag).toUpperCase();
    this.parentNode = null;
    this.children = [];
    this.attrs = { ...attrs };
    this.dataset = {};
    this.listeners = { capture: [], bubble: [] };
    if (attrs["data-action"]) {
      this.dataset.action = attrs["data-action"];
    }
    if (attrs["data-id"]) {
      this.dataset.id = attrs["data-id"];
    }
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attrs, name) ? String(this.attrs[name]) : null;
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (matchesActionSelector(node, selector)) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  addEventListener(type, listener, options) {
    const capture = options === true || (options && options.capture);
    this.listeners[capture ? "capture" : "bubble"].push({ type, listener });
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
}

function dispatchClick(target) {
  const event = {
    type: "click",
    target,
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
  const path = [];
  let node = target;
  while (node) {
    path.unshift(node);
    node = node.parentNode;
  }
  for (const current of path) {
    if (event.immediateStopped || event.propagationStopped) {
      break;
    }
    for (const item of current.listeners.capture.slice()) {
      if (item.type !== "click") {
        continue;
      }
      if (event.immediateStopped) {
        break;
      }
      item.listener(event);
    }
  }
  if (!event.immediateStopped && !event.propagationStopped) {
    for (let index = path.length - 1; index >= 0; index -= 1) {
      if (event.immediateStopped || event.propagationStopped) {
        break;
      }
      const current = path[index];
      for (const item of current.listeners.bubble.slice()) {
        if (item.type !== "click") {
          continue;
        }
        if (event.immediateStopped) {
          break;
        }
        item.listener(event);
      }
    }
  }
  return event;
}

function createOwnershipSandbox(bindSrc) {
  const handleEditFill = extractNamedFunction(bindSrc, "handleEditFill");
  const handleDeleteFill = extractNamedFunction(bindSrc, "handleDeleteFill");
  const calls = {
    edit: [],
    dialog: [],
    rfEdit: 0,
    rfDelete: 0,
    prompts: 0,
    alerts: 0,
    persist: 0,
  };

  const sandbox = {
    handleEditFill: null,
    handleDeleteFill: null,
    openEditFillModal(fillId) {
      calls.edit.push(fillId);
    },
    openDialog(options) {
      calls.dialog.push(options);
    },
    readFills() {
      return [{ savedId: "fill-6cb2", name: "Demo Vial A" }];
    },
    readSchedules() {
      return [];
    },
    readOccurrences() {
      return [];
    },
    writeAppState() {
      calls.persist += 1;
    },
    todayKey() {
      return "2026-09-12";
    },
    ux: {
      planCabinetCascade() {
        return {
          fillId: "fill-6cb2",
          fillName: "Demo Vial A",
          scheduleCount: 0,
          historicalTakenCount: 0,
        };
      },
      cabinetDeleteTitle(name) {
        return `Delete ${name}`;
      },
      cabinetDeleteBody() {
        return "synthetic delete body";
      },
      CABINET_DELETE_PRIMARY: "Delete",
      CABINET_DELETE_CANCEL: "Cancel",
      PERSIST_FAIL_ERROR: "Could not save.",
      applyCabinetArchive() {
        return { fills: [], schedules: [], occurrences: [] };
      },
      activeFills() {
        return [];
      },
    },
    state: { selectedFillId: "fill-6cb2", expandedFillId: "fill-6cb2" },
    window: { FitGenRuntimeBridge: null },
    setDialogError() {},
    closeDialog() {},
    console,
  };

  vm.createContext(sandbox);
  vm.runInContext(`${handleEditFill}\n${handleDeleteFill}`, sandbox);
  return { sandbox, calls, handleEditFill, handleDeleteFill };
}

function attachBindCapture(documentNode, sandbox) {
  documentNode.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }
      sandbox.handleEditFill(event);
      sandbox.handleDeleteFill(event);
    },
    true
  );
}

function attachLegacyBubble(button, action, calls) {
  button.addEventListener("click", () => {
    if (action === "edit") {
      calls.rfEdit += 1;
      calls.prompts += 1;
    } else {
      calls.rfDelete += 1;
    }
  });
}

function buildCabinetTree() {
  const documentNode = new Element("document");
  const cabinet = new Element("div", { id: "current-peptides" });
  const edit = new Element("button", { "data-action": "edit-fill", "data-id": "fill-6cb2" });
  const remove = new Element("button", { "data-action": "delete-fill", "data-id": "fill-6cb2" });
  const other = new Element("button", { "data-action": "mark-taken", "data-id": "sched-1" });
  documentNode.appendChild(cabinet);
  cabinet.appendChild(edit);
  cabinet.appendChild(remove);
  cabinet.appendChild(other);
  return { documentNode, cabinet, edit, remove, other };
}

function main() {
  console.log("Stage 6c-B2 RF-A-003 Cabinet Edit/Delete dead-path proof");

  const html = readText(path.join(ROOT, "index.html"));
  const bindSrc = readText(path.join(ROOT, "p0-ux-bind.js"));
  const runtimeSrc = readText(path.join(ROOT, "runtime-fixes.js"));
  const loadedSrcs = extractScriptSrcs(html);
  const allowed = parseFixAllowlist();

  assert(loadedSrcs.includes("p0-ux-bind.js"), "index.html loads p0-ux-bind.js");
  assert(loadedSrcs.includes("runtime-fixes.js"), "runtime-fixes.js remains loaded by index.html");
  assert(
    loadedSrcs.indexOf("p0-ux-bind.js") < loadedSrcs.indexOf("runtime-fixes.js"),
    "load order: p0-ux-bind.js before runtime-fixes.js"
  );
  assert(fs.existsSync(path.join(ROOT, "runtime-fixes.js")), "runtime-fixes.js remains on disk");
  assert(allowed.has("runtime-fixes.js"), "runtime-fix-js allowlist still lists runtime-fixes.js");
  assertEqual([...allowed].sort(), REMAINING_LOADED.slice().sort(), "runtime-fix-js allowlist is unchanged");

  assert(DOCUMENT_CLICK_CAPTURE.test(bindSrc), "bind document click capture calls handleEditFill then handleDeleteFill");
  assert(bindSrc.includes("[data-action='edit-fill']"), "bind capture-matches edit-fill");
  assert(bindSrc.includes("[data-action='delete-fill']"), "bind capture-matches delete-fill");
  assert(bindSrc.includes("openEditFillModal"), "bind Edit path opens the edit modal, not window.prompt");
  assert(bindSrc.includes("planCabinetCascade"), "bind Delete path uses the cabinet-cascade dialog");

  const handleEditFill = extractNamedFunction(bindSrc, "handleEditFill");
  const handleDeleteFill = extractNamedFunction(bindSrc, "handleDeleteFill");
  assert(Boolean(handleEditFill), "handleEditFill is extractable from p0-ux-bind.js");
  assert(Boolean(handleDeleteFill), "handleDeleteFill is extractable from p0-ux-bind.js");
  assert(
    handleEditFill.includes('event.target.closest("[data-action=\'edit-fill\']")'),
    "handleEditFill closest-matches edit-fill"
  );
  assert(handleEditFill.includes("event.preventDefault()"), "handleEditFill preventDefault");
  assert(handleEditFill.includes("event.stopImmediatePropagation()"), "handleEditFill stopImmediatePropagation");
  assert(handleEditFill.includes("openEditFillModal(button.dataset.id)"), "handleEditFill opens the bind modal");
  assert(!/window\.prompt\s*\(/.test(handleEditFill), "handleEditFill does not call window.prompt");
  assert(
    handleDeleteFill.includes('event.target.closest("[data-action=\'delete-fill\']")'),
    "handleDeleteFill closest-matches delete-fill"
  );
  assert(handleDeleteFill.includes("event.preventDefault()"), "handleDeleteFill preventDefault");
  assert(handleDeleteFill.includes("event.stopImmediatePropagation()"), "handleDeleteFill stopImmediatePropagation");
  assert(handleDeleteFill.includes("openDialog"), "handleDeleteFill opens the bind dialog");
  assert(!/window\.prompt\s*\(/.test(handleDeleteFill), "handleDeleteFill does not call window.prompt");

  assert(
    !EDIT_BUBBLE_WIRE.test(runtimeSrc) && !EDIT_RECORD_LISTENER.test(runtimeSrc),
    "RF-A-003: runtime-fixes.js no longer wires edit-fill bubble listeners"
  );
  assert(
    !DELETE_BUBBLE_WIRE.test(runtimeSrc) && !DELETE_RECORD_LISTENER.test(runtimeSrc),
    "RF-A-003: runtime-fixes.js no longer wires delete-fill bubble listeners"
  );
  assert(
    runtimeSrc.includes('data-action="edit-fill"') && runtimeSrc.includes('data-action="delete-fill"'),
    "cabinet Edit/Delete button markup remains (RF-B-010 shell; not this slice)"
  );
  assert(
    runtimeSrc.includes("function editFillRecord") && /window\.prompt\(/.test(runtimeSrc),
    "editFillRecord prompt function body remains (listener path only was RF-A-003)"
  );
  assert(
    runtimeSrc.includes("function deleteFillRecord") && runtimeSrc.includes("window.FitGenP0UxBind"),
    "deleteFillRecord guarded function body remains"
  );
  assert(
    /if\s*\(\s*window\.FitGenP0UxBind\s*\)\s*\{\s*return;/.test(runtimeSrc),
    "deleteFillRecord still no-ops when bind is installed (belt-and-braces, not the live owner)"
  );

  assert(
    /function\s+hideLegacyScheduleEditor/.test(runtimeSrc) && /scheduleFormShell\.hidden\s*=\s*true/.test(runtimeSrc),
    "RF-A-001 left unchanged: hideLegacyScheduleEditor still live-sets hidden"
  );
  assert(
    /schedule\.takenDates\s*=\s*\[\s*\.\.\.schedule\.takenDates/.test(runtimeSrc),
    "RF-A-004 left unchanged: legacy takenDates mutation branch remains"
  );
  assert(
    /function\s+saveFallbackFill/.test(runtimeSrc) && /saveFillForm\.addEventListener\(\s*"submit"/.test(runtimeSrc),
    "RF-A-005 left unchanged: save-form capture + saveFallbackFill remain"
  );
  assert(runtimeSrc.includes("syncRemindersToBackend"), "RF-C-003 syncRemindersToBackend is untouched");
  assert(runtimeSrc.includes("computeOptions"), "RF-C-007 computeOptions is untouched");
  assert(runtimeSrc.includes("queueUpcomingBrowserReminder"), "RF-C-009 reminder timer is untouched");
  assert(!/\bmark-missed\b/.test(runtimeSrc), "runtime-fixes.js gained no Mark missed action");
  assert(!bindSrc.includes("editFillRecord("), "bind does not call runtime editFillRecord");
  assert(!bindSrc.includes("deleteFillRecord("), "bind does not call runtime deleteFillRecord");

  const { sandbox, calls } = createOwnershipSandbox(bindSrc);
  const tree = buildCabinetTree();
  attachBindCapture(tree.documentNode, sandbox);
  attachLegacyBubble(tree.edit, "edit", calls);
  attachLegacyBubble(tree.remove, "delete", calls);

  const editEvent = dispatchClick(tree.edit);
  assert(editEvent.defaultPrevented, "Edit click: bind preventDefault");
  assert(editEvent.immediateStopped, "Edit click: bind stopImmediatePropagation before bubble");
  assertEqual(calls.edit, ["fill-6cb2"], "Edit click: bind openEditFillModal once");
  assertEqual(calls.rfEdit, 0, "Edit click: legacy editFillRecord / prompt does not run");
  assertEqual(calls.prompts, 0, "Edit click: no window.prompt (no double invocation)");
  assertEqual(calls.dialog.length, 0, "Edit click: Delete dialog is not opened");

  const deleteEvent = dispatchClick(tree.remove);
  assert(deleteEvent.defaultPrevented, "Delete click: bind preventDefault");
  assert(deleteEvent.immediateStopped, "Delete click: bind stopImmediatePropagation before bubble");
  assertEqual(calls.dialog.length, 1, "Delete click: bind openDialog once");
  assertEqual(calls.dialog[0] && calls.dialog[0].kind, "cabinet-delete", "Delete click: dialog kind is cabinet-delete");
  assertEqual(calls.rfDelete, 0, "Delete click: legacy deleteFillRecord does not run");
  assertEqual(calls.edit, ["fill-6cb2"], "Delete click: Edit modal is not opened a second time");
  assertEqual(calls.persist, 0, "Delete click: persist does not run until dialog primary (failure path stays bind-owned)");

  const otherEvent = dispatchClick(tree.other);
  assert(otherEvent.defaultPrevented === false, "unrelated action: bind Edit/Delete do not preventDefault");
  assert(otherEvent.immediateStopped === false, "unrelated action: bind Edit/Delete do not stop the event");
  assertEqual(calls.rfEdit, 0, "unrelated action: Edit bubble spy still quiet");
  assertEqual(calls.rfDelete, 0, "unrelated action: Delete bubble spy still quiet");

  const nonElementEvent = {
    type: "click",
    target: { toString: () => "[non-element]" },
    defaultPrevented: false,
    immediateStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopImmediatePropagation() {
      this.immediateStopped = true;
    },
  };
  tree.documentNode.listeners.capture
    .filter((item) => item.type === "click")
    .forEach((item) => item.listener(nonElementEvent));
  assert(nonElementEvent.immediateStopped === false, "non-Element target: bind capture returns without stopping");
  assertEqual(calls.rfEdit, 0, "non-Element target: RF Edit path still unreachable");
  assertEqual(calls.rfDelete, 0, "non-Element target: RF Delete path still unreachable");

  const reloaded = buildCabinetTree();
  attachBindCapture(reloaded.documentNode, sandbox);
  const reloadEdit = dispatchClick(reloaded.edit);
  const reloadDelete = dispatchClick(reloaded.remove);
  assert(reloadEdit.immediateStopped, "reload/re-render: bind capture still owns new Edit button");
  assert(reloadDelete.immediateStopped, "reload/re-render: bind capture still owns new Delete button");
  assertEqual(calls.edit.length, 2, "reload/re-render: Edit still bind-owned exactly once more");
  assertEqual(calls.dialog.length, 2, "reload/re-render: Delete still bind-owned exactly once more");
  assertEqual(calls.rfEdit, 0, "reload/re-render: no RF Edit listener is reattached after deletion");
  assertEqual(calls.rfDelete, 0, "reload/re-render: no RF Delete listener is reattached after deletion");
  assertEqual(calls.prompts, 0, "reload/re-render: prompt path stays dead");

  assert(sha256File("app.js") === FROZEN_APP, "app.js SHA-256 unchanged (no formula-builder edits)");
  assert(
    sha256File("scripts/calc/fixtures/legacy-evidence-goldens.json") === FROZEN_GOLDENS,
    "calc goldens SHA-256 unchanged"
  );

  console.log(`
CHARACTERIZATION
  RF-A-003  PROVEN_UNREACHABLE  bind document capture + stopImmediatePropagation owns
            Cabinet Edit/Delete. Deleted only the runtime-fixes.js per-button bubble
            listeners. editFillRecord / deleteFillRecord function bodies remain.
  RF-A-001  NOT_PROVEN          hideLegacyScheduleEditor still sets .schedule-form-hidden
            hidden=true. CSS already uses display:none !important, but the JS write is a
            live RF-B-004 attribute change, not a proven no-op. Left unchanged.
  RF-A-004  NOT_PROVEN          markScheduleTaken takenDates mutation is skipped when
            FitGenP0UxBind.adapter exists, but mark-taken bubble listeners still attach
            and the branch is a bind-absent fallback (RF-C-019). Left unchanged.
  RF-A-005  NOT_PROVEN          bind and runtime-fixes.js both capture submit on
            #save-fill-form. Bind registers first and stops, but deleting saveFallbackFill
            is RF-C-020-adjacent and not independently fail-closed here. Left unchanged.
`);

  console.log(`${passed} passed, ${failed} failed`);
  if (failed) {
    process.exit(1);
  }
}

main();
