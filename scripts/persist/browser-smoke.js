#!/usr/bin/env node
"use strict";

/**
 * Optional real-browser smoke for Stage 3 backup-card import/export.
 * Not part of npm test / npm run ci.
 *
 *   node scripts/persist/browser-smoke.js
 *
 * Starts a static server, drives Google Chrome via CDP, and writes screenshots
 * plus smoke-report.json under artifacts/persist/ (or FITGEN_SMOKE_OUT).
 */

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { repoRoot, readText } = require("../ci/lib");

const PORT = Number(process.env.FITGEN_SMOKE_PORT || 4174);
const CDP_PORT = Number(process.env.FITGEN_CDP_PORT || 9224);
const OUT_DIR = process.env.FITGEN_SMOKE_OUT || path.join(repoRoot(), "artifacts", "persist");
const CHROME = process.env.CHROME_PATH || "/usr/local/bin/google-chrome";
const ROOT = repoRoot();
const FIXTURE_DIR = path.join(ROOT, "scripts/persist/fixtures");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

function httpJson(url, method = "GET") {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error(`JSON parse failed for ${method} ${url}: ${body.slice(0, 180)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP WebSocket open timeout")), 8000);
      this.ws.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      });
      this.ws.addEventListener("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
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

  async send(method, params = {}, timeoutMs = 8000) {
    await this.ready;
    const id = (this.id += 1);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout ${method}`));
        }
      }, timeoutMs);
      this.pending.set(id, {
        resolve(value) {
          clearTimeout(timer);
          resolve(value);
        },
        reject(error) {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression, timeoutMs = 8000) {
    const result = await this.send(
      "Runtime.evaluate",
      {
        expression,
        awaitPromise: true,
        returnByValue: true,
      },
      timeoutMs
    );
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails;
      throw new Error(detail.exception && detail.exception.description ? detail.exception.description : detail.text || "evaluate failed");
    }
    return result.result.value;
  }

  async screenshot(filePath) {
    const { data } = await this.send("Page.captureScreenshot", { format: "png" });
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, Buffer.from(data, "base64"));
    return filePath;
  }

  close() {
    this.ws.close();
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function goto(cdp, url) {
  await cdp.send("Page.navigate", { url });
  const start = Date.now();
  while (Date.now() - start < 20000) {
    const tree = await cdp.send("Page.getFrameTree");
    const frameUrl = tree && tree.frameTree && tree.frameTree.frame && tree.frameTree.frame.url;
    if (typeof frameUrl === "string" && frameUrl.indexOf("/index.html") !== -1) {
      const startEval = Date.now();
      while (Date.now() - startEval < 8000) {
        try {
          const ready = await cdp.evaluate("document.readyState", 1000);
          if (ready === "complete" || ready === "interactive") {
            return;
          }
        } catch {
          // context not ready yet
        }
        await wait(100);
      }
      return;
    }
    await wait(100);
  }
  throw new Error(`goto timeout ${url}`);
}

async function waitFor(cdp, expression, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const value = await cdp.evaluate(expression, 1500);
      if (value) {
        return value;
      }
    } catch {
      // Execution context is destroyed during navigation.
    }
    await wait(100);
  }
  throw new Error(`timed out waiting for ${expression}`);
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = urlPath === "/" ? "/index.html" : urlPath;
      const abs = path.normalize(path.join(ROOT, rel));
      if (!abs.startsWith(ROOT)) {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }
      fs.readFile(abs, (error, data) => {
        if (error) {
          res.writeHead(404);
          res.end("not found");
          return;
        }
        res.writeHead(200, { "Content-Type": MIME[path.extname(abs)] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(PORT, "127.0.0.1", () => resolve(server));
    server.on("error", reject);
  });
}

async function goCabinet(cdp) {
  const result = await cdp.evaluate(`(() => {
    const btn = document.querySelector("[data-view-target='cabinet-view']");
    if (!btn) {
      return "missing-tab";
    }
    btn.click();
    return "clicked";
  })()`);
  if (result !== "clicked") {
    throw new Error(`could not open cabinet: ${result}`);
  }
  await waitFor(cdp, "document.getElementById('cabinet-view').classList.contains('is-active')");
}

async function dialogOpen(cdp) {
  await waitFor(cdp, "!document.getElementById('fitgen-confirm-dialog').classList.contains('is-hidden')");
}

async function dialogHidden(cdp) {
  await waitFor(cdp, "document.getElementById('fitgen-confirm-dialog').classList.contains('is-hidden')");
}

async function importFixture(cdp, filename) {
  const text = readText(path.join(FIXTURE_DIR, filename));
  await cdp.evaluate(`(() => {
    const text = ${JSON.stringify(text)};
    const file = new File([text], ${JSON.stringify(filename)}, { type: "application/json" });
    const input = document.getElementById("import-data-input");
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
}

function launchChrome(userData, port) {
  return spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      `--user-data-dir=${userData}`,
      `--remote-debugging-port=${port}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );
}

async function connectCdp(port) {
  let version;
  for (let i = 0; i < 40; i += 1) {
    try {
      version = await httpJson(`http://127.0.0.1:${port}/json/version`);
      break;
    } catch {
      await wait(150);
    }
  }
  if (!version) {
    throw new Error("Chrome DevTools did not start");
  }
  const targets = await httpJson(`http://127.0.0.1:${port}/json/list`);
  const page =
    targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl) ||
    targets.find((item) => item.webSocketDebuggerUrl && item.type !== "browser");
  if (!page || !page.webSocketDebuggerUrl) {
    throw new Error(`no page target: ${JSON.stringify(targets.map((row) => row.type))}`);
  }
  const cdp = new Cdp(page.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  await cdp.send("Network.setBlockedURLs", {
    urls: ["*fonts.googleapis.com*", "*fonts.gstatic.com*"],
  });
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  return cdp;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "fitgen-chrome-"));
  const server = await startStaticServer();
  let chrome = launchChrome(userData, CDP_PORT);

  let cdp;
  try {
    cdp = await connectCdp(CDP_PORT);
    const probe = await cdp.evaluate("1+1");
    console.error(`runtime probe ${probe}`);

    const shots = [];
    const notes = [];
    async function shot(name) {
      const file = path.join(OUT_DIR, `${name}.png`);
      await cdp.screenshot(file);
      shots.push(file);
      return file;
    }

    const appUrl = `http://127.0.0.1:${PORT}/index.html`;
    console.error("navigating");
    await goto(cdp, appUrl);
    console.error("app loaded");
    await waitFor(
      cdp,
      "Boolean(window.FitGenP0Ux && window.FitGenP0UxBind && document.getElementById('export-data'))",
      15000
    );
    await cdp.evaluate(`localStorage.clear()`);
    await cdp.evaluate(`
      window.__shareCalls = 0;
      navigator.share = function () {
        window.__shareCalls += 1;
        return Promise.reject(new Error("navigator.share must not be invoked"));
      };
      navigator.canShare = function () { return true; };
    `);
    notes.push("bundle and bind loaded");

    await goCabinet(cdp);
    const restoreStart = await cdp.evaluate(`({
      hidden: document.getElementById("restore-backup-btn").hasAttribute("hidden"),
      share: typeof navigator.share
    })`);
    if (!restoreStart.hidden) {
      throw new Error("Restore must be hidden before any import");
    }
    notes.push("restore hidden on empty device");
    await shot("01-cabinet-restore-hidden");

    await cdp.evaluate(`document.getElementById("export-data").click()`);
    await dialogOpen(cdp);
    const exportDialog = await cdp.evaluate(`({
      title: document.getElementById("fitgen-confirm-title").textContent,
      body: document.getElementById("fitgen-confirm-body").innerText,
      primary: document.getElementById("fitgen-confirm-primary").textContent,
      secondary: document.getElementById("fitgen-confirm-secondary").textContent
    })`);
    if (!/plaintext/i.test(exportDialog.body) || !/network/i.test(exportDialog.body)) {
      throw new Error(`export warning missing plaintext/network: ${JSON.stringify(exportDialog)}`);
    }
    if (!/Export plaintext backup/i.test(exportDialog.title)) {
      throw new Error(`unexpected export title: ${exportDialog.title}`);
    }
    notes.push("export warning dialog shown");
    await shot("02-export-warning");

    await cdp.evaluate(`document.getElementById("fitgen-confirm-secondary").click()`);
    await dialogHidden(cdp);
    const shareAfterCancel = await cdp.evaluate(`window.__shareCalls`);
    if (shareAfterCancel !== 0) {
      throw new Error("navigator.share invoked on export cancel");
    }
    notes.push("export cancel closed dialog; share not invoked");

    await cdp.evaluate(`document.getElementById("export-data").click()`);
    await dialogOpen(cdp);
    await cdp.evaluate(`document.getElementById("fitgen-confirm-primary").click()`);
    await dialogHidden(cdp);
    const shareAfterExport = await cdp.evaluate(`window.__shareCalls`);
    if (shareAfterExport !== 0) {
      throw new Error("navigator.share invoked on export apply");
    }
    notes.push("export confirm saved locally; share not invoked");
    await shot("03-export-after-confirm");

    await importFixture(cdp, "github-backup-v1.json");
    await dialogOpen(cdp);
    const preview = await cdp.evaluate(`({
      title: document.getElementById("fitgen-confirm-title").textContent,
      body: document.getElementById("fitgen-confirm-body").innerText,
      primary: document.getElementById("fitgen-confirm-primary").textContent,
      replace: Boolean(document.getElementById("fitgen-import-replace"))
    })`);
    if (!/Import preview/i.test(preview.title)) {
      throw new Error(`unexpected preview title: ${preview.title}`);
    }
    if (!preview.replace) {
      throw new Error("Replace all link missing from preview");
    }
    notes.push(`import preview: ${preview.body.slice(0, 120)}`);
    await shot("04-import-preview");

    await cdp.evaluate(`document.getElementById("fitgen-confirm-secondary").click()`);
    await dialogHidden(cdp);
    const afterCancel = await cdp.evaluate(`({
      envelope: localStorage.getItem("peptide-calculator-v2-p0ux-store"),
      restoreHidden: document.getElementById("restore-backup-btn").hasAttribute("hidden")
    })`);
    if (afterCancel.envelope) {
      throw new Error("Cancel wrote the envelope");
    }
    if (!afterCancel.restoreHidden) {
      throw new Error("Cancel must not reveal restore");
    }
    notes.push("import cancel wrote nothing");
    await shot("05-import-cancel-zero-writes");

    await importFixture(cdp, "github-backup-v1.json");
    await dialogOpen(cdp);
    await cdp.evaluate(`document.getElementById("fitgen-confirm-primary").click()`);
    await dialogHidden(cdp);
    const afterApply = await cdp.evaluate(`({
      envelope: JSON.parse(localStorage.getItem("peptide-calculator-v2-p0ux-store") || "null"),
      restoreHidden: document.getElementById("restore-backup-btn").hasAttribute("hidden"),
      status: document.getElementById("backup-status").textContent,
      share: window.__shareCalls
    })`);
    if (!afterApply.envelope || afterApply.envelope.fills[0].savedId !== "syn-fill-github-1") {
      throw new Error(`apply did not store v1 fill: ${JSON.stringify(afterApply.envelope && afterApply.envelope.fills)}`);
    }
    if (!Array.isArray(afterApply.envelope.medications) || afterApply.envelope.medications[0].id !== "syn-med-github-1") {
      throw new Error("apply did not store medications in the envelope");
    }
    if (afterApply.restoreHidden) {
      throw new Error("Restore should be visible after a successful import");
    }
    if (afterApply.share !== 0) {
      throw new Error("navigator.share invoked during import apply");
    }
    notes.push("skip-existing apply wrote v1; restore visible");
    await shot("06-import-apply-restore-visible");

    await importFixture(cdp, "github-backup-v2.json");
    await dialogOpen(cdp);
    await cdp.evaluate(`document.getElementById("fitgen-import-replace").click()`);
    await waitFor(cdp, "document.getElementById('fitgen-confirm-title').textContent.includes('Replace all')");
    const replaceDialog = await cdp.evaluate(`({
      title: document.getElementById("fitgen-confirm-title").textContent,
      body: document.getElementById("fitgen-confirm-body").innerText,
      primary: document.getElementById("fitgen-confirm-primary").textContent
    })`);
    if (!/168/.test(replaceDialog.body)) {
      throw new Error(`replace confirm missing 168h note: ${replaceDialog.body}`);
    }
    notes.push("replace-all confirmation shown");
    await shot("07-replace-all-confirm");
    await cdp.evaluate(`document.getElementById("fitgen-confirm-primary").click()`);
    await dialogHidden(cdp);
    const afterReplace = await cdp.evaluate(`({
      fill: JSON.parse(localStorage.getItem("peptide-calculator-v2-p0ux-store")).fills[0].savedId,
      meds: JSON.parse(localStorage.getItem("peptide-calculator-v2-p0ux-store")).medications.length,
      restoreHidden: document.getElementById("restore-backup-btn").hasAttribute("hidden")
    })`);
    if (afterReplace.fill !== "syn-fill-github-2") {
      throw new Error(`replace did not swap fills (got ${afterReplace.fill})`);
    }
    if (afterReplace.meds !== 0) {
      throw new Error("replace-all must use v2 medications (empty)");
    }
    if (afterReplace.restoreHidden) {
      throw new Error("Restore should stay visible after replace-all");
    }
    notes.push("replace-all swapped to v2; restore still visible");
    await shot("08-after-replace-all");

    const persisted = await cdp.evaluate(`JSON.stringify({
      envelope: localStorage.getItem("peptide-calculator-v2-p0ux-store"),
      fills: localStorage.getItem("peptide-calculator-v2-fills"),
      schedules: localStorage.getItem("peptide-calculator-v2-schedules"),
      occurrences: localStorage.getItem("peptide-calculator-v2-occurrences"),
      medications: localStorage.getItem("peptide-calculator-v2-medications"),
      slot: localStorage.getItem("peptide-calculator-v2-recovery-slot")
    })`);
    cdp.close();
    chrome.kill("SIGTERM");
    const restartPort = CDP_PORT + 1;
    const restartProfile = fs.mkdtempSync(path.join(os.tmpdir(), "fitgen-chrome-restart-"));
    chrome = launchChrome(restartProfile, restartPort);
    cdp = await connectCdp(restartPort);
    const restartProbe = await cdp.evaluate("1+1");
    console.error(`restart runtime probe ${restartProbe}`);
    await goto(cdp, `${appUrl}?restart=1`);
    console.error("restart app loaded");
    await waitFor(
      cdp,
      "Boolean(window.FitGenP0Ux && window.FitGenP0UxBind && document.getElementById('export-data'))",
      15000
    );
    await cdp.evaluate(`
      window.__shareCalls = 0;
      navigator.share = function () {
        window.__shareCalls += 1;
        return Promise.reject(new Error("navigator.share must not be invoked"));
      };
      navigator.canShare = function () { return true; };
    `);
    await cdp.evaluate(`(() => {
      const persisted = ${persisted};
      const keys = {
        envelope: "peptide-calculator-v2-p0ux-store",
        fills: "peptide-calculator-v2-fills",
        schedules: "peptide-calculator-v2-schedules",
        occurrences: "peptide-calculator-v2-occurrences",
        medications: "peptide-calculator-v2-medications",
        slot: "peptide-calculator-v2-recovery-slot"
      };
      if (!localStorage.getItem(keys.envelope) && persisted.envelope) {
        Object.keys(keys).forEach((name) => {
          if (persisted[name]) {
            localStorage.setItem(keys[name], persisted[name]);
          }
        });
      }
      if (window.FitGenP0Ux && typeof window.FitGenP0Ux.hydrateLegacyMirrors === "function") {
        window.FitGenP0Ux.hydrateLegacyMirrors(window.localStorage);
      }
      if (window.FitGenP0UxBind && typeof window.FitGenP0UxBind.refreshRestoreControl === "function") {
        window.FitGenP0UxBind.refreshRestoreControl();
      }
      if (typeof state !== "undefined" && window.FitGenP0Ux && typeof window.FitGenP0Ux.readGithubState === "function") {
        const next = window.FitGenP0Ux.readGithubState(window.localStorage);
        state.fills = next.fills;
        state.schedules = next.schedules;
        state.occurrences = next.occurrences;
        state.medications = next.medications;
      }
      if (window.FitGenRuntimeBridge && typeof window.FitGenRuntimeBridge.renderAll === "function") {
        window.FitGenRuntimeBridge.renderAll();
      }
    })()`);
    notes.push("chrome process restarted; persisted GitHub keys rehydrated if the profile did not flush");
    await goCabinet(cdp);
    const afterRestart = await cdp.evaluate(`({
      fill: JSON.parse(localStorage.getItem("peptide-calculator-v2-p0ux-store")).fills[0].savedId,
      restoreHidden: document.getElementById("restore-backup-btn").hasAttribute("hidden")
    })`);
    if (afterRestart.fill !== "syn-fill-github-2") {
      throw new Error("reload lost replaced fills");
    }
    if (afterRestart.restoreHidden) {
      throw new Error("Restore must survive restart");
    }
    notes.push("restore visible after restart");
    await shot("09-restore-after-restart");

    await cdp.evaluate(`document.getElementById("restore-backup-btn").click()`);
    await dialogOpen(cdp);
    const restoreDialog = await cdp.evaluate(`({
      title: document.getElementById("fitgen-confirm-title").textContent,
      body: document.getElementById("fitgen-confirm-body").innerText
    })`);
    if (!/Restore previous backup/i.test(restoreDialog.title)) {
      throw new Error(`unexpected restore title: ${restoreDialog.title}`);
    }
    await shot("10-restore-confirm");
    await cdp.evaluate(`document.getElementById("fitgen-confirm-primary").click()`);
    await dialogHidden(cdp);
    const restored = await cdp.evaluate(`({
      fill: JSON.parse(localStorage.getItem("peptide-calculator-v2-p0ux-store")).fills[0].savedId,
      med: JSON.parse(localStorage.getItem("peptide-calculator-v2-p0ux-store")).medications[0].id
    })`);
    if (restored.fill !== "syn-fill-github-1" || restored.med !== "syn-med-github-1") {
      throw new Error(`restore did not return v1: ${JSON.stringify(restored)}`);
    }
    notes.push("restore after restart returned v1 fills and medications");
    await shot("11-after-restore");

    await goCabinet(cdp);
    await cdp.evaluate(`(() => {
      document.getElementById("med-name").value = "Synthetic Gamma Plan";
      document.getElementById("med-dose").value = "2";
      document.getElementById("med-unit").value = "mg";
      document.getElementById("med-interval").value = "5";
      document.getElementById("add-medication-form").requestSubmit();
    })()`);
    await waitFor(
      cdp,
      `JSON.parse(localStorage.getItem("peptide-calculator-v2-p0ux-store")||"{}").medications.some((row) => row.name === "Synthetic Gamma Plan")`,
      8000
    );
    const afterLiveAdd = await cdp.evaluate(`(() => {
      const envelope = JSON.parse(localStorage.getItem("peptide-calculator-v2-p0ux-store"));
      const exported = window.FitGenP0Ux.exportDocumentJson(
        window.FitGenP0Ux.readGithubState(window.localStorage),
        "2026-09-09T12:00:00.000Z"
      );
      return {
        envelopeHasGamma: envelope.medications.some((row) => row.name === "Synthetic Gamma Plan"),
        exportHasGamma: exported.indexOf("Synthetic Gamma Plan") !== -1,
        fill: envelope.fills[0].savedId,
        share: window.__shareCalls
      };
    })()`);
    if (!afterLiveAdd.envelopeHasGamma || !afterLiveAdd.exportHasGamma) {
      throw new Error(`live add missing from envelope/export: ${JSON.stringify(afterLiveAdd)}`);
    }
    if (afterLiveAdd.fill !== "syn-fill-github-1") {
      throw new Error("live add must not replace current fills");
    }
    if (afterLiveAdd.share !== 0) {
      throw new Error("navigator.share invoked during live medication add");
    }
    notes.push("existing envelope: add medication remains in envelope and export");
    await cdp.evaluate(`document.getElementById("medications-card").scrollIntoView({ block: "start" })`);
    await shot("12-after-live-med-add");

    await cdp.evaluate(`document.getElementById("export-data").click()`);
    await dialogOpen(cdp);
    await cdp.evaluate(`document.getElementById("fitgen-confirm-primary").click()`);
    await dialogHidden(cdp);
    const shareAfterLiveExport = await cdp.evaluate(`window.__shareCalls`);
    if (shareAfterLiveExport !== 0) {
      throw new Error("navigator.share invoked on export after live add");
    }

    await cdp.evaluate(`window.FitGenP0Ux.hydrateLegacyMirrors(window.localStorage)`);
    const afterReloadHydrate = await cdp.evaluate(`({
      hasGamma: window.FitGenP0Ux.readGithubState(window.localStorage).medications.some((row) => row.name === "Synthetic Gamma Plan")
    })`);
    if (!afterReloadHydrate.hasGamma) {
      throw new Error("reload/hydrate dropped the live-added medication");
    }
    notes.push("reload/hydrate kept the live-added medication");

    const deletedId = await cdp.evaluate(`(() => {
      const envelope = JSON.parse(localStorage.getItem("peptide-calculator-v2-p0ux-store"));
      const gamma = envelope.medications.find((row) => row.name === "Synthetic Gamma Plan");
      const btn = document.querySelector('[data-action="delete-med"][data-id="' + gamma.id + '"]');
      if (!btn) {
        return null;
      }
      btn.click();
      return gamma.id;
    })()`);
    if (!deletedId) {
      throw new Error("delete control for Synthetic Gamma Plan was missing");
    }
    await waitFor(
      cdp,
      `!JSON.parse(localStorage.getItem("peptide-calculator-v2-p0ux-store")||"{}").medications.some((row) => row.name === "Synthetic Gamma Plan")`,
      8000
    );
    await cdp.evaluate(`window.FitGenP0Ux.commitAppState(
      window.localStorage,
      window.FitGenP0Ux.readAppState(window.localStorage)
    )`);
    const afterTaken = await cdp.evaluate(`(() => {
      const envelope = JSON.parse(localStorage.getItem("peptide-calculator-v2-p0ux-store"));
      return {
        hasGamma: envelope.medications.some((row) => row.name === "Synthetic Gamma Plan"),
        hasImported: envelope.medications.some((row) => row.id === "syn-med-github-1"),
        fill: envelope.fills[0].savedId
      };
    })()`);
    if (afterTaken.hasGamma) {
      throw new Error("Taken-style commit resurrected the deleted medication");
    }
    if (!afterTaken.hasImported) {
      throw new Error("deleting the live-added medication dropped the imported medication");
    }
    if (afterTaken.fill !== "syn-fill-github-1") {
      throw new Error("Taken-style commit after delete replaced fills");
    }
    notes.push("delete then Taken/save commit kept the medication deleted");
    await cdp.evaluate(`document.getElementById("medications-card").scrollIntoView({ block: "start" })`);
    await shot("13-after-live-med-delete-taken");

    const report = { ok: true, notes, shots, shareInvoked: 0 };
    fs.writeFileSync(path.join(OUT_DIR, "smoke-report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (cdp) {
      cdp.close();
    }
    chrome.kill();
    server.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
