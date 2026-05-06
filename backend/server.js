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
const PUBLIC_APP_URL =
  process.env.PUBLIC_APP_URL || "https://lotustemplar.github.io/peptide-calculator-v2/";
const POLL_INTERVAL_MS = 10 * 1000;

const resolvedDbPath = path.resolve(process.cwd(), DATABASE_PATH);
fs.mkdirSync(path.dirname(resolvedDbPath), { recursive: true });

const db = new Database(resolvedDbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    reminder_time TEXT NOT NULL,
    interval_days INTEGER NOT NULL,
    peptide_name TEXT NOT NULL,
    fill_name TEXT NOT NULL,
    water_ml REAL NOT NULL,
    dose_mg REAL NOT NULL,
    dose_ml REAL NOT NULL,
    vial_mg REAL NOT NULL,
    next_send_at TEXT NOT NULL,
    last_sent_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
  CREATE INDEX IF NOT EXISTS idx_reminders_next_send_at ON reminders(next_send_at);
`);

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    onesignalConfigured: Boolean(ONESIGNAL_APP_ID && ONESIGNAL_API_KEY),
    time: new Date().toISOString(),
  });
});

app.post("/reminders/sync", (request, response) => {
  try {
    const payload = validateSyncPayload(request.body);
    const nowIso = new Date().toISOString();

    const replaceUserReminders = db.transaction(() => {
      db.prepare("DELETE FROM reminders WHERE user_id = ?").run(payload.userId);

      const insertReminder = db.prepare(`
        INSERT INTO reminders (
          id,
          user_id,
          name,
          start_date,
          reminder_time,
          interval_days,
          peptide_name,
          fill_name,
          water_ml,
          dose_mg,
          dose_ml,
          vial_mg,
          next_send_at,
          last_sent_at,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @user_id,
          @name,
          @start_date,
          @reminder_time,
          @interval_days,
          @peptide_name,
          @fill_name,
          @water_ml,
          @dose_mg,
          @dose_ml,
          @vial_mg,
          @next_send_at,
          NULL,
          @created_at,
          @updated_at
        )
      `);

      for (const schedule of payload.schedules) {
        const nextSendAt = computeNextOccurrence(
          schedule.startDate,
          schedule.reminderTime,
          schedule.intervalDays,
          new Date()
        );

        insertReminder.run({
          id: schedule.id,
          user_id: payload.userId,
          name: schedule.name,
          start_date: schedule.startDate,
          reminder_time: schedule.reminderTime,
          interval_days: schedule.intervalDays,
          peptide_name: schedule.fill.peptideName,
          fill_name: schedule.fill.fillName,
          water_ml: schedule.fill.waterMl,
          dose_mg: schedule.fill.doseMg,
          dose_ml: schedule.fill.doseMl,
          vial_mg: schedule.fill.vialMg,
          next_send_at: nextSendAt.toISOString(),
          created_at: nowIso,
          updated_at: nowIso,
        });
      }
    });

    replaceUserReminders();
    dispatchDueReminders().catch((error) => {
      console.error("Immediate reminder dispatch failed", error);
    });

    response.json({
      ok: true,
      syncedSchedules: payload.schedules.length,
      userId: payload.userId,
    });
  } catch (error) {
    response.status(400).json({
      ok: false,
      error: error.message || "Invalid payload",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Peptide Calculator backend listening on port ${PORT}`);
});

setInterval(() => {
  dispatchDueReminders().catch((error) => {
    console.error("Reminder dispatch failed", error);
  });
}, POLL_INTERVAL_MS);

dispatchDueReminders().catch((error) => {
  console.error("Initial reminder dispatch failed", error);
});

