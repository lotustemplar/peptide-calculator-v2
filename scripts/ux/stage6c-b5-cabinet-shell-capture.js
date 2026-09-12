#!/usr/bin/env node
"use strict";

/**
 * Stage 6c-B5 helper (not part of npm test / npm run ci).
 * Capture desktop + narrow-mobile Cabinet shell evidence for RF-B-010.
 * Synthetic Demo Vial A / Demo Vial B only — no real PHI.
 *
 *   node scripts/ux/stage6c-b5-cabinet-shell-capture.js --shots before
 *   node scripts/ux/stage6c-b5-cabinet-shell-capture.js --shots after
 */

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { repoRoot } = require("../ci/lib");
const { assertPngHasVisibleContent } = require("../ci/png-evidence");

const PORT = Number(process.env.FITGEN_STAGE6CB5_PORT || 4185);
const CDP_PORT = Number(process.env.FITGEN_STAGE6CB5_CDP_PORT || 9235);
const CHROME = process.env.CHROME_PATH || "/usr/local/bin/google-chrome";
const ROOT = repoRoot();
const OUT_DIR = path.join(ROOT, "docs/evidence/stage-6c-b5-cabinet-shell");

function httpJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve);
      this.ws.addEventListener("error", reject);
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          reject(new Error(message.error.message || "CDP error"));
        } else {
          resolve(message.result);
        }
      }
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = (this.id += 1);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || "evaluate failed");
    }
    return result.result.value;
  }

  close() {
    this.ws.close();
  }
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitFor(cdp, expression, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await cdp.evaluate(expression);
    if (value) {
      return value;
    }
    await wait(100);
  }
  throw new Error(`timed out waiting for ${expression}`);
}

function startStaticServer() {
  const server = http.createServer((req, res) => {
    const raw = req.url || "/";
    const urlPath = decodeURIComponent(raw.split("?")[0]);
    const rel = urlPath === "/" ? "/index.html" : urlPath;
    const abs = path.normalize(path.join(ROOT, rel));
    if (!abs.startsWith(ROOT)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(abs, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      const ext = path.extname(abs).toLowerCase();
      const types = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".webmanifest": "application/manifest+json",
        ".json": "application/json",
      };
      res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

async function launchChrome() {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "fitgen-stage6cb5-"));
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      `--user-data-dir=${userData}`,
      `--remote-debugging-port=${CDP_PORT}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let version;
  for (let i = 0; i < 40; i += 1) {
    try {
      version = await httpJson(`http://127.0.0.1:${CDP_PORT}/json/version`);
      break;
    } catch {
      await wait(150);
    }
  }
  if (!version) {
    chrome.kill();
    throw new Error("Chrome DevTools did not start");
  }

  const targets = await httpJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const page = targets.find((item) => item.type === "page") || targets[0];
  const cdp = new Cdp(page.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  return { chrome, cdp, userData };
}

function seedSyntheticExpression() {
  return `(() => {
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    const fillA = {
      savedId: "syn-stage6cb5-fill-a",
      name: "Demo Vial A",
      vialAmount: 30,
      waterMl: 2,
      unitLabel: "mg",
      recommendedDoseAmount: 3,
      concentrationPerMl: 15,
      depletionRemaining: 30,
      depletionUnit: "mg",
      lifecycle: "active",
      savedAt: now.toISOString(),
    };
    const fillB = {
      savedId: "syn-stage6cb5-fill-b",
      name: "Demo Vial B",
      vialAmount: 20,
      waterMl: 2,
      unitLabel: "mg",
      recommendedDoseAmount: 2,
      concentrationPerMl: 10,
      depletionRemaining: 20,
      depletionUnit: "mg",
      lifecycle: "active",
      savedAt: new Date(now.getTime() - 3600000).toISOString(),
    };
    const schedule = {
      id: "syn-stage6cb5-sched",
      fillSavedId: "syn-stage6cb5-fill-a",
      doseAmount: 3,
      doseMl: 0.2,
      unitLabel: "mg",
      intervalDays: 7,
      reminderTime: "09:00",
      startDate: today,
      takenDates: [],
      lifecycle: "active",
      fillSnapshot: fillA,
    };
    const envelope = {
      version: 1,
      fills: [fillA, fillB],
      schedules: [schedule],
      occurrences: [],
      medications: [],
    };
    localStorage.setItem("peptide-calculator-v2-p0ux-store", JSON.stringify(envelope));
    localStorage.setItem("peptide-calculator-v2-fills", JSON.stringify(envelope.fills));
    localStorage.setItem("peptide-calculator-v2-schedules", JSON.stringify(envelope.schedules));
    localStorage.setItem("peptide-calculator-v2-occurrences", "[]");
    localStorage.setItem("peptide-calculator-v2-medications", "[]");
    localStorage.setItem("peptide-calculator-v2-selected-fill", JSON.stringify(fillA.savedId));
    localStorage.setItem("peptide-calculator-v2-expanded-fill", JSON.stringify(fillA.savedId));
    localStorage.setItem("peptide-calculator-v2-active-view", JSON.stringify("cabinet-view"));
    return today;
  })()`;
}

async function resetViewport(cdp, view) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: view.width,
    height: view.height,
    deviceScaleFactor: view.dsf,
    mobile: view.mobile,
  });
}

