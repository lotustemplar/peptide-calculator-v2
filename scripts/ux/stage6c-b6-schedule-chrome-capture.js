#!/usr/bin/env node
"use strict";

/**
 * Stage 6c-B6 helper (not part of npm test / npm run ci).
 * Capture desktop + narrow-mobile schedule/calendar chrome evidence for
 * RF-B-011 / RF-B-012. Synthetic Demo Vial A / Demo Vial B only — no real PHI.
 *
 *   node scripts/ux/stage6c-b6-schedule-chrome-capture.js --shots before
 *   node scripts/ux/stage6c-b6-schedule-chrome-capture.js --shots after
 */

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { repoRoot } = require("../ci/lib");
const { assertPngHasVisibleContent } = require("../ci/png-evidence");

const PORT = Number(process.env.FITGEN_STAGE6CB6_PORT || 4186);
const CDP_PORT = Number(process.env.FITGEN_STAGE6CB6_CDP_PORT || 9236);
const CHROME = process.env.CHROME_PATH || "/usr/local/bin/google-chrome";
const ROOT = repoRoot();
const OUT_DIR = path.join(ROOT, "docs/evidence/stage-6c-b6-schedule-chrome");

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
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "fitgen-stage6cb6-"));
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

function dateKeyFromOffset(offsetDays) {
  return `(() => {
    const now = new Date();
    now.setDate(now.getDate() + ${Number(offsetDays)});
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
  })()`;
}

function seedSyntheticExpression(kind) {
  const startExpr = kind === "dates" ? dateKeyFromOffset(-14) : dateKeyFromOffset(0);
  return `(() => {
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    const startDate = ${startExpr};
    const fillA = {
      savedId: "syn-stage6cb6-fill-a",
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
      savedId: "syn-stage6cb6-fill-b",
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
      id: "syn-stage6cb6-sched",
      fillSavedId: "syn-stage6cb6-fill-a",
      doseAmount: 3,
      doseMl: 0.2,
      unitLabel: "mg",
      intervalDays: 7,
      reminderTime: "09:00",
      startDate,
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
    localStorage.setItem("peptide-calculator-v2-active-view", JSON.stringify("schedule-view"));
    return { today, startDate, kind: ${JSON.stringify(kind)} };
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

async function showView(cdp, viewId) {
  await cdp.evaluate(`(() => {
    const tab = document.querySelector('[data-view-target="${viewId}"]');
    if (tab) {
      tab.click();
    } else if (typeof window.setActiveView === "function") {
      window.setActiveView("${viewId}");
    }
    return true;
  })()`);
  await waitFor(cdp, `document.getElementById("${viewId}").classList.contains("is-active")`);
  await wait(200);
}

async function loadEmpty(cdp, view) {
  await resetViewport(cdp, view);
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` });
  await waitFor(cdp, "Boolean(document.querySelector('.tabbar') && document.getElementById('reminder-list'))");
  await cdp.evaluate("localStorage.clear()");
  await cdp.send("Page.reload", { ignoreCache: true });
  await waitFor(
    cdp,
    "Boolean(document.querySelector('.tabbar') && window.FitGenRuntimeBridge && document.getElementById('reminder-list'))"
  );
  await wait(300);
}

