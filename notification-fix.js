(function attachNotificationFix() {
  const status = document.getElementById("notification-status");
  let button = document.getElementById("enable-notifications");
  const THEME_TOGGLE_STYLE_ID = "theme-toggle-hard-hide";
  const USER_ID_STORAGE_KEY = "peptide-calculator-v2-user-id";
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
      themeToggle.remove();
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
    const prefix = (window.APP_CONFIG && window.APP_CONFIG.onesignalExternalIdPrefix) || "peptide-calculator-v2";
    const runtimeUserId = typeof state !== "undefined" && state?.userId ? state.userId : null;
    const storedUserId = readStoredUserId();
    const userId = runtimeUserId || storedUserId;
    return userId ? `${prefix}-${userId}` : null;
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

    if (messageOverride) {
      status.textContent = messageOverride;
    }

    const nativeBridge = getNativeOneSignalBridge();
    if (canRequestNativeNotifications(nativeBridge)) {
      button.disabled = false;
      button.textContent = "Enable Notifications";
      if (!messageOverride) {
        status.textContent = "This APK can use native push notifications through Median. Tap to allow alerts on this device.";
      }
      return;
    }

    if (!("Notification" in window)) {
      button.disabled = true;
      button.textContent = "Notifications Unavailable";
      if (!messageOverride) {
        status.textContent = "Native push is not connected in this build yet, and browser notifications are not available here.";
      }
      return;
    }

    button.disabled = false;
    if (Notification.permission === "granted") {
      button.textContent = "Notifications Enabled";
      if (!messageOverride) {
        status.textContent = "Notifications are enabled for this device.";
      }
      return;
    }

    if (Notification.permission === "denied") {
      button.textContent = "Notifications Blocked";
      if (!messageOverride) {
        status.textContent = "Notifications are blocked for this device. Re-enable them in your device or app settings.";
      }
      return;
    }

    button.textContent = "Enable Notifications";
    if (!messageOverride) {
      status.textContent = "Turn on alerts so the app can remind you when today's peptides are due.";
    }
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
        renderNotificationStateOverride("Native notification permission request sent. Check the device prompt.");
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

  function patchReadyCallback(callbackName) {
    const previous = window[callbackName];
    window[callbackName] = async function patchedNotificationReadyCallback() {
      if (typeof previous === "function") {
        previous();
      }
      await ensureNativeIdentity();
      renderNotificationStateOverride();
    };
  }

  patchReadyCallback("median_library_ready");
  patchReadyCallback("gonative_library_ready");

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      ensureNativeIdentity().finally(() => renderNotificationStateOverride());
    }
  });

  window.addEventListener("pageshow", () => {
    ensureNativeIdentity().finally(() => renderNotificationStateOverride());
  });

  const pollTimer = window.setInterval(() => {
    hideThemeToggle();
    ensureNativeIdentity().finally(() => renderNotificationStateOverride());
    pollCount += 1;
    if (pollCount >= 300) {
      window.clearInterval(pollTimer);
    }
  }, 2000);

  hideThemeToggle();
  ensureNativeIdentity().finally(() => renderNotificationStateOverride());
})();