async function screenshotViewport(cdp, filePath, selectors) {
  if (selectors && selectors.length) {
    const found = await cdp.evaluate(`(() => {
      const selectors = ${JSON.stringify(selectors)};
      const el = selectors.map((selector) => document.querySelector(selector)).find(Boolean);
      if (!el) {
        return null;
      }
      el.scrollIntoView({ block: "start", inline: "nearest" });
      const rect = el.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        text: String(el.innerText || "").replace(/\\s+/g, " ").slice(0, 140),
      };
    })()`);
    if (!found || found.width < 40) {
      throw new Error(`screenshot target not visible for ${filePath}: ${JSON.stringify(found)}`);
    }
  }
  await wait(250);
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const buffer = Buffer.from(data, "base64");
  if (buffer.length < 1000) {
    throw new Error(`screenshot too small for ${filePath}: ${buffer.length} bytes`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
  const stats = assertPngHasVisibleContent(filePath);
  return { bytes: buffer.length, ...stats };
}

async function showCabinet(cdp) {
  await cdp.evaluate(`(() => {
    const tab = document.querySelector('[data-view-target="cabinet-view"]');
    if (tab) {
      tab.click();
    } else if (typeof window.setActiveView === "function") {
      window.setActiveView("cabinet-view");
    }
    return true;
  })()`);
  await waitFor(cdp, `document.getElementById("cabinet-view").classList.contains("is-active")`);
  await wait(200);
}

async function loadEmptyCabinet(cdp, view) {
  await resetViewport(cdp, view);
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` });
  await waitFor(cdp, "Boolean(document.querySelector('.tabbar') && document.getElementById('current-peptides'))");
  await cdp.evaluate("localStorage.clear()");
  await cdp.send("Page.reload", { ignoreCache: true });
  await waitFor(
    cdp,
    "Boolean(document.querySelector('.tabbar') && window.FitGenRuntimeBridge && document.getElementById('current-peptides'))"
  );
  await wait(300);
  await showCabinet(cdp);
}

async function loadSeededCabinet(cdp, view) {
  await resetViewport(cdp, view);
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` });
  await waitFor(cdp, "Boolean(document.querySelector('.tabbar') && document.getElementById('cabinet-card'))");
  await cdp.evaluate("localStorage.clear()");
  await cdp.evaluate(seedSyntheticExpression());
  await cdp.send("Page.reload", { ignoreCache: true });
  await waitFor(
    cdp,
    "Boolean(window.FitGenP0Ux && window.FitGenP0UxBind && document.getElementById('current-peptides'))"
  );
  await wait(400);
  await showCabinet(cdp);
}

async function readCabinetState(cdp) {
  return cdp.evaluate(`(() => {
    const container = document.getElementById("current-peptides");
    const cards = Array.from(container ? container.querySelectorAll(".cabinet-card") : []);
    const toggles = Array.from(container ? container.querySelectorAll(".fill-toggle") : []);
    const panels = Array.from(container ? container.querySelectorAll(".peptide-fill-list") : []);
    const editHosts = Array.from(container ? container.querySelectorAll('[data-action="edit-fill"]') : []);
    const renameHosts = Array.from(container ? container.querySelectorAll('[data-action="rename-fill"]') : []);
    const deleteHosts = Array.from(container ? container.querySelectorAll('[data-action="delete-fill"]') : []);
    const fallbackActions = Array.from(container ? container.querySelectorAll(".cabinet-actions-fallback") : []);
    const focused = document.activeElement;
    const focusAction = focused && focused.getAttribute ? focused.getAttribute("data-action") : null;
    return {
      htmlHasFillToggle: Boolean(container && container.querySelector(".fill-toggle")),
      htmlHasFallbackActions: fallbackActions.length > 0,
      emptyText: container ? String(container.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 160) : "",
      names: Array.from(container ? container.querySelectorAll(".fill-toggle, h3") : [])
        .map((node) => String(node.textContent || "").replace(/[▾▸]/g, "").trim())
        .filter(Boolean)
        .slice(0, 4),
      cards: cards.map((card) => {
        const toggle = card.querySelector(".fill-toggle");
        const caret = toggle && toggle.querySelector(".caret");
        const panel = card.querySelector(".peptide-fill-list");
        return {
          collapsed: card.classList.contains("is-collapsed"),
          hasToggle: Boolean(toggle),
          toggleAriaExpanded: toggle ? toggle.getAttribute("aria-expanded") : null,
          toggleAriaControls: toggle ? toggle.getAttribute("aria-controls") : null,
          caret: caret ? String(caret.textContent || "") : "",
          panelCollapsed: Boolean(panel && panel.classList.contains("is-collapsed")),
          usageDisplay: (() => {
            const usage = card.querySelector(".usage-grid");
            return usage ? getComputedStyle(usage).display : null;
          })(),
        };
      }),
      toggleCount: toggles.length,
      panelCount: panels.length,
      editCount: editHosts.length,
      renameCount: renameHosts.length,
      deleteCount: deleteHosts.length,
      fallbackActionCount: fallbackActions.length,
      ownerPresent: typeof window.renderCurrentPeptides === "function",
      focus: {
        tag: focused ? focused.tagName : null,
        action: focusAction,
        className: focused ? String(focused.className || "") : "",
        text: focused ? String(focused.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 80) : "",
      },
    };
  })()`);
}

