#!/usr/bin/env node
"use strict";

/**
 * Vercel + Neon port of the reminder backend.
 * Hits the Express app and the Vercel Function entrypoints against PGlite,
 * including a new-client restart that still cancels the previous OneSignal ids.
 */

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");
const { setQueryExecutor } = require("../../backend/db");
const { app, PRODUCTION_ORIGIN } = require("../../backend/app");

const ROOT = path.resolve(__dirname, "../..");

process.env.ONESIGNAL_APP_ID = "test-onesignal-app";
process.env.ONESIGNAL_API_KEY = "test-onesignal-key";
process.env.PUBLIC_APP_URL = PRODUCTION_ORIGIN;
delete process.env.DATABASE_URL;
delete process.env.DATABASE_URL_UNPOOLED;

let passed = 0;
let failed = 0;
const tempDirs = [];
const originalFetch = global.fetch;

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
  const ok = actual === expected;
  assert(ok, ok ? message : `${message} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
}

function listen(handler) {
  const server = http.createServer(handler);
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        base: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

function request(base, requestPath, options = {}) {
  const url = new URL(requestPath, base);
  const payload = options.body === undefined ? null : JSON.stringify(options.body);
  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method: options.method || "GET",
        headers: {
          ...(payload
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
              }
            : {}),
          ...(options.headers || {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          if (text) {
            try {
              json = JSON.parse(text);
            } catch {
              json = null;
            }
          }
          resolve({
            status: res.statusCode,
            json,
            headers: res.headers,
          });
        });
      }
    );
    req.on("error", reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function scheduleBody(userId) {
  return {
    userId,
    subscriptionId: "sub-1",
    schedules: [
      {
        id: "sched-1",
        name: "Reminder",
        startDate: "2030-01-01",
        reminderTime: "09:00",
        intervalDays: 7,
        nextSendAt: "2030-01-01T09:00:00.000Z",
        fill: {
          peptideName: "Example",
          fillName: "Example",
          waterMl: 2,
          doseMg: 0.25,
          doseMl: 0.1,
          vialMg: 5,
          unitLabel: "mg",
        },
      },
    ],
  };
}

function installFetchMock(calls) {
  global.fetch = async (url, options = {}) => {
    const method = options.method || "GET";
    const body = options.body ? JSON.parse(options.body) : null;
    const id = `os-${calls.length + 1}`;
    calls.push({ url: String(url), method, body, id });
    if (method === "DELETE") {
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => "",
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ id }),
      text: async () => "",
    };
  };
}

async function openDb(dir) {
  const db = new PGlite(dir);
  await db.waitReady;
  setQueryExecutor(async (text, params) => db.query(text, params));
  return db;
}

async function testStaticContract() {
  console.log("Hosting contract files");
  const config = fs.readFileSync(path.join(ROOT, "config.js"), "utf8");
  assert(config.includes(PRODUCTION_ORIGIN), "config.js points at the Vercel production origin");
  assert(!config.includes("onrender.com"), "config.js no longer points at Render");
  assert(!fs.existsSync(path.join(ROOT, "render.yaml")), "render.yaml is removed");
  assert(!fs.existsSync(path.join(ROOT, ".github/workflows/keep-alive.yml")), "Render keep-alive workflow is removed");

  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  assert(vercel.framework === null, "vercel.json keeps framework null so the static root is served");
  assert(
    vercel.rewrites.some((rule) => rule.source === "/reminders/sync" && rule.destination === "/api/reminders/sync"),
    "legacy /reminders/sync rewrites to the function"
  );

  for (const rel of ["app.js", "runtime-fixes.js"]) {
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    assert(src.includes('}/reminders/sync`'), `${rel} still posts to backendBaseUrl /reminders/sync`);
  }
}

