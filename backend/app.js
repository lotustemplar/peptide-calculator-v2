"use strict";

const express = require("express");
const { ensureSchema, query } = require("./db");

const ONESIGNAL_API_BASE = "https://api.onesignal.com";

// Number of future occurrences to pre-schedule with OneSignal.
// 26 = roughly 6 months of weekly doses, or ~4 weeks of daily doses.
const MAX_SCHEDULED_OCCURRENCES = 26;
const DAY_MS = 24 * 60 * 60 * 1000;

const PRODUCTION_ORIGIN = "https://peptide-calculator-v2-snowy.vercel.app";

function oneSignalConfig() {
  const appId = process.env.ONESIGNAL_APP_ID || "";
  const apiKey = process.env.ONESIGNAL_API_KEY || "";
  return {
    appId,
    apiKey,
    configured: Boolean(appId && apiKey),
    authHeader: `key ${apiKey}`,
  };
}

function isProjectVercelHost(hostname) {
  if (hostname === "peptide-calculator-v2.vercel.app") {
    return true;
  }
  return hostname.startsWith("peptide-calculator-v2-") && hostname.endsWith(".vercel.app");
}

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  const publicApp = process.env.PUBLIC_APP_URL || "";
  if (publicApp) {
    try {
      if (new URL(publicApp).origin === url.origin) {
        return true;
      }
    } catch {
      // Ignore a malformed PUBLIC_APP_URL and keep the built-in allowlist.
    }
  }

  if (
    (url.protocol === "capacitor:" || url.protocol === "ionic:")
    && url.hostname === "localhost"
  ) {
    return true;
  }

  const localHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (localHost && (url.protocol === "http:" || url.protocol === "https:")) {
    return true;
  }

  if (url.protocol === "https:" && url.hostname === "lotustemplar.github.io") {
    return true;
  }

  if (url.protocol === "https:" && isProjectVercelHost(url.hostname)) {
    return true;
  }

  return false;
}

function headerValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function applyCors(req, res) {
  const origin = headerValue(req.headers && req.headers.origin);
  if (!origin || !isAllowedOrigin(origin)) {
    return;
  }
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function ensureResponseHelpers(res) {
  if (typeof res.status !== "function") {
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
  }
  if (typeof res.json !== "function") {
    res.json = (payload) => {
      if (typeof res.getHeader !== "function" || !res.getHeader("Content-Type")) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      }
      res.end(JSON.stringify(payload));
    };
  }
}

async function ensureJsonBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return;
  }
  if (typeof req.body === "string" || Buffer.isBuffer(req.body)) {
    return;
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  req.body = chunks.length ? Buffer.concat(chunks) : {};
}

function withHttp(handler) {
  return async function httpHandler(req, res) {
    ensureResponseHelpers(res);
    applyCors(req, res);
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        await ensureJsonBody(req);
      }
      await handler(req, res);
    } catch (err) {
      console.error("[http] error:", err.message);
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: "Internal error" });
      }
    }
  };
}

function readJsonBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === "string" && req.body) {
    return JSON.parse(req.body);
  }
  if (Buffer.isBuffer(req.body)) {
    return JSON.parse(req.body.toString("utf8"));
  }
  return {};
}

function readUserId(req) {
  if (req.params && req.params.userId) {
    return String(req.params.userId);
  }
  if (req.query && req.query.userId) {
    return String(req.query.userId);
  }
  const raw = req.url || "";
  const match = raw.match(/\/debug\/([^/?]+)/);
  if (!match) {
    return "";
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function methodNotAllowed(res) {
  res.status(405).json({ ok: false, error: "Method not allowed" });
}

async function handleHealth(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    methodNotAllowed(res);
    return;
  }
  const onesignal = oneSignalConfig();
  res.json({
    ok: true,
    onesignalConfigured: onesignal.configured,
    time: new Date().toISOString(),
  });
}

async function handleDebug(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    methodNotAllowed(res);
    return;
  }
  const userId = readUserId(req);
  await ensureSchema();
  const rows = await query(
    "SELECT onesignal_id, schedule_id, send_at FROM scheduled_notifications WHERE user_id = $1 ORDER BY send_at",
    [userId]
  );
  const onesignal = oneSignalConfig();
  res.json({
    ok: true,
    serverTime: new Date().toISOString(),
    onesignalConfigured: onesignal.configured,
    scheduledCount: rows.length,
    scheduled: rows,
  });
}

