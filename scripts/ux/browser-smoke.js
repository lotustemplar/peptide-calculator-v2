#!/usr/bin/env node
"use strict";

/**
 * Optional real-browser smoke for P0.UX. Not part of npm test / npm run ci.
 * Uses system Google Chrome + CDP (no extra npm dependency).
 *
 *   node scripts/ux/browser-smoke.js
 */

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { repoRoot } = require("../ci/lib");

const PORT = Number(process.env.FITGEN_SMOKE_PORT || 4173);
const OUT_DIR = process.env.FITGEN_SMOKE_OUT || path.join(repoRoot(), "artifacts", "p0-ux");
const CHROME = process.env.CHROME_PATH || "/usr/local/bin/google-chrome";

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

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "fitgen-chrome-"));
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      `--user-data-dir=${userData}`,
      "--remote-debugging-port=9222",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let version;
  for (let i = 0; i < 40; i += 1) {
    try {
      version = await httpJson("http://127.0.0.1:9222/json/version");
      break;
    } catch {
      await wait(150);
    }
  }
  if (!version) {
    chrome.kill();
    throw new Error("Chrome DevTools did not start");
  }

  const targets = await httpJson("http://127.0.0.1:9222/json/list");
  const page = targets.find((item) => item.type === "page") || targets[0];
  const cdp = new Cdp(page.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  const shots = [];
  const notes = [];

  async function shot(name) {
    const file = path.join(OUT_DIR, `${name}.png`);
    await cdp.screenshot(file);
    shots.push(file);
    return file;
  }

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` });
  await waitFor(cdp, "Boolean(window.FitGenP0Ux && window.FitGenP0UxBind && document.querySelector('.wizard-next-btn'))");
  notes.push("bundle and bind loaded");

  await cdp.evaluate(`
    localStorage.clear();
    const vial = document.getElementById('vial-mg');
    vial.value = '40';
    vial.dispatchEvent(new Event('input', { bubbles: true }));
  `);
  await cdp.evaluate(`document.querySelector('.wizard-next-btn').click()`);
  await waitFor(cdp, "document.querySelector('#wizard-pane-2.is-active')");
  await cdp.evaluate(`
    const dose = document.getElementById('dose-mg');
    dose.value = '2.5';
    dose.dispatchEvent(new Event('input', { bubbles: true }));
  `);
  await cdp.evaluate(`document.querySelector('#wizard-pane-2 .wizard-back-btn').click()`);
  const backVial = await cdp.evaluate(`document.getElementById('vial-mg').value`);
  if (backVial !== "40") {
    throw new Error(`Back did not preserve vial (got ${backVial})`);
  }
  notes.push("Back preserves vial 40");
  await shot("01-mobile-back-preserves-vial");

  await cdp.evaluate(`
    document.getElementById('vial-mg').value = '0';
    document.querySelector('.wizard-next-btn').click();
  `);
  await wait(200);
  const invalid = await cdp.evaluate(`({
    step1: Boolean(document.querySelector('#wizard-pane-1.is-active')),
    error: document.getElementById('vial-mg-error').textContent,
    hidden: document.getElementById('vial-mg-error').classList.contains('is-hidden'),
    active: document.activeElement && document.activeElement.id
  })`);
  if (!invalid.step1 || invalid.hidden || !/greater than 0/i.test(invalid.error)) {
    throw new Error(`invalid Next failed: ${JSON.stringify(invalid)}`);
  }
  await cdp.evaluate(`document.getElementById('vial-mg-error').scrollIntoView({ block: 'center' })`);
  notes.push("invalid Next stays on step 1 with inline error");
  await shot("02-mobile-invalid-next");

  await cdp.evaluate(`
    document.getElementById('vial-mg').value = '10';
    document.querySelector('.wizard-next-btn').click();
  `);
  await waitFor(cdp, "document.querySelector('#wizard-pane-2.is-active')");
  await cdp.evaluate(`
    document.getElementById('dose-mg').value = '12';
    document.querySelector('#wizard-pane-2 .wizard-next-btn').click();
  `);
  await wait(200);
  const doseErr = await cdp.evaluate(`({
    step2: Boolean(document.querySelector('#wizard-pane-2.is-active')),
    error: document.getElementById('dose-mg-error').textContent
  })`);
  if (!doseErr.step2 || !/larger than the amount in the vial/i.test(doseErr.error)) {
    throw new Error(`dose>vial Next failed: ${JSON.stringify(doseErr)}`);
  }
  await cdp.evaluate(`document.getElementById('dose-mg-error').scrollIntoView({ block: 'center' })`);
  notes.push("dose > vial blocks Next");
  await shot("03-mobile-dose-gt-vial");

  await cdp.evaluate(`document.querySelector('#wizard-pane-2 .wizard-cancel-btn').click()`);
  await waitFor(cdp, "!document.getElementById('fitgen-confirm-dialog').classList.contains('is-hidden')");
  const discardTitle = await cdp.evaluate(`document.getElementById('fitgen-confirm-title').textContent`);
  if (!/Discard this peptide setup/i.test(discardTitle)) {
    throw new Error(`dirty Cancel title was ${discardTitle}`);
  }
  notes.push("dirty Cancel opens in-app dialog");
  await shot("04-mobile-dirty-cancel");

  await cdp.evaluate(`document.getElementById('fitgen-confirm-secondary').click()`);
  await wait(150);
  const kept = await cdp.evaluate(`({
    hidden: document.getElementById('fitgen-confirm-dialog').classList.contains('is-hidden'),
    dose: document.getElementById('dose-mg').value
  })`);
  if (!kept.hidden || kept.dose !== "12") {
    throw new Error(`Keep editing failed: ${JSON.stringify(kept)}`);
  }
  notes.push("Keep editing changes nothing");
  await shot("05-mobile-keep-editing");

  await cdp.evaluate(`document.querySelector('#wizard-pane-2 .wizard-cancel-btn').click()`);
  await waitFor(cdp, "!document.getElementById('fitgen-confirm-dialog').classList.contains('is-hidden')");
  await cdp.evaluate(`document.getElementById('fitgen-confirm-primary').click()`);
  await wait(200);
  const discarded = await cdp.evaluate(`({
    step1: Boolean(document.querySelector('#wizard-pane-1.is-active')),
    vial: document.getElementById('vial-mg').value,
    dose: document.getElementById('dose-mg').value
  })`);
  if (!discarded.step1 || discarded.vial !== "30" || discarded.dose !== "3") {
    throw new Error(`Discard failed: ${JSON.stringify(discarded)}`);
  }
  notes.push("Discard restores characterized values");
  await shot("06-mobile-discard-restored");

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.evaluate(`
    document.getElementById('vial-mg').value = '0';
    document.querySelector('.wizard-next-btn').click();
  `);
  await wait(200);
  await cdp.evaluate(`document.getElementById('vial-mg-error').scrollIntoView({ block: 'center' })`);
  await shot("15-desktop-invalid-next");
  await cdp.evaluate(`
    document.getElementById('vial-mg').value = '40';
    document.querySelector('.wizard-cancel-btn').click();
  `);
  await waitFor(cdp, "!document.getElementById('fitgen-confirm-dialog').classList.contains('is-hidden')");
  await shot("16-desktop-dirty-cancel");
  await cdp.evaluate(`document.getElementById('fitgen-confirm-secondary').click()`);
  await wait(150);
  await cdp.evaluate(`
    document.getElementById('vial-mg').value = '30';
    document.querySelector('.wizard-next-btn').click();
  `);
  await waitFor(cdp, "document.querySelector('#wizard-pane-2.is-active')");
  await cdp.evaluate(`document.querySelector('#wizard-pane-2 .wizard-next-btn').click()`);
  await waitFor(cdp, "document.querySelector('#wizard-pane-3.is-active')");
  await cdp.evaluate(`document.getElementById('calculator-form').requestSubmit()`);
  await waitFor(cdp, "Boolean(document.querySelector('[data-action=save-option]'))");
  await cdp.evaluate(`document.querySelector('[data-action=save-option]').click()`);
  await waitFor(cdp, "!document.getElementById('save-fill-modal').classList.contains('is-hidden')");
  await cdp.evaluate(`
    document.getElementById('save-fill-name').value = 'Due Today Peptide';
    const start = document.getElementById('save-fill-start-date');
    const now = new Date();
    start.value = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
    document.getElementById('save-fill-form').requestSubmit();
  `);
  await waitFor(cdp, "!document.getElementById('fitgen-confirm-dialog').classList.contains('is-hidden')");
  const saveBody = await cdp.evaluate(`document.getElementById('fitgen-confirm-body').innerText`);
  if (!/You entered this dose. FitGen only calculates water and draw volume/.test(saveBody)) {
    throw new Error(`save confirm missing disclaimer: ${saveBody}`);
  }
  if (/recommend/i.test(saveBody)) {
    throw new Error("save confirm has forbidden framing");
  }
  notes.push("pre-save summary + disclaimer");
  await shot("07-desktop-save-confirm");

  await cdp.evaluate(`document.getElementById('fitgen-confirm-secondary').click()`);
  await wait(150);
  const saveKept = await cdp.evaluate(`({
    confirmHidden: document.getElementById('fitgen-confirm-dialog').classList.contains('is-hidden'),
    modalOpen: !document.getElementById('save-fill-modal').classList.contains('is-hidden'),
    name: document.getElementById('save-fill-name').value
  })`);
  if (!saveKept.confirmHidden || !saveKept.modalOpen || saveKept.name !== "Due Today Peptide") {
    throw new Error(`save Cancel failed: ${JSON.stringify(saveKept)}`);
  }
  notes.push("Save Cancel keeps name modal");

  await cdp.evaluate(`document.getElementById('save-fill-form').requestSubmit()`);
  await waitFor(cdp, "!document.getElementById('fitgen-confirm-dialog').classList.contains('is-hidden')");
  await cdp.evaluate(`document.getElementById('fitgen-confirm-primary').click()`);
  await waitFor(cdp, "document.getElementById('cabinet-view').classList.contains('is-active')");
  const cabinet = await cdp.evaluate(`document.getElementById('current-peptides').innerText`);
  if (!/Due Today Peptide/.test(cabinet)) {
    throw new Error(`cabinet missing saved peptide: ${cabinet}`);
  }
  notes.push("Save persist shows Cabinet item");
  await shot("08-desktop-cabinet-saved");

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await cdp.evaluate(`document.querySelector('[data-action=delete-fill]').click()`);
  await waitFor(cdp, "!document.getElementById('fitgen-confirm-dialog').classList.contains('is-hidden')");
  const delBody = await cdp.evaluate(`document.getElementById('fitgen-confirm-body').innerText`);
  if (!/Deletes 1 dosage plan/.test(delBody)) {
    throw new Error(`cabinet confirm body: ${delBody}`);
  }
  notes.push("cabinet cascade confirm");
  await shot("09-mobile-cabinet-delete-confirm");

  await cdp.evaluate(`document.getElementById('fitgen-confirm-secondary').click()`);
  await wait(150);
  const stillThere = await cdp.evaluate(`document.getElementById('current-peptides').innerText`);
  if (!/Due Today Peptide/.test(stillThere)) {
    throw new Error("cabinet Cancel deleted the fill");
  }
  notes.push("cabinet Cancel keeps fill");

  await cdp.evaluate(`document.querySelector('[data-view-target=schedule-view]').click()`);
  await waitFor(cdp, "document.querySelector('[data-action=mark-taken]')");
  await shot("10-mobile-schedule-due");
  await cdp.evaluate(`document.querySelector('[data-action=mark-taken]').click()`);
  await wait(300);
  const taken = await cdp.evaluate(`({
    snackbar: !document.getElementById('fitgen-undo-snackbar').classList.contains('is-hidden'),
    text: document.getElementById('reminder-list').innerText,
    canUndo: Boolean(window.FitGenP0UxBind.canUndo(document.querySelector('[data-action=undo-taken], [data-action=mark-taken]').dataset.id))
  })`);
  if (!taken.snackbar || !/Taken today/i.test(taken.text)) {
    throw new Error(`Taken failed: ${JSON.stringify(taken)}`);
  }
  notes.push("Taken shows snackbar and taken state");
  await shot("11-mobile-taken-snackbar");

  await cdp.evaluate(`document.querySelector('[data-action=mark-taken], [data-action=undo-taken]').closest('article').querySelector('[data-action=mark-taken]')?.click()`);
  const double = await cdp.evaluate(`({
    taken: /Taken today/i.test(document.getElementById('reminder-list').innerText)
  })`);
  if (!double.taken) {
    throw new Error("double-tap lost taken state");
  }
  notes.push("double-tap Taken stays taken");

  await cdp.send("Page.reload", { ignoreCache: true });
  await waitFor(cdp, "Boolean(window.FitGenP0UxBind)");
  await cdp.evaluate(`document.querySelector('[data-view-target=schedule-view]').click()`);
  await waitFor(cdp, "document.getElementById('reminder-list')");
  await wait(300);
  const afterReload = await cdp.evaluate(`({
    text: document.getElementById('reminder-list').innerText,
    undo: Boolean(document.querySelector('[data-action=undo-taken]'))
  })`);
  if (!/Taken today/i.test(afterReload.text) || !afterReload.undo) {
    throw new Error(`reload Undo missing: ${JSON.stringify(afterReload)}`);
  }
  notes.push("restart-safe Undo button present");
  await shot("12-mobile-reload-undo");

  await cdp.evaluate(`document.querySelector('[data-action=undo-taken]').click()`);
  await wait(300);
  const undone = await cdp.evaluate(`document.getElementById('reminder-list').innerText`);
  if (!/Mark as taken/i.test(undone) || /Taken today/i.test(undone)) {
    throw new Error(`Undo after reload failed: ${undone}`);
  }
  notes.push("Undo after reload returns pending");
  await shot("13-mobile-undone-after-reload");

  await cdp.evaluate(`
    document.getElementById('vial-mg').value = '40';
    document.querySelector('.wizard-cancel-btn').click();
  `);
  await waitFor(cdp, "!document.getElementById('fitgen-confirm-dialog').classList.contains('is-hidden')");
  const focusStart = await cdp.evaluate(`document.activeElement && document.activeElement.id`);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  const focusAfterTab = await cdp.evaluate(`document.activeElement && document.activeElement.id`);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await wait(150);
  const afterEsc = await cdp.evaluate(`({
    hidden: document.getElementById('fitgen-confirm-dialog').classList.contains('is-hidden'),
    vial: document.getElementById('vial-mg').value
  })`);
  if (!afterEsc.hidden || afterEsc.vial !== "40") {
    throw new Error(`Escape/restore failed: ${JSON.stringify(afterEsc)}`);
  }
  notes.push(`focus trap/Escape/restore (start=${focusStart} tab=${focusAfterTab})`);
  await shot("14-mobile-escape-restore");

  const report = { ok: true, notes, shots };
  fs.writeFileSync(path.join(OUT_DIR, "smoke-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  cdp.close();
  chrome.kill();
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
