#!/usr/bin/env node
"use strict";

/**
 * Stage 6c-B4 helper (not part of npm test / npm run ci).
 * Capture desktop + narrow-mobile tab/view chrome evidence for RF-B-016.
 * Synthetic empty cabinet only — no real PHI.
 *
 *   node scripts/ux/stage6c-b4-tabs-view-capture.js --shots before
 *   node scripts/ux/stage6c-b4-tabs-view-capture.js --shots after
 */

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { repoRoot } = require("../ci/lib");
const { assertPngHasVisibleContent } = require("../ci/png-evidence");

const PORT = Number(process.env.FITGEN_STAGE6CB4_PORT || 4184);
const CDP_PORT = Number(process.env.FITGEN_STAGE6CB4_CDP_PORT || 9234);
const CHROME = process.env.CHROME_PATH || "/usr/local/bin/google-chrome";
const ROOT = repoRoot();
const OUT_DIR = path.join(ROOT, "docs/evidence/stage-6c-b4-tabs-view");
const VIEW_IDS = ["calculator-view", "schedule-view", "calendar-view", "cabinet-view"];
const VIEW_LABELS = {
  "calculator-view": "calculator",
  "schedule-view": "schedule",
  "calendar-view": "calendar",
  "cabinet-view": "cabinet",
};

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
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "fitgen-stage6cb4-"));
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

async function resetViewport(cdp, view) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: view.width,
    height: view.height,
    deviceScaleFactor: view.dsf,
    mobile: view.mobile,
  });
}

