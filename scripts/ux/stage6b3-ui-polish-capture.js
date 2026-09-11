#!/usr/bin/env node
"use strict";

/**
 * Stage 6b.3 helper (not part of npm test / npm run ci).
 * Capture desktop + narrow-mobile evidence for absorbed accordion, authored
 * cabinet card order, duplicate Due Today suppression, and restored
 * selected-fill / notification chrome.
 * Synthetic names only — no real PHI.
 *
 *   node scripts/ux/stage6b3-ui-polish-capture.js --shots after
 *
 * After-state only: ui-polish-fix.js is already retired on this branch, so a
 * practical before overlay capture is not available.
 */

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { repoRoot } = require("../ci/lib");

const PORT = Number(process.env.FITGEN_STAGE6B3_PORT || 4178);
const CDP_PORT = Number(process.env.FITGEN_STAGE6B3_CDP_PORT || 9228);
const CHROME = process.env.CHROME_PATH || "/usr/local/bin/google-chrome";
const ROOT = repoRoot();
const OUT_DIR = path.join(ROOT, "docs/evidence/stage-6b3-ui-polish");

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
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "fitgen-stage6b3-"));
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
      savedId: "syn-stage6b3-fill-a",
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
      savedId: "syn-stage6b3-fill-b",
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
      id: "syn-stage6b3-sched",
      fillSavedId: "syn-stage6b3-fill-a",
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
    const med = {
      id: "syn-stage6b3-med-a",
      name: "Demo Vial A",
    };
    const envelope = {
      version: 1,
      fills: [fillA, fillB],
      schedules: [schedule],
      occurrences: [],
      medications: [med],
    };
    localStorage.setItem("peptide-calculator-v2-p0ux-store", JSON.stringify(envelope));
    localStorage.setItem("peptide-calculator-v2-fills", JSON.stringify(envelope.fills));
    localStorage.setItem("peptide-calculator-v2-schedules", JSON.stringify(envelope.schedules));
    localStorage.setItem("peptide-calculator-v2-occurrences", "[]");
    localStorage.setItem("peptide-calculator-v2-medications", JSON.stringify(envelope.medications));
    localStorage.setItem("peptide-calculator-v2-selected-fill", JSON.stringify(fillA.savedId));
    localStorage.setItem("peptide-calculator-v2-expanded-fill", JSON.stringify(fillA.savedId));
    localStorage.setItem("peptide-calculator-v2-active-view", JSON.stringify("cabinet-view"));
    return today;
  })()`;
}

async function showView(cdp, viewId) {
  await cdp.evaluate(`(() => {
    const tab = document.querySelector('[data-view-target="${viewId}"]');
    if (tab) {
      tab.click();
    } else if (typeof window.setActiveView === "function") {
      window.setActiveView("${viewId}");
    }
    document.querySelectorAll(".app-view").forEach((view) => {
      view.classList.toggle("is-active", view.id === "${viewId}");
    });
    document.querySelectorAll("[data-view-target]").forEach((tabButton) => {
      tabButton.classList.toggle("is-active", tabButton.getAttribute("data-view-target") === "${viewId}");
    });
    return true;
  })()`);
  await waitFor(cdp, `document.getElementById("${viewId}").classList.contains("is-active")`);
  await wait(200);
}

async function restoreAppCabinetAccordion(cdp) {
  const result = await cdp.evaluate(`(() => {
    if (typeof window.renderCurrentPeptides === "function") {
      window.renderCurrentPeptides();
    }
    const container = document.getElementById("current-peptides");
    const ux = window.FitGenP0Ux;
    if (container && ux && typeof ux.collapseCabinetAtStartup === "function") {
      ux.collapseCabinetAtStartup(container, { collapsedOnce: false });
      if (typeof ux.applyCabinetAccordionLayout === "function") {
        ux.applyCabinetAccordionLayout(container);
      }
    }
    const card = document.querySelector("#current-peptides .cabinet-card");
    const toggle = document.querySelector("#current-peptides .fill-toggle");
    const caret = toggle && toggle.querySelector(".caret");
    const usage = document.querySelector("#current-peptides .usage-grid");
    return {
      hasToggle: Boolean(toggle),
      collapsed: Boolean(card && card.classList.contains("is-collapsed")),
      caret: caret ? String(caret.textContent || "") : "",
      usageHidden: !usage || getComputedStyle(usage).display === "none",
      names: Array.from(document.querySelectorAll("#current-peptides .fill-toggle, #current-peptides h3"))
        .map((node) => String(node.textContent || "").replace(/[▾▸]/g, "").trim())
        .filter(Boolean)
        .slice(0, 4),
    };
  })()`);
  if (!result || !result.hasToggle) {
    throw new Error(`cabinet accordion markup missing after restore: ${JSON.stringify(result)}`);
  }
  return result;
}

async function expandFirstCabinetFill(cdp) {
  await cdp.evaluate(`(() => {
    const toggle = document.querySelector("#current-peptides .fill-toggle");
    if (toggle) {
      toggle.click();
    }
    if (window.FitGenP0Ux && typeof window.FitGenP0Ux.applyCabinetAccordionLayout === "function") {
      window.FitGenP0Ux.applyCabinetAccordionLayout(document.getElementById("current-peptides"));
    }
    if (window.FitGenP0UxBind && typeof window.FitGenP0UxBind.refreshCabinetPolish === "function") {
      window.FitGenP0UxBind.refreshCabinetPolish();
    }
    return true;
  })()`);
  await wait(250);
  return cdp.evaluate(`(() => {
    const card = document.querySelector("#current-peptides .cabinet-card");
    const caret = document.querySelector("#current-peptides .fill-toggle .caret");
    const usage = document.querySelector("#current-peptides .usage-grid");
    const vial = document.querySelector("#current-peptides .vial-row");
    return {
      collapsed: Boolean(card && card.classList.contains("is-collapsed")),
      caret: caret ? String(caret.textContent || "") : "",
      usageVisible: Boolean(usage && getComputedStyle(usage).display !== "none" && usage.getBoundingClientRect().height > 8),
      vialVisible: Boolean(vial && getComputedStyle(vial).display !== "none" && vial.getBoundingClientRect().height > 8),
    };
  })()`);
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
    captureBeyondViewport: true,
  });
  const buffer = Buffer.from(data, "base64");
  if (buffer.length < 1000) {
    throw new Error(`screenshot too small for ${filePath}: ${buffer.length} bytes`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
  return buffer.length;
}

async function resetViewport(cdp, view) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: view.width,
    height: view.height,
    deviceScaleFactor: view.dsf,
    mobile: view.mobile,
  });
}

async function loadSeededApp(cdp, view) {
  await resetViewport(cdp, view);
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` });
  await waitFor(cdp, "Boolean(document.querySelector('.tabbar') && document.getElementById('cabinet-card'))");
  await cdp.evaluate("localStorage.clear()");
  await cdp.evaluate(seedSyntheticExpression());
  await cdp.send("Page.reload", { ignoreCache: true });
  await waitFor(cdp, "Boolean(window.FitGenP0Ux && window.FitGenP0UxBind && document.getElementById('current-peptides'))");
  await wait(400);
}