async function loadSeeded(cdp, view, kind) {
  await resetViewport(cdp, view);
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` });
  await waitFor(cdp, "Boolean(document.querySelector('.tabbar') && document.getElementById('reminder-list'))");
  await cdp.evaluate("localStorage.clear()");
  await cdp.evaluate(seedSyntheticExpression(kind));
  await cdp.send("Page.reload", { ignoreCache: true });
  await waitFor(
    cdp,
    "Boolean(window.FitGenP0Ux && window.FitGenP0UxBind && document.getElementById('reminder-list'))"
  );
  await wait(400);
}

async function readScheduleState(cdp) {
  return cdp.evaluate(`(() => {
    const list = document.getElementById("reminder-list");
    const banner = list ? list.querySelectorAll(".today-schedule-banner") : [];
    const cards = list ? list.querySelectorAll(".list-card") : [];
    const empty = list ? list.querySelectorAll(".empty-state") : [];
    const markTaken = list ? list.querySelectorAll('[data-action="mark-taken"]') : [];
    const undo = list ? list.querySelectorAll('[data-action="undo-taken"]') : [];
    const pills = list ? Array.from(list.querySelectorAll(".schedule-status-pill")).map((node) => String(node.textContent || "").trim()) : [];
    const focused = document.activeElement;
    return {
      bannerCount: banner.length,
      cardCount: cards.length,
      emptyCount: empty.length,
      emptyText: list ? Array.from(empty).map((node) => String(node.textContent || "").replace(/\\s+/g, " ").trim()).slice(0, 3) : [],
      markTakenCount: markTaken.length,
      undoCount: undo.length,
      pills,
      htmlHasBanner: banner.length > 0,
      ownerPresent: typeof window.renderSchedules === "function",
      text: list ? String(list.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 220) : "",
      focus: {
        tag: focused ? focused.tagName : null,
        action: focused && focused.getAttribute ? focused.getAttribute("data-action") : null,
        className: focused ? String(focused.className || "") : "",
        text: focused ? String(focused.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 80) : "",
      },
    };
  })()`);
}

async function readCalendarState(cdp) {
  return cdp.evaluate(`(() => {
    const list = document.getElementById("calendar-list");
    const days = list ? list.querySelectorAll(".calendar-day") : [];
    const items = list ? list.querySelectorAll(".calendar-item") : [];
    const headers = list ? Array.from(list.querySelectorAll(".calendar-section-header")).map((node) => String(node.textContent || "").trim()) : [];
    const empty = list ? list.querySelectorAll(".empty-state") : [];
    const markTaken = list ? list.querySelectorAll('[data-action="mark-taken"]') : [];
    const focused = document.activeElement;
    return {
      dayCount: days.length,
      itemCount: items.length,
      sectionHeaders: headers,
      emptyCount: empty.length,
      emptyText: list ? Array.from(empty).map((node) => String(node.textContent || "").replace(/\\s+/g, " ").trim()).slice(0, 3) : [],
      markTakenCount: markTaken.length,
      htmlHasSectionHeaders: headers.length > 0,
      ownerPresent: typeof window.renderCalendar === "function",
      text: list ? String(list.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 220) : "",
      focus: {
        tag: focused ? focused.tagName : null,
        action: focused && focused.getAttribute ? focused.getAttribute("data-action") : null,
        className: focused ? String(focused.className || "") : "",
        text: focused ? String(focused.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 80) : "",
      },
    };
  })()`);
}

async function focusSelector(cdp, selector) {
  const focused = await cdp.evaluate(`(() => {
    const selectors = ${JSON.stringify(selector)}.split(",").map((part) => part.trim()).filter(Boolean);
    let node = null;
    let used = null;
    for (const part of selectors) {
      const candidate = document.querySelector(part);
      if (candidate && typeof candidate.focus === "function" && candidate.tabIndex >= 0) {
        node = candidate;
        used = part;
        break;
      }
    }
    if (!node) {
      return { ok: false, selector: ${JSON.stringify(selector)} };
    }
    node.focus();
    return {
      ok: document.activeElement === node,
      action: node.getAttribute("data-action"),
      selector: used,
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

    await loadEmpty(cdp, view);
    await showView(cdp, "schedule-view");
    const scheduleEmpty = await readScheduleState(cdp);
    const scheduleEmptyName = `${label}-${view.name}-schedule-empty.png`;
    const scheduleEmptyShot = await screenshotViewport(cdp, path.join(OUT_DIR, scheduleEmptyName), [
      "#schedule-view",
      "#reminder-list",
    ]);
    row.shots.scheduleEmpty = {
      file: scheduleEmptyName,
      pixels: `${scheduleEmptyShot.width}x${scheduleEmptyShot.height}`,
      state: scheduleEmpty,
    };
    console.log(`wrote ${scheduleEmptyName} (${scheduleEmptyShot.width}x${scheduleEmptyShot.height} ${scheduleEmptyShot.bytes} bytes)`);

    await showView(cdp, "calendar-view");
    const calendarEmpty = await readCalendarState(cdp);
    const calendarEmptyName = `${label}-${view.name}-calendar-empty.png`;
    const calendarEmptyShot = await screenshotViewport(cdp, path.join(OUT_DIR, calendarEmptyName), [
      "#calendar-view",
      "#calendar-list",
    ]);
    row.shots.calendarEmpty = {
      file: calendarEmptyName,
      pixels: `${calendarEmptyShot.width}x${calendarEmptyShot.height}`,
      state: calendarEmpty,
    };
    console.log(`wrote ${calendarEmptyName} (${calendarEmptyShot.width}x${calendarEmptyShot.height} ${calendarEmptyShot.bytes} bytes)`);

    await loadSeeded(cdp, view, "populated");
    await showView(cdp, "schedule-view");
    const schedulePopulated = await readScheduleState(cdp);
    const schedulePopulatedName = `${label}-${view.name}-schedule-populated.png`;
    const schedulePopulatedShot = await screenshotViewport(cdp, path.join(OUT_DIR, schedulePopulatedName), [
      "#reminder-list",
      "#schedule-view",
    ]);
    row.shots.schedulePopulated = {
      file: schedulePopulatedName,
      pixels: `${schedulePopulatedShot.width}x${schedulePopulatedShot.height}`,
      state: schedulePopulated,
    };
    console.log(
      `wrote ${schedulePopulatedName} (${schedulePopulatedShot.width}x${schedulePopulatedShot.height} ${schedulePopulatedShot.bytes} bytes)`
    );

    await showView(cdp, "calendar-view");
    const calendarPopulated = await readCalendarState(cdp);
    const calendarPopulatedName = `${label}-${view.name}-calendar-populated.png`;
    const calendarPopulatedShot = await screenshotViewport(cdp, path.join(OUT_DIR, calendarPopulatedName), [
      "#calendar-list",
      "#calendar-view",
    ]);
    row.shots.calendarPopulated = {
      file: calendarPopulatedName,
      pixels: `${calendarPopulatedShot.width}x${calendarPopulatedShot.height}`,
      state: calendarPopulated,
    };
    console.log(
      `wrote ${calendarPopulatedName} (${calendarPopulatedShot.width}x${calendarPopulatedShot.height} ${calendarPopulatedShot.bytes} bytes)`
    );

    await loadSeeded(cdp, view, "dates");
    await showView(cdp, "calendar-view");
    const calendarDates = await readCalendarState(cdp);
    const calendarDatesName = `${label}-${view.name}-calendar-dates.png`;
    const calendarDatesShot = await screenshotViewport(cdp, path.join(OUT_DIR, calendarDatesName), [
      "#calendar-list",
      "#calendar-view",
    ]);
    row.shots.calendarDates = {
      file: calendarDatesName,
      pixels: `${calendarDatesShot.width}x${calendarDatesShot.height}`,
      state: calendarDates,
    };
    console.log(`wrote ${calendarDatesName} (${calendarDatesShot.width}x${calendarDatesShot.height} ${calendarDatesShot.bytes} bytes)`);

    if (label === "after") {
      await loadSeeded(cdp, view, "populated");
      await showView(cdp, "schedule-view");
      const markSelector = '#reminder-list [data-action="mark-taken"], #reminder-list [data-action="test-reminder"]';
      const markFocus = await focusSelector(cdp, markSelector);
      const markFocusName = `${label}-${view.name}-focus-mark-taken.png`;
      const markFocusShot = await screenshotViewport(cdp, path.join(OUT_DIR, markFocusName), ["#reminder-list", "#schedule-view"]);
      row.shots.focusMarkTaken = {
        file: markFocusName,
        pixels: `${markFocusShot.width}x${markFocusShot.height}`,
        focus: markFocus,
        state: await readScheduleState(cdp),
      };
      console.log(`wrote ${markFocusName} (${markFocusShot.width}x${markFocusShot.height} ${markFocusShot.bytes} bytes)`);

      await showView(cdp, "calendar-view");
      const calSelector = '#calendar-list [data-action="mark-taken"], #calendar-list .calendar-item, #calendar-list .calendar-day';
      const calFocus = await focusSelector(cdp, calSelector);
      const calFocusName = `${label}-${view.name}-focus-calendar.png`;
      const calFocusShot = await screenshotViewport(cdp, path.join(OUT_DIR, calFocusName), ["#calendar-list", "#calendar-view"]);
      row.shots.focusCalendar = {
        file: calFocusName,
        pixels: `${calFocusShot.width}x${calFocusShot.height}`,
        focus: calFocus,
        state: await readCalendarState(cdp),
      };
      console.log(`wrote ${calFocusName} (${calFocusShot.width}x${calFocusShot.height} ${calFocusShot.bytes} bytes)`);
    }

    record.viewports.push(row);
  }

  const stateFile = label === "after" ? "schedule-state.json" : "schedule-state-before.json";
  fs.writeFileSync(path.join(OUT_DIR, stateFile), `${JSON.stringify(record, null, 2)}\n`);
  console.log(`wrote ${stateFile}`);
}

async function main() {
  const shotIdx = process.argv.indexOf("--shots");
  const shotLabel = shotIdx >= 0 ? process.argv[shotIdx + 1] : null;
  if (shotLabel !== "before" && shotLabel !== "after") {
    throw new Error("usage: node scripts/ux/stage6c-b6-schedule-chrome-capture.js --shots before|after");
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