async function collapseAccordion(cdp) {
  await cdp.evaluate(`(() => {
    if (typeof window.renderCurrentPeptides === "function") {
      window.renderCurrentPeptides();
    }
    const container = document.getElementById("current-peptides");
    const ux = window.FitGenP0Ux;
    if (container && ux && typeof ux.collapseCabinetAtStartup === "function") {
      ux.collapseCabinetAtStartup(container, { collapsedOnce: false });
    }
    if (window.FitGenP0UxBind && typeof window.FitGenP0UxBind.refreshCabinetPolish === "function") {
      window.FitGenP0UxBind.refreshCabinetPolish();
    }
    return true;
  })()`);
  await wait(250);
  return readCabinetState(cdp);
}

async function expandFirstFill(cdp) {
  await cdp.evaluate(`(() => {
    const toggle = document.querySelector("#current-peptides .fill-toggle");
    if (toggle) {
      toggle.click();
    }
    if (window.FitGenP0UxBind && typeof window.FitGenP0UxBind.refreshCabinetPolish === "function") {
      window.FitGenP0UxBind.refreshCabinetPolish();
    }
    return true;
  })()`);
  await wait(250);
  return readCabinetState(cdp);
}

async function focusSelector(cdp, selector) {
  const focused = await cdp.evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node || typeof node.focus !== "function") {
      return { ok: false, selector: ${JSON.stringify(selector)} };
    }
    node.focus();
    return {
      ok: document.activeElement === node,
      action: node.getAttribute("data-action"),
      text: String(node.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 80),
    };
  })()`);
  if (!focused.ok) {
    throw new Error(`could not focus ${selector}: ${JSON.stringify(focused)}`);
  }
  await wait(120);
  return focused;
}

async function captureShots(cdp, label) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const views = [
    { name: "mobile", width: 390, height: 844, dsf: 2, mobile: true },
    { name: "desktop", width: 1280, height: 800, dsf: 1, mobile: false },
  ];
  const record = {
    label,
    capturedAt: new Date().toISOString(),
    privacy: "synthetic Demo Vial A / Demo Vial B only",
    viewports: [],
  };

  for (const view of views) {
    const row = { viewport: view.name, shots: {} };

    await loadEmptyCabinet(cdp, view);
    const emptyState = await readCabinetState(cdp);
    const emptyName = `${label}-${view.name}-empty.png`;
    const emptyShot = await screenshotViewport(cdp, path.join(OUT_DIR, emptyName), ["#cabinet-card", "#current-peptides"]);
    row.shots.empty = { file: emptyName, pixels: `${emptyShot.width}x${emptyShot.height}`, state: emptyState };
    console.log(`wrote ${emptyName} (${emptyShot.width}x${emptyShot.height} ${emptyShot.bytes} bytes)`);

    await loadSeededCabinet(cdp, view);
    const populatedState = await readCabinetState(cdp);
    const populatedName = `${label}-${view.name}-populated.png`;
    const populatedShot = await screenshotViewport(cdp, path.join(OUT_DIR, populatedName), ["#cabinet-card", "#current-peptides"]);
    row.shots.populated = {
      file: populatedName,
      pixels: `${populatedShot.width}x${populatedShot.height}`,
      state: populatedState,
    };
    console.log(`wrote ${populatedName} (${populatedShot.width}x${populatedShot.height} ${populatedShot.bytes} bytes)`);

    if (label === "before") {
      const actionName = `${label}-${view.name}-actions.png`;
      const actionShot = await screenshotViewport(cdp, path.join(OUT_DIR, actionName), [
        ".cabinet-actions-fallback",
        "#current-peptides .cabinet-card",
      ]);
      row.shots.actions = {
        file: actionName,
        pixels: `${actionShot.width}x${actionShot.height}`,
        state: populatedState,
      };
      console.log(`wrote ${actionName} (${actionShot.width}x${actionShot.height} ${actionShot.bytes} bytes)`);
    } else {
      const collapsed = await collapseAccordion(cdp);
      if (!collapsed.htmlHasFillToggle) {
        throw new Error(`after collapsed missing .fill-toggle: ${JSON.stringify(collapsed)}`);
      }
      const collapsedName = `${label}-${view.name}-collapsed.png`;
      const collapsedShot = await screenshotViewport(cdp, path.join(OUT_DIR, collapsedName), ["#cabinet-card"]);
      row.shots.collapsed = {
        file: collapsedName,
        pixels: `${collapsedShot.width}x${collapsedShot.height}`,
        state: collapsed,
      };
      console.log(`wrote ${collapsedName} (${collapsedShot.width}x${collapsedShot.height} ${collapsedShot.bytes} bytes)`);

      const expanded = await expandFirstFill(cdp);
      const expandedName = `${label}-${view.name}-expanded.png`;
      const expandedShot = await screenshotViewport(cdp, path.join(OUT_DIR, expandedName), ["#cabinet-card"]);
      row.shots.expanded = {
        file: expandedName,
        pixels: `${expandedShot.width}x${expandedShot.height}`,
        state: expanded,
      };
      console.log(`wrote ${expandedName} (${expandedShot.width}x${expandedShot.height} ${expandedShot.bytes} bytes)`);

      const actionName = `${label}-${view.name}-actions.png`;
      const actionShot = await screenshotViewport(cdp, path.join(OUT_DIR, actionName), [
        "#current-peptides .card-actions",
        "#current-peptides .cabinet-card",
      ]);
      row.shots.actions = { file: actionName, pixels: `${actionShot.width}x${actionShot.height}`, state: expanded };
      console.log(`wrote ${actionName} (${actionShot.width}x${actionShot.height} ${actionShot.bytes} bytes)`);

      const toggleFocus = await focusSelector(cdp, "#current-peptides .fill-toggle");
      const toggleFocusName = `${label}-${view.name}-focus-toggle.png`;
      const toggleFocusShot = await screenshotViewport(cdp, path.join(OUT_DIR, toggleFocusName), ["#cabinet-card"]);
      row.shots.focusToggle = {
        file: toggleFocusName,
        pixels: `${toggleFocusShot.width}x${toggleFocusShot.height}`,
        focus: toggleFocus,
      };
      console.log(`wrote ${toggleFocusName} (${toggleFocusShot.width}x${toggleFocusShot.height} ${toggleFocusShot.bytes} bytes)`);

      const deleteFocus = await focusSelector(cdp, '#current-peptides [data-action="delete-fill"]');
      const deleteFocusName = `${label}-${view.name}-focus-delete.png`;
      const deleteFocusShot = await screenshotViewport(cdp, path.join(OUT_DIR, deleteFocusName), ["#cabinet-card"]);
      row.shots.focusDelete = {
        file: deleteFocusName,
        pixels: `${deleteFocusShot.width}x${deleteFocusShot.height}`,
        focus: deleteFocus,
      };
      console.log(`wrote ${deleteFocusName} (${deleteFocusShot.width}x${deleteFocusShot.height} ${deleteFocusShot.bytes} bytes)`);
    }

    record.viewports.push(row);
  }

  const stateFile = label === "after" ? "cabinet-state.json" : "cabinet-state-before.json";
  fs.writeFileSync(path.join(OUT_DIR, stateFile), `${JSON.stringify(record, null, 2)}\n`);
  console.log(`wrote ${stateFile}`);
}

async function main() {
  const shotIdx = process.argv.indexOf("--shots");
  const shotLabel = shotIdx >= 0 ? process.argv[shotIdx + 1] : null;
  if (shotLabel !== "before" && shotLabel !== "after") {
    throw new Error("usage: node scripts/ux/stage6c-b5-cabinet-shell-capture.js --shots before|after");
  }

  const server = await startStaticServer();
  const { chrome, cdp } = await launchChrome();
  try {
    await captureShots(cdp, shotLabel);
  } finally {
    cdp.close();
    chrome.kill();
    server.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