async function assertCabinetOrder(cdp) {
  const order = await cdp.evaluate(`(() => {
    const backup = document.getElementById("backup-card");
    const meds = document.getElementById("medications-card");
    const cabinet = document.getElementById("cabinet-card");
    if (!backup || !meds || !cabinet) {
      return { ok: false, reason: "missing card" };
    }
    const backupShown = getComputedStyle(backup).display !== "none" && backup.getBoundingClientRect().height > 40;
    const medsShown = getComputedStyle(meds).display !== "none" && !meds.hasAttribute("hidden") && meds.getBoundingClientRect().height > 40;
    const cabinetShown = getComputedStyle(cabinet).display !== "none" && cabinet.getBoundingClientRect().height > 40;
    const tops = [backup.offsetTop, meds.offsetTop, cabinet.offsetTop];
    return {
      ok: backupShown && medsShown && cabinetShown && tops[0] < tops[1] && tops[1] < tops[2],
      backupShown,
      medsShown,
      cabinetShown,
      tops,
      medsText: String(meds.innerText || "").replace(/\\s+/g, " ").slice(0, 140),
    };
  })()`);
  if (!order.ok) {
    throw new Error(`authored cabinet order not visible: ${JSON.stringify(order)}`);
  }
  return order;
}

async function assertSchedulePolish(cdp) {
  const state = await cdp.evaluate(`(() => {
    const list = document.getElementById("reminder-list");
    const banner = list && list.querySelector(".today-schedule-banner");
    const row = list && list.querySelector("article.list-card, .list-card");
    const markTaken = list && list.querySelector('[data-action="mark-taken"]');
    const text = list ? String(list.innerText || "") : "";
    const bannerInList = Boolean(banner && list.contains(banner) && getComputedStyle(banner).display !== "none");
    return {
      hasBanner: bannerInList,
      hasRow: Boolean(row && getComputedStyle(row).display !== "none"),
      hasMarkTaken: Boolean(markTaken),
      hasDemoName: /Demo Vial A/.test(text),
      bannerCount: list ? list.querySelectorAll(".today-schedule-banner").length : 0,
      text: text.replace(/\\s+/g, " ").slice(0, 180),
    };
  })()`);
  if (state.hasBanner) {
    throw new Error(`duplicate Due Today banner still visible: ${JSON.stringify(state)}`);
  }
  if (!state.hasRow || !state.hasDemoName) {
    throw new Error(`schedule row missing after banner removal: ${JSON.stringify(state)}`);
  }
  return state;
}

