#!/usr/bin/env node
"use strict";

/**
 * Stage 6c-B1 helper (not part of npm test / npm run ci).
 * Capture desktop + narrow-mobile evidence for RF-B-003 CSS absorb.
 * Synthetic names only — no real PHI.
 *
 *   node scripts/ux/stage6c-b1-css-capture.js --shots after
 */

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { repoRoot } = require("../ci/lib");
const { assertPngHasVisibleContent } = require("../ci/png-evidence");

const PORT = Number(process.env.FITGEN_STAGE6CB1_PORT || 4181);
const CDP_PORT = Number(process.env.FITGEN_STAGE6CB1_CDP_PORT || 9231);
const CHROME = process.env.CHROME_PATH || "/usr/local/bin/google-chrome";
const ROOT = repoRoot();
const OUT_DIR = path.join(ROOT, "docs/evidence/stage-6c-b1-css");
const FIXTURE = "/docs/evidence/stage-6c-b1-css/parity-surfaces.html";

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
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "fitgen-stage6cb1-"));
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
      savedId: "syn-stage6cb1-fill-a",
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
      id: "syn-stage6cb1-sched",
      fillSavedId: "syn-stage6cb1-fill-a",
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
      fills: [fillA],
      schedules: [schedule],
      occurrences: [],
      medications: [{ id: "syn-stage6cb1-med-a", name: "Demo Vial A" }],
    };
    localStorage.setItem("peptide-calculator-v2-p0ux-store", JSON.stringify(envelope));
    localStorage.setItem("peptide-calculator-v2-fills", JSON.stringify(envelope.fills));
    localStorage.setItem("peptide-calculator-v2-schedules", JSON.stringify(envelope.schedules));
    localStorage.setItem("peptide-calculator-v2-occurrences", "[]");
    localStorage.setItem("peptide-calculator-v2-medications", JSON.stringify(envelope.medications));
    localStorage.setItem("peptide-calculator-v2-selected-fill", JSON.stringify(fillA.savedId));
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
      return { width: rect.width, height: rect.height };
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

async function showFixtureSurface(cdp, surface, theme) {
  const state = await cdp.evaluate(`(() => {
    document.body.dataset.theme = ${JSON.stringify(theme)};
    document.querySelectorAll("[data-parity-surface]").forEach((node) => {
      const match = node.getAttribute("data-parity-surface") === ${JSON.stringify(surface)};
      node.classList.toggle("is-shown", match);
      node.classList.toggle("is-active", match);
    });
    const shown = document.querySelector('[data-parity-surface="${surface}"].is-shown');
    const styleId = document.getElementById("runtime-fixes-style");
    return {
      theme: document.body.dataset.theme,
      shown: Boolean(shown),
      injectedStyle: Boolean(styleId),
      text: shown ? String(shown.innerText || "").replace(/\\s+/g, " ").slice(0, 160) : "",
    };
  })()`);
  if (!state.shown) {
    throw new Error(`fixture surface not shown: ${JSON.stringify(state)}`);
  }
  if (state.injectedStyle) {
    throw new Error("fixture unexpectedly gained a runtime-fixes-style tag");
  }
  return state;
}

async function loadFixture(cdp, view) {
  await resetViewport(cdp, view);
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}${FIXTURE}` });
  await waitFor(cdp, "Boolean(document.querySelector('[data-parity-surface]'))");
  await wait(200);
}

async function loadSeededApp(cdp, view) {
  await resetViewport(cdp, view);
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` });
  await waitFor(cdp, "Boolean(document.querySelector('.tabbar') && document.getElementById('cabinet-card'))");
  await cdp.evaluate("localStorage.clear()");
  await cdp.evaluate(seedSyntheticExpression());
  await cdp.send("Page.reload", { ignoreCache: true });
  await waitFor(cdp, "Boolean(window.FitGenP0Ux && document.getElementById('current-peptides'))");
  await wait(400);
}

async function showView(cdp, viewId) {
  await cdp.evaluate(`(() => {
    const tab = document.querySelector('[data-view-target="${viewId}"]');
    if (tab) {
      tab.click();
    }
    document.querySelectorAll(".app-view").forEach((view) => {
      view.classList.toggle("is-active", view.id === "${viewId}");
    });
    return true;
  })()`);
  await waitFor(cdp, `document.getElementById("${viewId}").classList.contains("is-active")`);
  await wait(200);
}

async function assertLiveCabinet(cdp) {
  const state = await cdp.evaluate(`(() => {
    const vial = document.querySelector("#current-peptides .vial-row-fallback, #current-peptides .vial-row");
    const water = document.querySelector("#current-peptides .water-amount-emphasis");
    const styleId = document.getElementById("runtime-fixes-style");
    const text = String(document.getElementById("current-peptides")?.innerText || "");
    return {
      hasVial: Boolean(vial && getComputedStyle(vial).display !== "none"),
      hasWater: Boolean(water),
      injectedStyle: Boolean(styleId),
      hasDemoName: /Demo Vial A/.test(text),
      text: text.replace(/\\s+/g, " ").slice(0, 180),
    };
  })()`);
  if (state.injectedStyle) {
    throw new Error("live app still injects runtime-fixes-style");
  }
  if (!state.hasVial || !state.hasDemoName) {
    throw new Error(`live cabinet fallback chrome missing: ${JSON.stringify(state)}`);
  }
  return state;
}

async function captureShots(cdp, label) {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const views = [
    { name: `${label}-mobile`, width: 390, height: 844, dsf: 2, mobile: true },
    { name: `${label}-desktop`, width: 1280, height: 800, dsf: 1, mobile: false },
  ];

  const fixtureShots = [
    { surface: "cabinet", theme: "dark", selectors: ["#cabinet-card"] },
    { surface: "cabinet", theme: "light", selectors: ["#cabinet-card"] },
    { surface: "schedule", theme: "dark", selectors: ["#reminder-list"] },
    { surface: "schedule", theme: "light", selectors: ["#reminder-list"] },
    { surface: "notif", theme: "dark", selectors: ["#notif-setup-card"] },
  ];

  for (const view of views) {
    for (const shot of fixtureShots) {
      await loadFixture(cdp, view);
      const shown = await showFixtureSurface(cdp, shot.surface, shot.theme);
      const fileName = `${view.name}-${shot.surface}-${shot.theme}.png`;
      const stats = await screenshotViewport(cdp, path.join(OUT_DIR, fileName), shot.selectors);
      console.log(`wrote ${fileName} (${stats.width}x${stats.height} ${stats.bytes} bytes) ${JSON.stringify(shown.text)}`);
    }

    await loadSeededApp(cdp, view);
    await showView(cdp, "cabinet-view");
    const live = await assertLiveCabinet(cdp);
    const liveName = `${label}-live-${view.name.replace(`${label}-`, "")}-cabinet-dark.png`;
    const liveStats = await screenshotViewport(cdp, path.join(OUT_DIR, liveName), ["#cabinet-card", "#current-peptides"]);
    console.log(`wrote ${liveName} (${liveStats.width}x${liveStats.height} ${liveStats.bytes} bytes) ${JSON.stringify(live.text)}`);
  }
}

async function main() {
  const shotIdx = process.argv.indexOf("--shots");
  const shotLabel = shotIdx >= 0 ? process.argv[shotIdx + 1] : null;
  if (shotLabel !== "after") {
    throw new Error("usage: node scripts/ux/stage6c-b1-css-capture.js --shots after");
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