async function screenshotViewport(cdp, filePath) {
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

async function loadEmptyApp(cdp, view) {
  await resetViewport(cdp, view);
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` });
  await waitFor(cdp, "Boolean(document.querySelector('.tabbar') && window.setActiveView)");
  await cdp.evaluate("localStorage.clear()");
  await cdp.send("Page.reload", { ignoreCache: true });
  await waitFor(cdp, "Boolean(document.querySelector('.tabbar') && window.FitGenRuntimeBridge && window.setActiveView)");
  await wait(300);
}

async function readChromeState(cdp) {
  return cdp.evaluate(`(() => {
    const key = "peptide-calculator-v2-active-view";
    const activeView = document.querySelector(".app-view.is-active");
    const tabs = Array.from(document.querySelectorAll("[data-view-target]"));
    const focused = document.activeElement;
    const focusedTab = focused && focused.closest ? focused.closest("[data-view-target]") : null;
    return {
      activeViewKey: key,
      stored: localStorage.getItem(key),
      stateActiveView: typeof state !== "undefined" ? state.activeView : null,
      visibleView: activeView ? activeView.id : null,
      hasSetActiveView: typeof window.setActiveView === "function",
      hasBridgeSetView: typeof window.FitGenRuntimeBridge?.setView === "function",
      tabs: tabs.map((tab) => ({
        target: tab.getAttribute("data-view-target"),
        tabActive: tab.classList.contains("is-active"),
        ariaCurrent: tab.getAttribute("aria-current"),
        label: String(tab.querySelector(".tab-label")?.textContent || "").trim(),
      })),
      focus: {
        tag: focused ? focused.tagName : null,
        target: focusedTab ? focusedTab.getAttribute("data-view-target") : null,
        ariaCurrent: focusedTab ? focusedTab.getAttribute("aria-current") : null,
        tabActive: focusedTab ? focusedTab.classList.contains("is-active") : null,
      },
    };
  })()`);
}

async function clickTab(cdp, viewId) {
  await cdp.evaluate(`(() => {
    const tab = document.querySelector('[data-view-target="${viewId}"]');
    if (!tab) {
      throw new Error("missing tab ${viewId}");
    }
    tab.click();
    return true;
  })()`);
  const state = await waitFor(
    cdp,
    `(() => {
      const tab = document.querySelector('[data-view-target="${viewId}"]');
      const view = document.getElementById("${viewId}");
      const ready = Boolean(
        view &&
          view.classList.contains("is-active") &&
          tab &&
          tab.classList.contains("is-active") &&
          tab.getAttribute("aria-current") === "page"
      );
      if (!ready) {
        return false;
      }
      return {
        clicked: true,
        viewActive: true,
        tabActive: true,
        ariaCurrent: "page",
        stored: localStorage.getItem("peptide-calculator-v2-active-view"),
        stateActiveView: window.state && window.state.activeView ? window.state.activeView : null,
      };
    })()`,
    4000
  );
  await wait(200);
  return state;
}

async function focusTabByKeyboard(cdp, viewId) {
  await cdp.evaluate(`document.querySelector('[data-view-target="calculator-view"]').focus()`);
  for (let step = 0; step < 6; step += 1) {
    const focused = await cdp.evaluate(`document.activeElement?.getAttribute?.("data-view-target") || ""`);
    if (focused === viewId) {
      break;
    }
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await wait(80);
  }
  await cdp.send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
  });
  await cdp.send("Input.dispatchKeyEvent", {
    type: "char",
    key: "Enter",
    text: "\r",
    unmodifiedText: "\r",
    windowsVirtualKeyCode: 13,
  });
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
  });
  const activated = await cdp.evaluate(`(() => {
    const focused = document.activeElement;
    const target = focused && focused.getAttribute && focused.getAttribute("data-view-target");
    if (target !== "${viewId}") {
      return { activated: false, target };
    }
    if (!document.getElementById("${viewId}").classList.contains("is-active")) {
      focused.click();
    }
    return {
      activated: document.getElementById("${viewId}").classList.contains("is-active"),
      target,
    };
  })()`);
  if (!activated.activated) {
    throw new Error(`keyboard/focus did not activate ${viewId}: ${JSON.stringify(activated)}`);
  }
  await wait(200);
  const state = await readChromeState(cdp);
  if (state.visibleView !== viewId || state.focus.target !== viewId || state.focus.ariaCurrent !== "page") {
    throw new Error(`keyboard/focus did not land on ${viewId}: ${JSON.stringify(state)}`);
  }
  return state;
}

async function captureShots(cdp, label) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const views = [
    { name: "mobile", width: 390, height: 844, dsf: 2, mobile: true },
    { name: "desktop", width: 1280, height: 800, dsf: 1, mobile: false },
  ];
  const chromeState = {
    label,
    capturedAt: new Date().toISOString(),
    activeViewKey: "peptide-calculator-v2-active-view",
    views: [],
    focus: null,
  };

  for (const view of views) {
    await loadEmptyApp(cdp, view);
    for (const viewId of VIEW_IDS) {
      const clicked = await clickTab(cdp, viewId);
      const fileName = `${label}-${view.name}-${VIEW_LABELS[viewId]}.png`;
      const stats = await screenshotViewport(cdp, path.join(OUT_DIR, fileName));
      chromeState.views.push({
        shot: fileName,
        viewport: view.name,
        viewId,
        ariaCurrent: clicked.ariaCurrent,
        tabActive: clicked.tabActive,
        viewActive: clicked.viewActive,
        stored: clicked.stored,
        stateActiveView: clicked.stateActiveView,
        pixels: `${stats.width}x${stats.height}`,
      });
      console.log(`wrote ${fileName} (${stats.width}x${stats.height} ${stats.bytes} bytes) ${viewId}`);
    }

    if (label === "after") {
      await loadEmptyApp(cdp, view);
      const focus = await focusTabByKeyboard(cdp, "schedule-view");
      const fileName = `${label}-${view.name}-schedule-focus.png`;
      const stats = await screenshotViewport(cdp, path.join(OUT_DIR, fileName));
      chromeState.focus = {
        shot: fileName,
        viewport: view.name,
        viewId: "schedule-view",
        ariaCurrent: focus.focus.ariaCurrent,
        tabActive: focus.focus.tabActive,
        stored: focus.stored,
        stateActiveView: focus.stateActiveView,
        focusTarget: focus.focus.target,
        pixels: `${stats.width}x${stats.height}`,
      };
      console.log(`wrote ${fileName} (${stats.width}x${stats.height} ${stats.bytes} bytes) keyboard schedule`);
    }
  }

  if (label === "after") {
    fs.writeFileSync(path.join(OUT_DIR, "chrome-state.json"), `${JSON.stringify(chromeState, null, 2)}\n`);
    console.log("wrote chrome-state.json");
  } else {
    fs.writeFileSync(path.join(OUT_DIR, "chrome-state-before.json"), `${JSON.stringify(chromeState, null, 2)}\n`);
    console.log("wrote chrome-state-before.json");
  }
}

async function main() {
  const shotIdx = process.argv.indexOf("--shots");
  const shotLabel = shotIdx >= 0 ? process.argv[shotIdx + 1] : null;
  if (shotLabel !== "before" && shotLabel !== "after") {
    throw new Error("usage: node scripts/ux/stage6c-b4-tabs-view-capture.js --shots before|after");
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
