#!/usr/bin/env node
"use strict";

/**
 * Stage 4 helper (not part of npm test / npm run ci).
 * Capture desktop + narrow-mobile chrome evidence: shell/nav, dirty Cancel, Taken/Undo.
 * Synthetic names only — no real PHI.
 *
 *   node scripts/ux/stage4-shell-capture.js --shots before
 *   node scripts/ux/stage4-shell-capture.js --shots after
 */

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { repoRoot } = require("../ci/lib");

const PORT = Number(process.env.FITGEN_STAGE4_PORT || 4176);
const CDP_PORT = Number(process.env.FITGEN_STAGE4_CDP_PORT || 9226);
const CHROME = process.env.CHROME_PATH || "/usr/local/bin/google-chrome";
const ROOT = repoRoot();
const OUT_DIR = path.join(ROOT, "docs/evidence/stage-4-shell");

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

  async screenshot(filePath) {
    const { data } = await this.send("Page.captureScreenshot", { format: "png", fromSurface: true });
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, Buffer.from(data, "base64"));
    return filePath;
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
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "fitgen-stage4-"));
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

function seedDueTodayExpression() {
  return `(() => {
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    const fill = {
      savedId: "syn-stage4-fill",
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
    const schedule = {
      id: "syn-stage4-sched",
      fillSavedId: "syn-stage4-fill",
      doseAmount: 3,
      doseMl: 0.2,
      unitLabel: "mg",
      intervalDays: 7,
      reminderTime: "09:00",
      startDate: today,
      takenDates: [],
      lifecycle: "active",
    };
    const envelope = { version: 1, fills: [fill], schedules: [schedule], occurrences: [], medications: [] };
    localStorage.setItem("peptide-calculator-v2-p0ux-store", JSON.stringify(envelope));
    localStorage.setItem("peptide-calculator-v2-fills", JSON.stringify([fill]));
    localStorage.setItem("peptide-calculator-v2-schedules", JSON.stringify([schedule]));
    localStorage.setItem("peptide-calculator-v2-occurrences", "[]");
    localStorage.setItem("peptide-calculator-v2-medications", "[]");
    return today;
  })()`;
}

async function captureShots(cdp, label) {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const views = [
    { name: `${label}-mobile`, width: 390, height: 844, dsf: 2, mobile: true },
    { name: `${label}-desktop`, width: 1280, height: 800, dsf: 1, mobile: false },
  ];

  for (const view of views) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: view.width,
      height: view.height,
      deviceScaleFactor: view.dsf,
      mobile: view.mobile,
    });

    await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` });
    await waitFor(cdp, "Boolean(document.querySelector('.tabbar') && document.querySelector('.app-header'))");
    await cdp.evaluate("localStorage.clear()");
    await cdp.send("Page.reload", { ignoreCache: true });
    await waitFor(cdp, "Boolean(window.FitGenP0Ux && window.FitGenP0UxBind && document.querySelector('.wizard-cancel-btn'))");
    await wait(400);
    await cdp.screenshot(path.join(OUT_DIR, `${view.name}-shell.png`));
    console.log(`wrote ${view.name}-shell.png`);

    await cdp.evaluate(`
      const vial = document.getElementById("vial-mg");
      vial.value = "40";
      vial.dispatchEvent(new Event("input", { bubbles: true }));
      document.querySelector(".wizard-cancel-btn").click();
    `);
    await waitFor(cdp, "!document.getElementById('fitgen-confirm-dialog').classList.contains('is-hidden')");
    await wait(200);
    await cdp.screenshot(path.join(OUT_DIR, `${view.name}-dirty-cancel.png`));
    console.log(`wrote ${view.name}-dirty-cancel.png`);
    await cdp.evaluate(`document.getElementById("fitgen-confirm-secondary").click()`);
    await wait(150);

    await cdp.evaluate(seedDueTodayExpression());
    await cdp.send("Page.reload", { ignoreCache: true });
    await waitFor(cdp, "Boolean(window.FitGenP0UxBind)");
    await cdp.evaluate(`document.querySelector('[data-view-target=schedule-view]').click()`);
    await waitFor(cdp, "Boolean(document.querySelector('[data-action=mark-taken]'))");
    await wait(250);
    await cdp.evaluate(`document.querySelector('[data-action=mark-taken]').click()`);
    await waitFor(cdp, "!document.getElementById('fitgen-undo-snackbar').classList.contains('is-hidden')");
    await wait(250);
    await cdp.screenshot(path.join(OUT_DIR, `${view.name}-taken-undo.png`));
    console.log(`wrote ${view.name}-taken-undo.png`);
  }
}

async function main() {
  const shotIdx = process.argv.indexOf("--shots");
  const shotLabel = shotIdx >= 0 ? process.argv[shotIdx + 1] : null;
  if (shotLabel !== "before" && shotLabel !== "after") {
    throw new Error("usage: node scripts/ux/stage4-shell-capture.js --shots before|after");
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
