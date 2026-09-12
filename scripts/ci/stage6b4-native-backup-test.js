#!/usr/bin/env node
"use strict";

/**
 * Stage 6b.4 — retire superseded native-backup-fix.js (Issue #34).
 *
 * Atlas Spec 5641876671: prove-and-delete, not a port. The overlay cloned
 * #export-data, built a legacy version:2 mirror-only backup (no occurrences),
 * and could steal the click. Stage 3 bind + src/persist/export.ts already own
 * the live path (warning → schemaVersion 3 → writeLocalBackup native|download).
 * These locks fail if the dead file is reintroduced, if a second native click
 * path bypasses the warning, or if bind no longer owns #export-data.
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
const RETIRED = "native-backup-fix.js";
const REMAINING_LOADED = ["runtime-fixes.js"];
const FROZEN_GOLDENS = "659c1865da95c3197395c931e154c4267c802d8aaf7842aee83345962d013acd";
const FROZEN_APP = "489cd7b88b90e00bd2a700518312577cf5a65cf12cacc003d9a181422606a537";
const SHARE_CALL = /navigator\.share\s*\(/;
const SAVE_PICKER = /showSaveFilePicker/;
const OVERLAY_CLONE = /cloneNode\s*\(/;
const OVERLAY_REPLACE = /replaceWith\s*\(/;
const LEGACY_V2_BUILDER = /version\s*:\s*2/;
const MIRROR_MEDS = /peptide-calculator-v2-medications/;

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
  const style = {
    removeProperty() {},
  };
  const element = {
    id: id || "",
    tagName: String(tagName || "div").toUpperCase(),
    children: [],
    parentNode: null,
    textContent: "",
    innerHTML: "",
    value: "",
    href: "",
    download: "",
    rel: "",
    disabled: false,
    dataset,
    style,
    classList: createClassList(""),
    getAttribute(name) {
      if (name === "class") {
        return this.classList.toString();
      }
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
    setAttribute(name, value) {
      attrs[name] = String(value);
      if (name === "class") {
        this.classList = createClassList(value);
      }
    },
    removeAttribute(name) {
      delete attrs[name];
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
        node = node.parentNode;
      }
      return null;
    },
    addEventListener(type, fn, options) {
      if (!listeners.has(type)) {
        listeners.set(type, []);
      }
      listeners.get(type).push({
        fn,
        capture: options === true || (options && options.capture === true),
      });
    },
    removeEventListener(type, fn) {
      const list = listeners.get(type) || [];
      listeners.set(
        type,
        list.filter((item) => item.fn !== fn)
      );
    },
    dispatchEvent(event) {
      for (const entry of listeners.get(event.type) || []) {
        if (event.immediateStopped) {
          break;
        }
        entry.fn(event);
      }
    },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    removeChild(child) {
      this.children = this.children.filter((item) => item !== child);
      child.parentNode = null;
      return child;
    },
    focus() {},
    click() {
      this.dispatchEvent({
        type: "click",
        target: this,
        preventDefault() {},
        stopImmediatePropagation() {},
      });
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    _listeners: listeners,
  };
  return element;
}

function createExportHarness(options) {
  const nativeCalls = [];
  const withNative = Boolean(options && options.native);
  const elementsById = new Map();
  const documentListeners = new Map();
  const downloaded = [];
  let shareCalls = 0;
  let objectUrls = 0;

  function remember(element) {
    if (element.id) {
      elementsById.set(element.id, element);
    }
    return element;
  }

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
  ]) {
    remember(createMockElement(id, id === "export-data" ? "button" : "div"));
  }
  elementsById.get("fitgen-confirm-dialog").classList.add("is-hidden");
  elementsById.get("fitgen-confirm-error").classList.add("is-hidden");
  elementsById.get("export-data").closest = function closest(selector) {
    if (selector === "#export-data") {
      return this;
    }
    return null;
  };

  class Element {}
  class HTMLElement extends Element {}
  Object.setPrototypeOf(createMockElement("proto"), HTMLElement.prototype);
  for (const node of elementsById.values()) {
    Object.setPrototypeOf(node, HTMLElement.prototype);
  }

  const body = createMockElement("body", "body");
  Object.setPrototypeOf(body, HTMLElement.prototype);

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
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    createElement(tag) {
      const node = createMockElement("", tag);
      Object.setPrototypeOf(node, HTMLElement.prototype);
      const originalClick = node.click.bind(node);
      node.click = function clickCreated() {
        if (node.tagName === "A" && node.download) {
          downloaded.push({ href: node.href, filename: node.download });
        }
        originalClick();
      };
      return node;
    },
    addEventListener(type, fn, opts) {
      if (!documentListeners.has(type)) {
        documentListeners.set(type, []);
      }
      documentListeners.get(type).push({
        fn,
        capture: opts === true || (opts && opts.capture === true),
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

  const blobs = new Map();
  let lastBlobText = "";
  const window = {
    document,
    localStorage,
    FitGenNativeBackup: withNative
      ? {
          exportBackup(json, filename) {
            nativeCalls.push({ json, filename });
            return JSON.stringify({ ok: true });
          },
        }
      : undefined,
    navigator: {
      userAgent: "Stage6b4Harness",
      share() {
        shareCalls += 1;
        throw new Error("navigator.share must not be invoked (FR-EXP-001)");
      },
      canShare() {
        return true;
      },
    },
    HTMLElement,
    Element,
    Blob: class Blob {
      constructor(parts) {
        lastBlobText = (parts || []).map(String).join("");
        this._text = lastBlobText;
      }
    },
    URL: {
      createObjectURL(blob) {
        objectUrls += 1;
        const href = `blob:stage6b4-${objectUrls}`;
        const text = blob && blob._text != null ? blob._text : lastBlobText;
        blobs.set(href, text);
        return href;
      },
      revokeObjectURL(href) {
        blobs.delete(href);
      },
    },
    setTimeout(fn) {
      if (typeof fn === "function") {
        fn();
      }
      return 1;
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
    if (!event.immediateStopped) {
      target.dispatchEvent(event);
    }
    return event;
  }

  return {
    window,
    document,
    localStorage,
    elementsById,
    downloaded,
    blobs,
    nativeCalls,
    lastBlobText: () => lastBlobText,
    dispatchDocumentClick,
    shareCallCount: () => shareCalls,
  };
}

function sampleAppState() {
  return {
    fills: [{ savedId: "fill-6b4", name: "Synthetic Native Probe", vialAmount: 10, unitLabel: "mg" }],
    schedules: [{ id: "sched-6b4", fillSavedId: "fill-6b4", doseAmount: 1, unitLabel: "mg" }],
    occurrences: [{ id: "occ-6b4", scheduleId: "sched-6b4", dateKey: "2026-09-11", status: "planned" }],
    medications: [{ id: "med-6b4", name: "Synthetic Native Probe" }],
  };
}

function loadBind(harness) {
  const context = {
    window: harness.window,
    document: harness.document,
    localStorage: harness.localStorage,
    navigator: harness.window.navigator,
    HTMLElement: harness.window.HTMLElement,
    Element: harness.window.Element,
    Blob: harness.window.Blob,
    URL: harness.window.URL,
    setTimeout: harness.window.setTimeout,
    clearTimeout: harness.window.clearTimeout,
    requestAnimationFrame: harness.window.requestAnimationFrame,
    console,
  };
  context.globalThis = harness.window;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, BUNDLE_REL), "utf8"), context);
  context.FitGenP0Ux = context.window.FitGenP0Ux;
  const state = sampleAppState();
  context.window.FitGenP0Ux.commitAppState(harness.localStorage, state, {
    medications: state.medications,
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "p0-ux-bind.js"), "utf8"), context);
  return context;
}

function attachSupersededOverlay(harness) {
  const exportButton = harness.elementsById.get("export-data");
  let overlayFired = 0;
  exportButton.addEventListener(
    "click",
    (event) => {
      overlayFired += 1;
      const native = harness.window.FitGenNativeBackup;
      if (native && typeof native.exportBackup === "function") {
        native.exportBackup(
          JSON.stringify({
            version: 2,
            exportedAt: "2026-09-11T00:00:00.000Z",
            medications: [],
            fills: [],
            schedules: [],
          }),
          "overlay-v2.json"
        );
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );
  return {
    overlayFireCount: () => overlayFired,
  };
}

function main() {
  console.log("Stage 6b.4 native-backup-fix.js retired; Stage 3 export path owns #export-data");

  const html = readText(path.join(ROOT, "index.html"));
  const loadedSrcs = extractScriptSrcs(html);
  const bindSrc = readText(path.join(ROOT, "p0-ux-bind.js"));
  const persistExportSrc = readText(path.join(ROOT, "src/persist/export.ts"));
  const allowed = parseFixAllowlist();

  assert(loadedSrcs.includes("p0-ux-bind.js"), "index.html loads p0-ux-bind.js");
  assert(loadedSrcs.includes("src/ux/p0-ux.browser.js"), "index.html loads the P0.UX browser bundle");
  assert(
    loadedSrcs.indexOf("src/ux/p0-ux.browser.js") < loadedSrcs.indexOf("p0-ux-bind.js"),
    "browser bundle loads before p0-ux-bind.js"
  );
  assert(
    loadedSrcs.indexOf("p0-ux-bind.js") < loadedSrcs.indexOf("app.js"),
    "p0-ux-bind.js loads before app.js so capture owns #export-data"
  );

  assert(!loadedSrcs.includes(RETIRED), "index.html no longer loads native-backup-fix.js");
  assert(!mentionsBasename(html, RETIRED), "index.html does not mention native-backup-fix.js");
  assert(!fs.existsSync(path.join(ROOT, RETIRED)), "native-backup-fix.js is deleted from the repository root");
  const reintroduced = walkFiles(ROOT)
    .map((abs) => path.relative(ROOT, abs).split(path.sep).join("/"))
    .filter((rel) => path.posix.basename(rel) === RETIRED);
  assert(reintroduced.length === 0, "native-backup-fix.js is not reintroduced anywhere in the tree");
  assert(!allowed.has(RETIRED), "runtime-fix-js allowlist dropped native-backup-fix.js only");

  for (const patch of REMAINING_LOADED) {
    assert(loadedSrcs.includes(patch), `${patch} remains loaded by index.html`);
    assert(fs.existsSync(path.join(ROOT, patch)), `${patch} remains on disk`);
    assert(allowed.has(patch), `runtime-fix-js allowlist still lists ${patch}`);
  }
  assertEqual(
    [...allowed].sort(),
    REMAINING_LOADED.slice().sort(),
    "runtime-fix-js allowlist is exactly runtime-fixes.js"
  );

  assert(
    /closest\(["']#export-data["']\)/.test(bindSrc),
    "p0-ux-bind.js capture handler matches #export-data"
  );
  assert(
    bindSrc.includes("stopImmediatePropagation()") && bindSrc.includes("confirmExportWarning()"),
    "bind stops other #export-data listeners and opens the Stage 3 warning"
  );
  assert(bindSrc.includes("exportDocumentJson"), "bind confirm path calls exportDocumentJson");
  assert(bindSrc.includes("writeLocalBackup") && bindSrc.includes("writeLocalExport"), "bind writes via writeLocalBackup");
  assert(
    bindSrc.includes("FitGenNativeBackup") && bindSrc.includes("exportBackup"),
    "Stage 3 writeLocalExport already uses FitGenNativeBackup when present"
  );
  assert(!SHARE_CALL.test(bindSrc), "p0-ux-bind.js does not invoke navigator.share (FR-EXP-001)");
  assert(!SAVE_PICKER.test(bindSrc), "p0-ux-bind.js does not use showSaveFilePicker");
  assert(!OVERLAY_CLONE.test(bindSrc) && !OVERLAY_REPLACE.test(bindSrc), "bind does not clone/replace #export-data");
  assert(
    !LEGACY_V2_BUILDER.test(bindSrc),
    "bind does not port the overlay version:2 builder"
  );
  assert(
    !MIRROR_MEDS.test(bindSrc),
    "bind does not rebuild backups from peptide-calculator-v2-medications mirror keys"
  );

  assert(
    persistExportSrc.includes("Never Web Share") && persistExportSrc.includes("FR-EXP-001"),
    "persist export helper documents FR-EXP-001 local-file-only"
  );
  assert(!SHARE_CALL.test(persistExportSrc), "src/persist/export.ts does not invoke navigator.share");
  assert(!SAVE_PICKER.test(persistExportSrc), "src/persist/export.ts does not use showSaveFilePicker");
  assert(!OVERLAY_CLONE.test(persistExportSrc) && !OVERLAY_REPLACE.test(persistExportSrc), "export.ts does not clone/replace the export button");
  assert(
    !LEGACY_V2_BUILDER.test(persistExportSrc),
    "export.ts does not port the overlay version:2 builder"
  );

  const liveShareHosts = ["p0-ux-bind.js", "src/persist/export.ts", "src/ux/p0-ux.browser.js", ...REMAINING_LOADED];
  for (const rel of liveShareHosts) {
    const body = readText(path.join(ROOT, rel));
    assert(!SHARE_CALL.test(body), `loaded/live ${rel} does not invoke navigator.share`);
  }
  assert(SHARE_CALL.test(readText(path.join(ROOT, "app.js"))), "frozen app.js still contains the unused share fallback");

  const srcHits = walkFiles(path.join(ROOT, "src"), { extensions: new Set([".ts", ".js"]) })
    .map((abs) => ({
      rel: path.relative(ROOT, abs).split(path.sep).join("/"),
      body: fs.readFileSync(abs, "utf8"),
    }))
    .filter((file) => SHARE_CALL.test(file.body));
  assert(
    srcHits.length === 0,
    `src/ has no navigator.share() calls (${srcHits.map((file) => file.rel).join(", ") || "none"})`
  );

  const { ux } = compileUxModules();
  assert(typeof ux.exportDocumentJson === "function", "FitGenP0Ux.exportDocumentJson is the Stage 3 exporter");
  assert(typeof ux.writeLocalBackup === "function", "FitGenP0Ux.writeLocalBackup is the Stage 3 writer");
  assert(typeof ux.chooseLocalExportMode === "function", "FitGenP0Ux.chooseLocalExportMode exists");
  assertEqual(
    ux.chooseLocalExportMode({ exportBackup() {} }),
    "native",
    "chooseLocalExportMode prefers the native local-file bridge"
  );
  assertEqual(ux.chooseLocalExportMode(null), "download", "chooseLocalExportMode downloads when native is absent");

  const sample = ux.buildExportDocument(sampleAppState(), "2026-09-11T23:00:00.000Z");
  assertEqual(sample.schemaVersion, 3, "Stage 3 export document uses schemaVersion 3");
  assert(Array.isArray(sample.occurrences) && sample.occurrences.some((row) => row.id === "occ-6b4"), "v3 export includes occurrences (overlay v2 omitted them)");
  assert(
    !Object.prototype.hasOwnProperty.call(sample, "version") || sample.version !== 2,
    "Stage 3 export is not the overlay version:2 payload"
  );

  let nativeProbeJson = "";
  const nativeMode = ux.writeLocalBackup('{"schemaVersion":3}\n', "fitgen-backup-2026-09-11.json", {
    nativeExport(json, filename) {
      nativeProbeJson = json;
      assertEqual(filename, "fitgen-backup-2026-09-11.json", "native writer receives the Stage 3 filename");
      return { ok: true };
    },
    download() {
      throw new Error("download must not run when native export succeeds");
    },
  });
  assertEqual(nativeMode, "native", "writeLocalBackup returns native when the bridge succeeds");
  assert(/schemaVersion/.test(nativeProbeJson), "native writer receives the Stage 3 JSON text");

  emitBrowserBundle();

  const downloadHarness = createExportHarness({ native: false });
  try {
    loadBind(downloadHarness);
    assert(downloadHarness.window.FitGenP0UxBind, "p0-ux-bind.js installed FitGenP0UxBind (download path)");
  } catch (error) {
    assert(false, `p0-ux-bind.js loaded in download harness (${error && error.message})`);
  }

  const overlayOnDownload = attachSupersededOverlay(downloadHarness);
  const downloadClick = downloadHarness.dispatchDocumentClick(downloadHarness.elementsById.get("export-data"));
  assert(downloadClick.defaultPrevented, "bind preventDefault on #export-data click");
  assert(downloadClick.immediateStopped, "bind stopImmediatePropagation so a later overlay cannot steal the click");
  assertEqual(overlayOnDownload.overlayFireCount(), 0, "superseded overlay button listener does not run after bind capture");
  const downloadDialog = downloadHarness.elementsById.get("fitgen-confirm-dialog");
  assert(!downloadDialog.classList.contains("is-hidden"), "Stage 3 export warning dialog is shown without native bridge");
  assertEqual(downloadHarness.shareCallCount(), 0, "clicking #export-data does not call navigator.share");
  assertEqual(downloadHarness.downloaded.length, 0, "warning dialog does not download until confirm");
  assertEqual(downloadHarness.nativeCalls.length, 0, "warning dialog does not call the native bridge until confirm");

  downloadHarness.elementsById.get("fitgen-confirm-primary").click();
  assertEqual(downloadHarness.shareCallCount(), 0, "confirming export does not call navigator.share");
  assertEqual(downloadHarness.nativeCalls.length, 0, "download path does not invent a native bridge call");
  assert(downloadHarness.downloaded.length === 1, "confirm writes one local JSON download when native is absent");
  const saved = downloadHarness.downloaded[0] || { href: "", filename: "" };
  assert(/^fitgen-backup-\d{4}-\d{2}-\d{2}\.json$/.test(saved.filename), "download filename is fitgen-backup-YYYY-MM-DD.json");
  const downloadJson = downloadHarness.blobs.get(saved.href) || downloadHarness.lastBlobText();
  const downloadParsed = JSON.parse(downloadJson);
  assertEqual(downloadParsed.schemaVersion, 3, "runtime download payload is schemaVersion 3");
  assert(
    Array.isArray(downloadParsed.occurrences) && downloadParsed.occurrences.some((row) => row.id === "occ-6b4"),
    "runtime download includes occurrences (not overlay mirror-only v2)"
  );
  assert(
    /Plaintext JSON backup saved/.test(downloadHarness.elementsById.get("backup-status").textContent),
    "backup status reports local plaintext save on the download path"
  );

  const nativeHarness = createExportHarness({ native: true });
  try {
    loadBind(nativeHarness);
    assert(nativeHarness.window.FitGenP0UxBind, "p0-ux-bind.js installed FitGenP0UxBind (native path)");
  } catch (error) {
    assert(false, `p0-ux-bind.js loaded in native harness (${error && error.message})`);
  }

  const overlayOnNative = attachSupersededOverlay(nativeHarness);
  const nativeClick = nativeHarness.dispatchDocumentClick(nativeHarness.elementsById.get("export-data"));
  assert(nativeClick.defaultPrevented, "bind preventDefault even when FitGenNativeBackup is present");
  assert(nativeClick.immediateStopped, "bind capture still wins when a native bridge exists");
  assertEqual(overlayOnNative.overlayFireCount(), 0, "overlay cannot steal the native click from bind");
  assertEqual(nativeHarness.nativeCalls.length, 0, "native bridge is not called until the Stage 3 warning is confirmed");
  assert(!nativeHarness.elementsById.get("fitgen-confirm-dialog").classList.contains("is-hidden"), "Stage 3 warning still opens on the native path");
  assert(/plaintext/i.test(nativeHarness.elementsById.get("fitgen-confirm-title").textContent), "native-path warning title names plaintext");
  assert(
    /plaintext/i.test(nativeHarness.elementsById.get("fitgen-confirm-body").innerHTML) &&
      /network/i.test(nativeHarness.elementsById.get("fitgen-confirm-body").innerHTML),
    "native-path warning body keeps FR-EXP-001 copy"
  );

  nativeHarness.elementsById.get("fitgen-confirm-primary").click();
  assertEqual(nativeHarness.shareCallCount(), 0, "native confirm does not call navigator.share");
  assertEqual(nativeHarness.downloaded.length, 0, "successful native export does not also download");
  assert(nativeHarness.nativeCalls.length === 1, "confirm calls FitGenNativeBackup.exportBackup once");
  const nativeCall = nativeHarness.nativeCalls[0] || { json: "", filename: "" };
  assert(/^fitgen-backup-\d{4}-\d{2}-\d{2}\.json$/.test(nativeCall.filename), "native filename is fitgen-backup-YYYY-MM-DD.json");
  const nativeParsed = JSON.parse(nativeCall.json);
  assertEqual(nativeParsed.schemaVersion, 3, "native bridge receives schemaVersion 3, not overlay version:2");
  assert(
    !Object.prototype.hasOwnProperty.call(nativeParsed, "version") || nativeParsed.version !== 2,
    "native payload is not the overlay version:2 object"
  );
  assert(
    nativeParsed.fills.some((row) => row.savedId === "fill-6b4"),
    "native payload includes the persisted fill"
  );
  assert(
    Array.isArray(nativeParsed.occurrences) && nativeParsed.occurrences.some((row) => row.id === "occ-6b4"),
    "native payload includes occurrences (overlay v2 omitted them)"
  );
  assert(
    /Plaintext JSON backup saved/.test(nativeHarness.elementsById.get("backup-status").textContent),
    "backup status reports local plaintext save on the native path"
  );

  assert(sha256File("app.js") === FROZEN_APP, "app.js SHA-256 unchanged (no formula-builder edits)");
  assert(
    sha256File("scripts/calc/fixtures/legacy-evidence-goldens.json") === FROZEN_GOLDENS,
    "calc goldens SHA-256 unchanged vs Stage 5/6a freeze"
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    process.exit(1);
  }
}

main();