async function dispatchDueReminders() {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
    return;
  }

  const dueReminders = db
    .prepare(
      `
        SELECT *
        FROM reminders
        WHERE next_send_at <= ?
        ORDER BY next_send_at ASC
      `
    )
    .all(new Date().toISOString());

  for (const reminder of dueReminders) {
    await sendOneSignalNotification(reminder);

    const firedAt = new Date();
    const nextSendAt = computeNextOccurrence(
      reminder.start_date,
      reminder.reminder_time,
      reminder.interval_days,
      firedAt
    );

    db.prepare(
      `
        UPDATE reminders
        SET last_sent_at = ?,
            next_send_at = ?,
            updated_at = ?
        WHERE id = ?
      `
    ).run(firedAt.toISOString(), nextSendAt.toISOString(), firedAt.toISOString(), reminder.id);
  }
}

async function sendOneSignalNotification(reminder) {
  const title = `${reminder.peptide_name} Reminder`;
  const contents =
    `${reminder.fill_name}: take ${formatNumber(reminder.dose_mg)} mg and ` +
    `draw ${formatDrawNumber(reminder.dose_ml)} mL from the constituted vial.`;

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    target_channel: "push",
    include_aliases: {
      external_id: [reminder.user_id],
    },
    headings: {
      en: title,
    },
    contents: {
      en: contents,
    },
    data: {
      reminderId: reminder.id,
      peptideName: reminder.peptide_name,
      fillName: reminder.fill_name,
    },
    url: `${PUBLIC_APP_URL}?openReminder=${encodeURIComponent(reminder.id)}#calendar-card`,
  };

  const result = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${ONESIGNAL_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!result.ok) {
    const body = await result.text();
    throw new Error(`OneSignal request failed: ${result.status} ${body}`);
  }
}

function computeNextOccurrence(startDate, reminderTime, intervalDays, fromDate) {
  const start = combineDateAndTime(startDate, reminderTime);
  if (start > fromDate) {
    return start;
  }

  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
  const elapsed = fromDate.getTime() - start.getTime();
  const steps = Math.floor(elapsed / intervalMs) + 1;
  return new Date(start.getTime() + steps * intervalMs);
}

function combineDateAndTime(dateString, timeString) {
  const combined = new Date(`${dateString}T${timeString}:00`);
  if (Number.isNaN(combined.getTime())) {
    throw new Error(`Invalid reminder date or time: ${dateString} ${timeString}`);
  }
  return combined;
}

function validateSyncPayload(body) {
  if (!body || typeof body !== "object") {
    throw new Error("Payload must be an object.");
  }

  if (!body.userId || typeof body.userId !== "string") {
    throw new Error("userId is required.");
  }

  if (!Array.isArray(body.schedules)) {
    throw new Error("schedules must be an array.");
  }

  return {
    userId: body.userId,
    schedules: body.schedules.map(validateSchedule),
  };
}

function validateSchedule(schedule) {
  if (!schedule || typeof schedule !== "object") {
    throw new Error("Each schedule must be an object.");
  }

  if (!schedule.id || !schedule.name || !schedule.startDate || !schedule.reminderTime) {
    throw new Error("Schedule is missing required fields.");
  }

  if (!schedule.fill || typeof schedule.fill !== "object") {
    throw new Error("Schedule fill is required.");
  }

  return {
    id: String(schedule.id),
    name: String(schedule.name),
    startDate: String(schedule.startDate),
    reminderTime: String(schedule.reminderTime),
    intervalDays: Number(schedule.intervalDays),
    fill: {
      peptideName: String(schedule.fill.peptideName || "Unnamed Peptide"),
      fillName: String(schedule.fill.fillName || "Peptide Fill"),
      waterMl: Number(schedule.fill.waterMl),
      doseMg: Number(schedule.fill.doseMg),
      doseMl: Number(schedule.fill.doseMl),
      vialMg: Number(schedule.fill.vialMg),
    },
  };
}

function formatNumber(value) {
  return Number(value).toFixed(2).replace(/\.00$/, "");
}

function formatDrawNumber(value) {
  if (value >= 1) {
    return Number(value).toFixed(2).replace(/\.00$/, "");
  }

  return Number(value).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}
