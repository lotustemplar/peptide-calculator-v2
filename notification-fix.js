(function attachNotificationFix() {
  const status = document.getElementById("notification-status");
  let button = document.getElementById("enable-notifications");
  const THEME_TOGGLE_STYLE_ID = "theme-toggle-hard-hide";
  const USER_ID_STORAGE_KEY = "peptide-calculator-v2-user-id";
  const SCHEDULES_STORAGE_KEY = "peptide-calculator-v2-schedules";
  const EXTERNAL_ID_PREFIX = (window.APP_CONFIG && window.APP_CONFIG.onesignalExternalIdPrefix) || "peptide-calculator-v2";
  let pollCount = 0;

  function injectThemeToggleHideStyle() {
    if (document.getElementById(THEME_TOGGLE_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = THEME_TOGGLE_STYLE_ID;
    style.textContent = "#theme-toggle{display:none!important;visibility:hidden!important;pointer-events:none!important;}";
    document.head.appendChild(style);
  }

  function hideThemeToggle() {
    injectThemeToggleHideStyle();
    const themeToggle = document.getElementById("theme-toggle");
    if (themeToggle) {
      themeToggle.hidden = true;
      themeToggle.disabled = true;
      themeToggle.setAttribute("aria-hidden", "true");
      themeToggle.tabIndex = -1;
      themeToggle.style.display = "none";
      themeToggle.style.visibility = "hidden";
      themeToggle.style.pointerEvents = "none";
    }
  }

  function getNativeOneSignalBridge() {
    if (window.median?.onesignal) {
      return window.median.onesignal;
    }
    if (window.gonative?.onesignal) {
      return window.gonative.onesignal;
    }
    return null;
  }

  function canRequestNativeNotifications(bridge) {
    return Boolean(
      bridge &&
      (typeof bridge.register === "function" || typeof bridge.promptForPushNotifications === "function")
    );
  }

  function readJsonStorage(key, fallback) {
    try {
      const rawValue = localStorage.getItem(key);
      if (!rawValue) {
        return fallback;
      }
      return JSON.parse(rawValue);
    } catch {
      return fallback;
    }
  }

  function readStoredUserId() {
    try {
      const rawValue = localStorage.getItem(USER_ID_STORAGE_KEY);
      if (!rawValue) {
        return null;
      }

      try {
        const parsed = JSON.parse(rawValue);
        return typeof parsed === "string" ? parsed : rawValue;
      } catch {
        return rawValue;
      }
    } catch {
      return null;
    }
  }

  function getPushExternalId() {
    const runtimeUserId = typeof state !== "undefined" && state?.userId ? state.userId : null;
    const storedUserId = readStoredUserId();
    const userId = runtimeUserId || storedUserId;
    return userId ? `${EXTERNAL_ID_PREFIX}-${userId}` : null;
  }

  function parseLocalDateTime(dateString, timeString) {
    if (typeof dateString === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split("-").map(Number);
      const [hours, minutes] = String(timeString || "09:00").split(":").map(Number);
      return new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0);
    }

    return new Date(`${dateString}T${timeString || "09:00"}:00`);
  }

  function computeScheduleNextSendAt(schedule) {
    const startAt = parseLocalDateTime(schedule.startDate, schedule.reminderTime);
    if (Number.isNaN(startAt.getTime())) {
      return null;
    }

    const intervalDays = Math.max(1, Number(schedule.intervalDays) || 1);
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let nextAt = new Date(startAt.getTime());

    while (nextAt.getTime() <= now) {
      nextAt = new Date(nextAt.getTime() + intervalMs);
    }

    return nextAt.toISOString();
  }

  function readSchedulesForSync() {
    if (typeof state !== "undefined" && Array.isArray(state?.schedules)) {
      return state.schedules;
    }
    return readJsonStorage(SCHEDULES_STORAGE_KEY, []);
  }

  function buildReminderSyncPayload() {
    const userId = getPushExternalId();
    if (!userId) {
      return null;
    }

    const schedules = readSchedulesForSync();
    if (!Array.isArray(schedules)) {
      return null;
    }

    return {
      userId,
      schedules: schedules
        .map((schedule) => {
          const fill = schedule?.fillSnapshot;
          if (!schedule || !fill) {
            return null;
          }

          return {
            id: schedule.id,
            name: fill.name,
            startDate: schedule.startDate,
            reminderTime: schedule.reminderTime,
            intervalDays: schedule.intervalDays,
            nextSendAt: computeScheduleNextSendAt(schedule),
            fill: {
              peptideName: fill.name,
              fillName: fill.name,
              waterMl: fill.waterMl,
              doseMg: schedule.doseAmount,
              doseMl: schedule.doseMl,
              vialMg: fill.vialAmount,
            },
          };
        })
        .filter(Boolean),
    };
  }

  async function syncRemindersToBackendPatched() {
    if (!window.APP_CONFIG?.backendBaseUrl) {
      return;
    }

    const payload = buildReminderSyncPayload();
    if (!payload) {
      return;
    }

    try {
      await fetch(`${window.APP_CONFIG.backendBaseUrl.replace(/\/$/, "")}/reminders/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // Leave the app usable when sync is unavailable.
    }
  }

  window.syncRemindersToBackend = syncRemindersToBackendPatched;
  try {
    syncRemindersToBackend = syncRemindersToBackendPatched;
  } catch {
    // Ignore if the global binding is not writable.
  }

  async function ensureNativeIdentity() {
    const bridge = getNativeOneSignalBridge();
    if (!bridge) {
      return false;
    }

    const externalId = getPushExternalId();
    if (!externalId) {
      return true;
    }

    try {
      if (typeof bridge.login === "function") {
        await bridge.login(externalId);
        return true;
      }
      if (bridge.externalUserId && typeof bridge.externalUserId.set === "function") {
        await bridge.externalUserId.set({ externalId });
        return true;
      }
    } catch {
      return false;
    }

    return true;
  }

  async function loadNativeOneSignalInfo() {
    const bridge = getNativeOneSignalBridge();
    if (!bridge || typeof bridge.info !== "function") {
      return window.__fitgenOneSignalInfo || null;
    }

    try {
      const info = await bridge.info();
      window.__fitgenOneSignalInfo = info;
      return info;
    } catch {
      return window.__fitgenOneSignalInfo || null;
    }
  }

  function isNativePushEnabled(oneSignalInfo) {
    if (!oneSignalInfo || typeof oneSignalInfo !== "object") {
      return false;
    }

    if (oneSignalInfo.subscription && typeof oneSignalInfo.subscription === "object") {
      return Boolean(oneSignalInfo.subscription.optedIn || oneSignalInfo.subscription.id || oneSignalInfo.subscription.token);
    }

    return Boolean(oneSignalInfo.oneSignalSubscribed || oneSignalInfo.oneSignalPushToken || oneSignalInfo.oneSignalUserId);
  }

  function replaceNotificationButton() {
    if (!button || button.dataset.notificationFixBound === "true") {
      return;
    }

    const freshButton = button.cloneNode(true);
    freshButton.dataset.notificationFixBound = "true";
    button.replaceWith(freshButton);
    button = freshButton;
    button.addEventListener("click", requestNotificationOverride, true);
  }

  function renderNotificationStateOverride(messageOverride) {
    hideThemeToggle();
    replaceNotificationButton();

    if (!button || !status) {
      return;
    }

    const oneSignalInfo = window.__fitgenOneSignalInfo || null;
    const nativeBridge = getNativeOneSignalBridge();

    if (messageOverride) {
      status.textContent = messageOverride;
      return;
    }

    if (canRequestNativeNotifications(nativeBridge)) {
      button.disabled = false;
      if (isNativePushEnabled(oneSignalInfo)) {
        button.textContent = "Notifications Enabled";
        status.textContent = "Native push is active on this device. Scheduled reminders can be delivered through the APK.";
      } else {
        button.textContent = "Enable Notifications";
        status.textContent = "This APK can use native push notifications through Median. Tap to allow alerts on this device.";
      }
      return;
    }

    if (!("Notification" in window)) {
      button.disabled = true;
      button.textContent = "Notifications Unavailable";
      status.textContent = "Native push is not connected in this build yet, and browser notifications are not available here.";
      return;
    }

    button.disabled = false;
    if (Notification.permission === "granted") {
      button.textContent = "Notifications Enabled";
      status.textContent = "Notifications are enabled for this device.";
      return;
    }

    if (Notification.permission === "denied") {
      button.textContent = "Notifications Blocked";
      status.textContent = "Notifications are blocked for this device. Re-enable them in your device or app settings.";
      return;
    }

    button.textContent = "Enable Notifications";
    status.textContent = "Turn on alerts so the app can remind you when today's peptides are due.";
  }

  async function refreshNativePushState(messageOverride) {
    await ensureNativeIdentity();
    await loadNativeOneSignalInfo();
    renderNotificationStateOverride(messageOverride);
  }

  async function requestNotificationOverride(event) {
    if (!button || !status) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const nativeBridge = getNativeOneSignalBridge();
    if (canRequestNativeNotifications(nativeBridge)) {
      try {
        await ensureNativeIdentity();
        if (typeof nativeBridge.register === "function") {
          await nativeBridge.register();
        } else {
          await nativeBridge.promptForPushNotifications();
        }
        await ensureNativeIdentity();
        await loadNativeOneSignalInfo();
        await syncRemindersToBackendPatched();
        renderNotificationStateOverride("Native notification permission request sent. Check the device prompt.");
        window.setTimeout(() => {
          refreshNativePushState();
        }, 2500);
      } catch {
        renderNotificationStateOverride("Native notification permission could not be requested right now.");
      }
      return;
    }

    if (!("Notification" in window)) {
      renderNotificationStateOverride();
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        renderNotificationStateOverride("Notifications are enabled for this device.");
      } else if (permission === "denied") {
        renderNotificationStateOverride("Notifications are blocked for this device. Re-enable them in your device or app settings.");
      } else {
        renderNotificationStateOverride();
      }
    } catch {
      renderNotificationStateOverride("Notification permission could not be requested right now.");
    }
  }

  window.median_onesignal_info = function medianOneSignalInfoBridge(oneSignalInfo) {
    window.__fitgenOneSignalInfo = oneSignalInfo;
    renderNotificationStateOverride();
  };

  function patchReadyCallback(callbackName) {
    const previous = window[callbackName];
    window[callbackName] = async function patchedNotificationReadyCallback() {
      if (typeof previous === "function") {
        previous();
      }
      await refreshNativePushState();
    };
  }

  patchReadyCallback("median_library_ready");
  patchReadyCallback("gonative_library_ready");

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshNativePushState();
    }
  });

  window.addEventListener("pageshow", () => {
    refreshNativePushState();
  });

  const pollTimer = window.setInterval(() => {
    hideThemeToggle();
    refreshNativePushState();
    pollCount += 1;
    if (pollCount >= 180) {
      window.clearInterval(pollTimer);
    }
  }, 2000);

  hideThemeToggle();
  refreshNativePushState();
})();