async function testHealthAndCors(expressServer, vercelHealth) {
  console.log("Health and CORS");
  for (const pathName of ["/health", "/api/health"]) {
    const res = await request(expressServer.base, pathName);
    assertEqual(res.status, 200, `${pathName} status`);
    assertEqual(res.json.ok, true, `${pathName} ok`);
    assertEqual(res.json.onesignalConfigured, true, `${pathName} reports OneSignal configured`);
    assert(typeof res.json.time === "string", `${pathName} includes time`);
  }

  const vercelRes = await request(vercelHealth.base, "/api/health", {
    headers: { Origin: "https://localhost" },
  });
  assertEqual(vercelRes.status, 200, "Vercel health function returns JSON");
  assertEqual(vercelRes.json.ok, true, "Vercel health function ok");
  assertEqual(
    vercelRes.headers["access-control-allow-origin"],
    "https://localhost",
    "Capacitor https://localhost is allowed"
  );

  const pages = await request(expressServer.base, "/health", {
    headers: { Origin: "https://lotustemplar.github.io" },
  });
  assertEqual(pages.headers["access-control-allow-origin"], "https://lotustemplar.github.io", "GitHub Pages origin is allowed");

  const preview = await request(expressServer.base, "/health", {
    headers: { Origin: "https://peptide-calculator-v2-git-example-lotustemplars-projects.vercel.app" },
  });
  assert(
    preview.headers["access-control-allow-origin"]
      === "https://peptide-calculator-v2-git-example-lotustemplars-projects.vercel.app",
    "Vercel preview origin is allowed"
  );

  const blocked = await request(expressServer.base, "/health", {
    headers: { Origin: "https://evil.example" },
  });
  assertEqual(blocked.status, 200, "disallowed origin still gets the health JSON");
  assert(blocked.headers["access-control-allow-origin"] === undefined, "disallowed origin is not reflected");

  const preflight = await request(expressServer.base, "/reminders/sync", {
    method: "OPTIONS",
    headers: { Origin: "capacitor://localhost" },
  });
  assertEqual(preflight.status, 204, "CORS preflight succeeds");
  assertEqual(preflight.headers["access-control-allow-origin"], "capacitor://localhost", "Capacitor scheme is allowed");
}

async function testValidationAndPush(expressServer, vercelPush) {
  console.log("Validation and test-push");
  const missing = await request(expressServer.base, "/reminders/sync", {
    method: "POST",
    body: { schedules: [] },
  });
  assertEqual(missing.status, 400, "sync without userId is 400");
  assertEqual(missing.json.ok, false, "sync without userId is not ok");

  const pushMissing = await request(vercelPush.base, "/api/test-push", {
    method: "POST",
    body: {},
  });
  assertEqual(pushMissing.status, 400, "test-push without a target is 400");

  const savedApp = process.env.ONESIGNAL_APP_ID;
  const savedKey = process.env.ONESIGNAL_API_KEY;
  delete process.env.ONESIGNAL_APP_ID;
  delete process.env.ONESIGNAL_API_KEY;
  const unconfigured = await request(expressServer.base, "/test-push", {
    method: "POST",
    body: { externalId: "user-a" },
  });
  assertEqual(unconfigured.status, 503, "test-push without OneSignal is 503");
  process.env.ONESIGNAL_APP_ID = savedApp;
  process.env.ONESIGNAL_API_KEY = savedKey;

  const calls = [];
  installFetchMock(calls);
  const sent = await request(expressServer.base, "/api/test-push", {
    method: "POST",
    body: { subscriptionId: "sub-9", title: "Ping", message: "Hello" },
  });
  assertEqual(sent.status, 200, "test-push returns 200");
  assertEqual(sent.json.ok, true, "test-push ok");
  assert(typeof sent.json.notificationId === "string", "test-push returns a notification id");
  assertEqual(calls.length, 1, "test-push calls OneSignal once");
  assertEqual(calls[0].method, "POST", "test-push uses POST");
  assertEqual(calls[0].body.include_subscription_ids[0], "sub-9", "test-push targets the subscription id");
}

