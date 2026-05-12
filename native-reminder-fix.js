(function attachNativeReminderFix() {
  const SCHEDULES_STORAGE_KEY = "peptide-calculator-v2-schedules";
  let enableButton = null;
  let syncButton = null;
  let testButton = null;

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
      return;
    }
    fn();
  }

  function getNativeBridge() {
    return window.FitGenNativeReminders || null;
  }

  function safeParse(json, fallback) {
    try {
      return JSON.parse(json);
    } catch {
      return fallback;
    }
  }

  function readSchedules() {
    if (typeof state !== "undefined" && Array.isArray(state?.schedules)) {
      return state.schedules;
    }

    try {
      return JSON.parse(localStorage.getItem(SCHEDULES_STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function parseLocalDateTime(dateString, timeString) {
    if (typeof dateString === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split("-").map(Number);
      const [hours, minutes] = String(timeString || "09:00").split(":").map(Number);
      return new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0);
    }
    return new Date(`${dateString}T${timeString || "09:00"}:00`);
  }

  function computeNextSendAt(schedule) {
    const startAt = parseLocalDateTime(schedule.startDate, schedule.reminderTime);
    if (Number.isNaN(startAt.getTime())) {
      return null;
    }

    const intervalDays = Math.max(1, Number(schedule.intervalDays) || 1);
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
    let nextAt = new Date(startAt.getTime());
    while (nextAt.getTime() <= Date.now()) {
      nextAt = new Date(nextAt.getTime() + intervalMs);
    }
    return nextAt.toISOString();
  }

  function buildNativeSchedules() {
    const schedules = readSchedules();
    return schedules
      .map((schedule) => {
        const fill = schedule?.fillSnapshot;
        if (!schedule || !fill) return null;

        const doseAmount = Number(schedule.doseAmount || fill.doseMg || 0);
        const unitLabel = fill.unitLabel || "mg";
        const drawMl = Number(schedule.doseMl || fill.doseMl || 0);
        const nextSendAt = computeNextSendAt(schedule);
        if (!nextSendAt) return null;

        return {
          id: String(schedule.id),
          title: `${fill.name} Reminder`,
          message: `Take ${doseAmount.toFixed(2).replace(/\.00$/, "")} ${unitLabel} and draw ${drawMl.toFixed(2)} mL.`,
          nextSendAt,
          intervalDays: Math.max(1, Number(schedule.intervalDays) || 1),
          targetUrl: window.location.href,
        };
      })
      .filter(Boolean);
  }

  function getStatusElements() {
    return {
      status: document.getElementById("notification-status"),
      permissionStatus: document.getElementById("notif-permission-status"),
      deviceStatus: document.getElementById("notif-device-status"),
      scheduleStatus: document.getElementById("notif-schedule-status"),
      title: document.querySelector("#notif-setup-card .notif-setup-title"),
      copy: document.querySelector("#notif-setup-card .notif-setup-sub"),
    };
  }

  function renderNativeStatus(messageOverride) {
    const bridge = getNativeBridge();
    const {
      status,
      permissionStatus,
      deviceStatus,
      scheduleStatus,
      title,
      copy,
    } = getStatusElements();

    if (title) title.textContent = "Native reminders on this phone";
    if (copy) copy.textContent = "These reminders are stored directly in your APK, not sent from a server.";

    if (!bridge) {
      if (status) status.textContent = "Native reminders are available in the installed Android APK.";
      if (permissionStatus) permissionStatus.textContent = "Open the installed APK to enable local alerts.";
      if (deviceStatus) deviceStatus.textContent = "This browser preview cannot register native local reminders.";
      if (scheduleStatus) scheduleStatus.textContent = "Schedules will be pushed into the phone build after install.";
      if (enableButton) {
        enableButton.disabled = true;
        enableButton.textContent = "APK Required";
      }
      if (syncButton) {
        syncButton.disabled = true;
        syncButton.textContent = "Save Reminders";
      }
      if (testButton) {
        testButton.disabled = true;
        testButton.textContent = "1-Minute Test";
      }
      return;
    }

    const nativeStatus = safeParse(bridge.getStatus(), {});
    const scheduledCount = Number(nativeStatus.scheduledCount || 0);

    if (status) {
      status.textContent =
        messageOverride ||
        `Native reminders ready. ${scheduledCount} reminder${scheduledCount === 1 ? "" : "s"} currently stored on this device.`;
    }

    if (permissionStatus) {
      permissionStatus.textContent = nativeStatus.notificationPermissionGranted
        ? "Notification permission is allowed on this phone."
        : "Notifications still need permission on this phone.";
    }

    if (deviceStatus) {
      deviceStatus.textContent = nativeStatus.exactAlarmPermissionGranted
        ? "Exact timing is enabled for local dose reminders."
        : "Exact timing still needs special alarm access on this phone.";
    }

    if (scheduleStatus) {
      scheduleStatus.textContent = scheduledCount > 0
        ? `${scheduledCount} native reminder${scheduledCount === 1 ? "" : "s"} saved in the APK.`
        : "No native reminders saved yet. Save or resync a schedule to store them on-device.";
    }

    if (enableButton) {
      enableButton.disabled = false;
      enableButton.textContent = nativeStatus.notificationPermissionGranted && nativeStatus.exactAlarmPermissionGranted
        ? "Permissions Enabled"
        : "Enable Native Alerts";
    }
    if (syncButton) {
      syncButton.disabled = false;
      syncButton.textContent = "Save Reminders";
    }
    if (testButton) {
      testButton.disabled = false;
      testButton.textContent = "1-Minute Test";
    }
  }

  function requestNativePermissions(event) {
    event.preventDefault();
    const bridge = getNativeBridge();
    if (!bridge) return;
    bridge.requestPermissions();
    renderNativeStatus("Check your phone for the notification and exact-alarm permission screens.");
    window.setTimeout(() => renderNativeStatus(), 1500);
    window.setTimeout(() => renderNativeStatus(), 3500);
  }

  function syncNativeReminders() {
    const bridge = getNativeBridge();
    if (!bridge) return Promise.resolve();

    const payload = buildNativeSchedules();
    const result = safeParse(bridge.syncSchedules(JSON.stringify(payload)), {});
    renderNativeStatus(
      result && result.ok
        ? `${Number(result.scheduledCount || 0)} reminder${Number(result.scheduledCount || 0) === 1 ? "" : "s"} saved locally on this phone.`
        : `Reminder save failed${result && result.error ? `: ${result.error}` : "."}`
    );
    return Promise.resolve(result);
  }

  function sendNativeTest(event) {
    event.preventDefault();
    const bridge = getNativeBridge();
    if (!bridge) return;
    const result = safeParse(bridge.scheduleTestNotification(), {});
    renderNativeStatus(
      result && result.ok
        ? "A native test reminder was scheduled for about 1 minute from now."
        : `Test reminder failed${result && result.error ? `: ${result.error}` : "."}`
    );
  }

  function wireButtons() {
    enableButton = document.getElementById("enable-notifications");
    syncButton = document.getElementById("push-sync-now");
    testButton = document.getElementById("push-test-btn");
    if (!enableButton || !syncButton || !testButton) return;

    const freshEnable = enableButton.cloneNode(true);
    enableButton.replaceWith(freshEnable);
    enableButton = freshEnable;

    const freshSync = syncButton.cloneNode(true);
    syncButton.replaceWith(freshSync);
    syncButton = freshSync;

    const freshTest = testButton.cloneNode(true);
    testButton.replaceWith(freshTest);
    testButton = freshTest;

    enableButton.addEventListener("click", requestNativePermissions);
    syncButton.addEventListener("click", () => {
      syncNativeReminders();
    });
    testButton.addEventListener("click", sendNativeTest);
  }

  window.syncRemindersToBackend = syncNativeReminders;
  try {
    syncRemindersToBackend = syncNativeReminders;
  } catch {}

  ready(() => {
    wireButtons();
    renderNativeStatus();
    window.setTimeout(() => renderNativeStatus(), 1000);
  });

  window.addEventListener("pageshow", () => {
    renderNativeStatus();
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      renderNativeStatus();
    }
  });
})();
