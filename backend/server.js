require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");

const PORT = Number(process.env.PORT || 8787);
const DATABASE_PATH = process.env.DATABASE_PATH || "./data/reminders.db";
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || "";
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY || "";
const ONESIGNAL_API_BASE = "https://api.onesignal.com";
const ONESIGNAL_AUTH_HEADER = `key ${ONESIGNAL_API_KEY}`;

// Number of future occurrences to pre-schedule with OneSignal.
// 26 = roughly 6 months of weekly doses, or ~4 weeks of daily doses.
const MAX_SCHEDULED_OCCURRENCES = 26;
const DAY_MS = 24 * 60 * 60 * 1000;

const resolvedDbPath = path.resolve(process.cwd(), DATABASE_PATH);
fs.mkdirSync(path.dirname(resolvedDbPath), { recursive: true });

const db = new Database(resolvedDbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS scheduled_notifications (
    onesignal_id TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    schedule_id  TEXT NOT NULL,
    send_at      TEXT NOT NULL,
    created_at   TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sn_user_id     ON scheduled_notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_sn_schedule_id ON scheduled_notifications(schedule_id);
`);

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    onesignalConfigured: Boolean(ONESIGNAL_APP_ID && ONESIGNAL_API_KEY),
    time: new Date().toISOString(),
  });
});

// ── Debug: see what's stored for a user ──────────────────────────────────────
app.get("/debug/:userId", (req, res) => {
  const rows = db
    .prepare(
      "SELECT onesignal_id, schedule_id, send_at FROM scheduled_notifications WHERE user_id = ? ORDER BY send_at"
    )
    .all(req.params.userId);

  res.json({
    ok: true,
    serverTime: new Date().toISOString(),
    onesignalConfigured: Boolean(ONESIGNAL_APP_ID && ONESIGNAL_API_KEY),
    scheduledCount: rows.length,
    scheduled: rows,
  });
});

// ── Sync: cancel old → pre-schedule new occurrences with OneSignal ────────────
app.post("/reminders/sync", async (req, res) => {
  try {
    const payload = validateSyncPayload(req.body);

    // Cancel every previously scheduled OneSignal notification for this user
    const existing = db
      .prepare("SELECT onesignal_id FROM scheduled_notifications WHERE user_id = ?")
      .all(payload.userId);

    for (const { onesignal_id } of existing) {
      await cancelOneSignalNotification(onesignal_id).catch(() => {});
    }
    db.prepare("DELETE FROM scheduled_notifications WHERE user_id = ?").run(payload.userId);

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
      return res.json({ ok: true, note: "OneSignal not configured — notifications skipped" });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    let scheduled = 0;

    for (const schedule of payload.schedules) {
      const occurrences = computeNextOccurrences(
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

          db.prepare(
            "INSERT INTO scheduled_notifications (onesignal_id, user_id, schedule_id, send_at, created_at) VALUES (?, ?, ?, ?, ?)"
          ).run(notifId, payload.userId, schedule.id, sendAt.toISOString(), nowIso);

          scheduled++;
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
});

// ── Test push: fire a push RIGHT NOW for debugging ────────────────────────────
app.post("/test-push", async (req, res) => {
  try {
    const { subscriptionId, externalId, title, message } = req.body || {};

    if (!subscriptionId && !externalId) {
      return res.status(400).json({ ok: false, error: "subscriptionId or externalId required" });
    }

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
      return res.status(503).json({ ok: false, error: "OneSignal not configured on this server" });
    }

    const notifId = await createOneSignalNotification({
      subscriptionId,
      externalId,
      title: title || "FitGen Test Push",
      message: message || "If you see this, push notifications are working!",
      sendAt: null, // send immediately
    });

    console.log(`[test-push] sent ${notifId} → ${subscriptionId || externalId}`);
    res.json({ ok: true, notificationId: notifId });
  } catch (err) {
    console.error("[test-push] error:", err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Peptide Calculator backend listening on port ${PORT}`);
});

// ── OneSignal helpers ─────────────────────────────────────────────────────────
async function createOneSignalNotification({ subscriptionId, externalId, title, message, sendAt }) {
  const payload = {
    app_id: ONESIGNAL_APP_ID,
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

  const res = await fetch(`${ONESIGNAL_API_BASE}/notifications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: ONESIGNAL_AUTH_HEADER,
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
  const res = await fetch(
    `${ONESIGNAL_API_BASE}/notifications/${notifId}?app_id=${encodeURIComponent(ONESIGNAL_APP_ID)}`,
    {
      method: "DELETE",
      headers: { Authorization: ONESIGNAL_AUTH_HEADER },
    }
  );

  // 404 = already delivered, that's fine
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Cancel failed ${res.status}: ${text}`);
  }
}

// ── Schedule math ─────────────────────────────────────────────────────────────
function computeNextOccurrences(startDate, reminderTime, intervalDays, fromDate, count) {
  // Parse start as LOCAL time on the client — the ISO string already encodes UTC offset
  // because the client sent nextSendAt in ISO format. Fall back to manual parse if needed.
  const start = parseDateTimeAsUTC(startDate, reminderTime);
  if (!start) return [];

  const intervalMs = Math.max(1, Number(intervalDays) || 1) * DAY_MS;
  const occurrences = [];

  // Find the first occurrence strictly after fromDate
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

// Treat the date+time string as UTC (since that's how JS clients encode local times
// when they use new Date(year, month-1, day, h, m).toISOString())
// Actually: the client sends nextSendAt as a proper ISO string already.
// startDate/reminderTime are only used as fallback when nextSendAt is missing.
// For safety, append 'Z' only if no timezone is present.
function parseDateTimeAsUTC(dateString, timeString) {
  try {
    // Try ISO first
    const iso = `${dateString}T${timeString || "09:00"}:00Z`;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

// ── Payload validation ────────────────────────────────────────────────────────
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