async function handleSync(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(res);
    return;
  }
  try {
    const payload = validateSyncPayload(readJsonBody(req));
    await ensureSchema();

    const existing = await query(
      "SELECT onesignal_id FROM scheduled_notifications WHERE user_id = $1",
      [payload.userId]
    );

    for (const { onesignal_id } of existing) {
      await cancelOneSignalNotification(onesignal_id).catch(() => {});
    }
    await query("DELETE FROM scheduled_notifications WHERE user_id = $1", [payload.userId]);

    const onesignal = oneSignalConfig();
    if (!onesignal.configured) {
      res.json({ ok: true, note: "OneSignal not configured — notifications skipped" });
      return;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    let scheduled = 0;

    for (const schedule of payload.schedules) {
      const occurrences = schedule.nextSendAt
        ? computeOccurrencesFromSeed(schedule.nextSendAt, schedule.intervalDays, now, MAX_SCHEDULED_OCCURRENCES)
        : computeNextOccurrences(
            schedule.startDate,
            schedule.reminderTime,
            schedule.intervalDays,
            now,
            MAX_SCHEDULED_OCCURRENCES
          );

      for (const sendAt of occurrences) {
        try {
          const notifId = await createOneSignalNotification({
            subscriptionId: schedule.subscriptionId || payload.subscriptionId,
            externalId: payload.userId,
            title: `${schedule.fill.peptideName} Reminder`,
            message:
              `Time for ${formatNumber(schedule.fill.doseMg)} ${schedule.fill.unitLabel || "mg"} — ` +
              `draw ${formatDrawNumber(schedule.fill.doseMl)} mL from the constituted vial.`,
            sendAt,
          });

          await query(
            "INSERT INTO scheduled_notifications (onesignal_id, user_id, schedule_id, send_at, created_at) VALUES ($1, $2, $3, $4, $5)",
            [notifId, payload.userId, schedule.id, sendAt.toISOString(), nowIso]
          );

          scheduled += 1;
        } catch (err) {
          console.error("Failed to schedule occurrence:", err.message);
        }
      }
    }

    console.log(
      `[sync] userId=${payload.userId} schedules=${payload.schedules.length} notificationsScheduled=${scheduled}`
    );

    res.json({
      ok: true,
      scheduledCount: scheduled,
      userId: payload.userId,
    });
  } catch (err) {
    console.error("[sync] error:", err.message);
    res.status(400).json({ ok: false, error: err.message });
  }
}