async function testRestartPersistence(expressServer, vercelDebug, vercelSync) {
  console.log("Restart persistence");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fitgen-pg-"));
  tempDirs.push(dir);
  const calls = [];
  installFetchMock(calls);

  const first = await openDb(dir);
  const userId = "peptide-calculator-v2-user-restart";
  const synced = await request(expressServer.base, "/reminders/sync", {
    method: "POST",
    body: scheduleBody(userId),
  });
  assertEqual(synced.status, 200, "first sync status");
  assertEqual(synced.json.scheduledCount, 26, "first sync pre-schedules 26 occurrences");
  assertEqual(synced.json.userId, userId, "first sync echoes userId");
  const created = calls.filter((call) => call.method === "POST");
  assertEqual(created.length, 26, "first sync creates 26 OneSignal notifications");
  assertEqual(
    created[0].body.contents.en,
    "Time for 0.25 mg — draw 0.1 mL from the constituted vial.",
    "notification message formatting is unchanged"
  );
  const firstIds = created.map((call) => call.id);
  assert(created.every((call) => call.body.send_after), "scheduled notifications include send_after");

  const beforeClose = await request(expressServer.base, `/debug/${encodeURIComponent(userId)}`);
  assertEqual(beforeClose.json.scheduledCount, 26, "debug lists the stored mapping");

  await first.close();
  calls.length = 0;
  const second = await openDb(dir);

  const persisted = await request(vercelDebug.base, `/api/debug/${encodeURIComponent(userId)}`);
  assertEqual(persisted.status, 200, "new client debug status");
  assertEqual(persisted.json.scheduledCount, 26, "new client still sees the mapping");
  const persistedIds = persisted.json.scheduled.map((row) => row.onesignal_id).sort();
  assertEqual(persistedIds.join(","), firstIds.slice().sort().join(","), "persisted OneSignal ids match the first sync");

  const resynced = await request(expressServer.base, "/api/reminders/sync", {
    method: "POST",
    body: scheduleBody(userId),
  });
  assertEqual(resynced.status, 200, "second sync status");
  assertEqual(resynced.json.scheduledCount, 26, "second sync schedules 26 replacements");
  const cancelled = calls.filter((call) => call.method === "DELETE").map((call) => call.url);
  assertEqual(cancelled.length, 26, "second sync cancels the previous OneSignal ids");
  for (const id of persistedIds) {
    assert(
      cancelled.some((url) => url.includes(`/notifications/${id}?`)),
      `cancelled previous id ${id}`
    );
  }

  const after = await request(expressServer.base, `/api/debug/${encodeURIComponent(userId)}`);
  const afterIds = new Set(after.json.scheduled.map((row) => row.onesignal_id));
  assertEqual(after.json.scheduledCount, 26, "mapping is replaced, not duplicated");
  assert(persistedIds.every((id) => !afterIds.has(id)), "old OneSignal ids are gone from Postgres");

  const savedApp = process.env.ONESIGNAL_APP_ID;
  const savedKey = process.env.ONESIGNAL_API_KEY;
  delete process.env.ONESIGNAL_APP_ID;
  delete process.env.ONESIGNAL_API_KEY;
  calls.length = 0;
  const skipped = await request(expressServer.base, "/reminders/sync", {
    method: "POST",
    body: { userId, schedules: [] },
  });
  assertEqual(skipped.status, 200, "unconfigured sync still succeeds");
  assertEqual(skipped.json.note, "OneSignal not configured — notifications skipped", "unconfigured sync keeps the skip note");
  assertEqual(calls.filter((call) => call.method === "DELETE").length, 26, "unconfigured sync still cancels stored ids");
  const cleared = await request(expressServer.base, `/debug/${encodeURIComponent(userId)}`);
  assertEqual(cleared.json.scheduledCount, 0, "unconfigured sync deletes the stored mapping");
  process.env.ONESIGNAL_APP_ID = savedApp;
  process.env.ONESIGNAL_API_KEY = savedKey;

  const viaFunction = await request(vercelSync.base, "/api/reminders/sync", {
    method: "POST",
    body: { userId: "function-only", schedules: [] },
  });
  assertEqual(viaFunction.status, 200, "Vercel sync function accepts an empty schedule list");
  assertEqual(viaFunction.json.scheduledCount, 0, "Vercel sync function schedules nothing when the list is empty");

  await second.close();
}

async function main() {
  const expressServer = await listen(app);
  const vercelHealth = await listen(require("../../api/health"));
  const vercelPush = await listen(require("../../api/test-push"));
  const vercelDebug = await listen(require("../../api/debug/[userId]"));
  const vercelSync = await listen(require("../../api/reminders/sync"));
  try {
    await testStaticContract();
    await testHealthAndCors(expressServer, vercelHealth);
    await testValidationAndPush(expressServer, vercelPush);
    await testRestartPersistence(expressServer, vercelDebug, vercelSync);
  } finally {
    global.fetch = originalFetch;
    await Promise.all([
      expressServer.close(),
      vercelHealth.close(),
      vercelPush.close(),
      vercelDebug.close(),
      vercelSync.close(),
    ]);
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  console.log(`vercel reminders: ${passed} passed, ${failed} failed`);
  if (failed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