async function assertSelectedFill(cdp) {
  const state = await cdp.evaluate(`(() => {
    const card = document.getElementById("selected-fill");
    if (!card) {
      return { ok: false, reason: "missing" };
    }
    const style = getComputedStyle(card);
    const rect = card.getBoundingClientRect();
    return {
      ok: style.display !== "none" && style.visibility !== "hidden" && rect.width > 80 && rect.height > 20,
      text: String(card.innerText || "").replace(/\\s+/g, " ").slice(0, 160),
    };
  })()`);
  if (!state.ok) {
    throw new Error(`selected-fill chrome not visible: ${JSON.stringify(state)}`);
  }
  return state;
}

async function assertNotifSetup(cdp) {
  const state = await cdp.evaluate(`(() => {
    const card = document.getElementById("notif-setup-card");
    const button = document.getElementById("enable-notifications");
    if (!card) {
      return { ok: false, reason: "missing" };
    }
    const style = getComputedStyle(card);
    const rect = card.getBoundingClientRect();
    return {
      ok: style.display !== "none" && style.visibility !== "hidden" && rect.width > 80 && rect.height > 40 && Boolean(button),
      text: String(card.innerText || "").replace(/\\s+/g, " ").slice(0, 160),
    };
  })()`);
  if (!state.ok) {
    throw new Error(`notification chrome not visible: ${JSON.stringify(state)}`);
  }
  return state;
}

async function captureShots(cdp, label) {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const views = [
    { name: `${label}-mobile`, width: 390, height: 1600, dsf: 2, mobile: true },
    { name: `${label}-desktop`, width: 1280, height: 1400, dsf: 1, mobile: false },
  ];

  for (const view of views) {
    await loadSeededApp(cdp, view);
    await showView(cdp, "cabinet-view");
    const order = await assertCabinetOrder(cdp);
    const orderBytes = await screenshotViewport(
      cdp,
      path.join(OUT_DIR, `${view.name}-cabinet-order.png`),
      ["#backup-card"]
    );
    console.log(`wrote ${view.name}-cabinet-order.png (${orderBytes} bytes) ${JSON.stringify(order.medsText)}`);

    const collapsed = await restoreAppCabinetAccordion(cdp);
    if (!collapsed.collapsed || !collapsed.usageHidden) {
      throw new Error(`intended collapsed accordion not applied: ${JSON.stringify(collapsed)}`);
    }
    const collapsedBytes = await screenshotViewport(
      cdp,
      path.join(OUT_DIR, `${view.name}-cabinet-collapsed.png`),
      ["#cabinet-card"]
    );
    console.log(`wrote ${view.name}-cabinet-collapsed.png (${collapsedBytes} bytes) ${JSON.stringify(collapsed.names)}`);

    const expanded = await expandFirstCabinetFill(cdp);
    if (expanded.collapsed || !expanded.usageVisible) {
      throw new Error(`expanded cabinet rows not visible: ${JSON.stringify(expanded)}`);
    }
    const expandedBytes = await screenshotViewport(
      cdp,
      path.join(OUT_DIR, `${view.name}-cabinet-expanded.png`),
      ["#cabinet-card"]
    );
    console.log(`wrote ${view.name}-cabinet-expanded.png (${expandedBytes} bytes) ${JSON.stringify(expanded)}`);

    await showView(cdp, "schedule-view");
    await wait(250);
    const schedule = await assertSchedulePolish(cdp);
    const scheduleBytes = await screenshotViewport(
      cdp,
      path.join(OUT_DIR, `${view.name}-schedule.png`),
      ["#reminder-list"]
    );
    console.log(`wrote ${view.name}-schedule.png (${scheduleBytes} bytes) ${JSON.stringify(schedule.text)}`);

    const notif = await assertNotifSetup(cdp);
    const notifBytes = await screenshotViewport(
      cdp,
      path.join(OUT_DIR, `${view.name}-notif-setup.png`),
      ["#notif-setup-card"]
    );
    console.log(`wrote ${view.name}-notif-setup.png (${notifBytes} bytes) ${JSON.stringify(notif.text)}`);

    await showView(cdp, "calculator-view");
    const selected = await assertSelectedFill(cdp);
    const selectedBytes = await screenshotViewport(
      cdp,
      path.join(OUT_DIR, `${view.name}-selected-fill.png`),
      ["#selected-fill"]
    );
    console.log(`wrote ${view.name}-selected-fill.png (${selectedBytes} bytes) ${JSON.stringify(selected.text)}`);
  }
}

async function main() {
  const shotIdx = process.argv.indexOf("--shots");
  const shotLabel = shotIdx >= 0 ? process.argv[shotIdx + 1] : null;
  if (shotLabel !== "after") {
    throw new Error("usage: node scripts/ux/stage6b3-ui-polish-capture.js --shots after");
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