async function handleTestPush(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(res);
    return;
  }
  try {
    const body = readJsonBody(req);
    const { subscriptionId, externalId, title, message } = body || {};

    if (!subscriptionId && !externalId) {
      res.status(400).json({ ok: false, error: "subscriptionId or externalId required" });
      return;
    }

    const onesignal = oneSignalConfig();
    if (!onesignal.configured) {
      res.status(503).json({ ok: false, error: "OneSignal not configured on this server" });
      return;
    }

    const notifId = await createOneSignalNotification({
      subscriptionId,
      externalId,
      title: title || "FitGen Test Push",
      message: message || "If you see this, push notifications are working!",
      sendAt: null,
    });

    console.log(`[test-push] sent ${notifId} → ${subscriptionId || externalId}`);
    res.json({ ok: true, notificationId: notifId });
  } catch (err) {
    console.error("[test-push] error:", err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
}

function createApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use((req, res, next) => {
    applyCors(req, res);
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  const api = express.Router();
  api.get("/health", (req, res, next) => {
    handleHealth(req, res).catch(next);
  });
  api.get("/debug/:userId", (req, res, next) => {
    handleDebug(req, res).catch(next);
  });
  api.post("/reminders/sync", (req, res, next) => {
    handleSync(req, res).catch(next);
  });
  api.post("/test-push", (req, res, next) => {
    handleTestPush(req, res).catch(next);
  });

  app.use(api);
  app.use("/api", api);

  app.use((err, _req, res, _next) => {
    if (res.headersSent) {
      return;
    }
    const status = Number(err.status || err.statusCode);
    if (status >= 400 && status < 500) {
      res.status(status).json({ ok: false, error: err.message });
      return;
    }
    console.error("[http] error:", err.message);
    res.status(500).json({ ok: false, error: "Internal error" });
  });

  return app;
}

const app = createApp();

async function createOneSignalNotification({ subscriptionId, externalId, title, message, sendAt }) {
  const onesignal = oneSignalConfig();
  const payload = {
    app_id: onesignal.appId,
    target_channel: "push",
    headings: { en: title },
    contents: { en: message },
  };

  if (sendAt) {
    payload.send_after = sendAt.toISOString();
  }

  if (subscriptionId) {
    payload.include_subscription_ids = [subscriptionId];
  } else if (externalId) {
    payload.include_aliases = { external_id: [externalId] };
    payload.target_channel = "push";
  } else {
    throw new Error("No targeting info provided");
  }

  const res = await globalThis.fetch(`${ONESIGNAL_API_BASE}/notifications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: onesignal.authHeader,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok || data.errors) {
    throw new Error(JSON.stringify(data.errors || data));
  }

  return data.id;
}

async function cancelOneSignalNotification(notifId) {
  const onesignal = oneSignalConfig();
  const res = await globalThis.fetch(
    `${ONESIGNAL_API_BASE}/notifications/${notifId}?app_id=${encodeURIComponent(onesignal.appId)}`,
    {
      method: "DELETE",
      headers: { Authorization: onesignal.authHeader },
    }
  );

  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Cancel failed ${res.status}: ${text}`);
  }
}

function computeOccurrencesFromSeed(nextSendAtIso, intervalDays, fromDate, count) {
  const seed = new Date(nextSendAtIso);
  if (Number.isNaN(seed.getTime())) {
    return [];
  }

  const intervalMs = Math.max(1, Number(intervalDays) || 1) * DAY_MS;
  const occurrences = [];
  let next = new Date(seed.getTime());

  while (next <= fromDate) {
    next = new Date(next.getTime() + intervalMs);
  }

  while (occurrences.length < count) {
    occurrences.push(new Date(next.getTime()));
    next = new Date(next.getTime() + intervalMs);
  }

  return occurrences;
}

function computeNextOccurrences(startDate, reminderTime, intervalDays, fromDate, count) {
  const start = parseDateTimeAsUTC(startDate, reminderTime);
  if (!start) return [];

  const intervalMs = Math.max(1, Number(intervalDays) || 1) * DAY_MS;
  const occurrences = [];
  let next = new Date(start.getTime());

  while (next <= fromDate) {
    next = new Date(next.getTime() + intervalMs);
  }

  while (occurrences.length < count) {
    occurrences.push(new Date(next.getTime()));
    next = new Date(next.getTime() + intervalMs);
  }

  return occurrences;
}

function parseDateTimeAsUTC(dateString, timeString) {
  try {
    const iso = `${dateString}T${timeString || "09:00"}:00Z`;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function validateSyncPayload(body) {
  if (!body || typeof body !== "object") throw new Error("Payload must be an object.");
  if (!body.userId || typeof body.userId !== "string") throw new Error("userId is required.");
  if (!Array.isArray(body.schedules)) throw new Error("schedules must be an array.");

  return {
    userId: body.userId,
    subscriptionId: body.subscriptionId ? String(body.subscriptionId) : null,
    schedules: body.schedules.map((s) => {
      if (!s || !s.id || !s.startDate || !s.reminderTime) {
        throw new Error("Schedule missing required fields.");
      }
      if (!s.fill || typeof s.fill !== "object") throw new Error("Schedule fill is required.");
      return {
        id: String(s.id),
        name: String(s.name || "Reminder"),
        startDate: String(s.startDate),
        reminderTime: String(s.reminderTime),
        intervalDays: Number(s.intervalDays) || 7,
        nextSendAt: s.nextSendAt ? String(s.nextSendAt) : null,
        subscriptionId: s.subscriptionId ? String(s.subscriptionId) : null,
        fill: {
          peptideName: String(s.fill.peptideName || "Peptide"),
          fillName: String(s.fill.fillName || "Fill"),
          waterMl: Number(s.fill.waterMl) || 0,
          doseMg: Number(s.fill.doseMg) || 0,
          doseMl: Number(s.fill.doseMl) || 0,
          vialMg: Number(s.fill.vialMg) || 0,
          unitLabel: String(s.fill.unitLabel || "mg"),
        },
      };
    }),
  };
}

function formatNumber(v) {
  return Number(v).toFixed(2).replace(/\.00$/, "");
}

function formatDrawNumber(v) {
  return v >= 1
    ? Number(v).toFixed(2).replace(/\.00$/, "")
    : Number(v).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

module.exports = {
  PRODUCTION_ORIGIN,
  app,
  applyCors,
  createApp,
  handleDebug,
  handleHealth,
  handleSync,
  handleTestPush,
  isAllowedOrigin,
  withHttp,
};
