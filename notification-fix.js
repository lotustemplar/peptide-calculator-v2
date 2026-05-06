(function attachNotificationFix() {
  const button = document.getElementById("enable-notifications");
  const status = document.getElementById("notification-status");
  const themeToggle = document.getElementById("theme-toggle");

  if (themeToggle) {
    themeToggle.hidden = true;
    themeToggle.setAttribute("aria-hidden", "true");
    themeToggle.tabIndex = -1;
  }

  function getNativeOneSignalBridge() {
    if (window.median?.onesignal?.register) {
      return window.median.onesignal;
    }
    if (window.gonative?.onesignal?.register) {
      return window.gonative.onesignal;
    }
    return null;
  }

  function renderNotificationStateOverride() {
    if (!button || !status) {
      return;
    }

    const nativeBridge = getNativeOneSignalBridge();
    if (nativeBridge) {
      button.disabled = false;
      button.textContent = "Enable Notifications";
      status.textContent = "This APK can use native push notifications through Median. Tap to allow alerts on this device.";
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

  async function requestNotificationOverride(event) {
    if (!button || !status) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const nativeBridge = getNativeOneSignalBridge();
    if (nativeBridge) {
      try {
        nativeBridge.register();
        status.textContent = "Native notification permission request sent. Check the device prompt.";
      } catch {
        status.textContent = "Native notification permission could not be requested right now.";
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
        status.textContent = "Notifications are enabled for this device.";
        button.textContent = "Notifications Enabled";
      } else if (permission === "denied") {
        status.textContent = "Notifications are blocked for this device. Re-enable them in your device or app settings.";
        button.textContent = "Notifications Blocked";
      } else {
        renderNotificationStateOverride();
      }
    } catch {
      status.textContent = "Notification permission could not be requested right now.";
    }
  }

  if (button) {
    button.addEventListener("click", requestNotificationOverride, true);
  }

  const previousMedianLibraryReady = window.median_library_ready;
  window.median_library_ready = function medianLibraryReadyPatched() {
    if (typeof previousMedianLibraryReady === "function") {
      previousMedianLibraryReady();
    }
    renderNotificationStateOverride();
  };

  const previousGonativeLibraryReady = window.gonative_library_ready;
  window.gonative_library_ready = function gonativeLibraryReadyPatched() {
    if (typeof previousGonativeLibraryReady === "function") {
      previousGonativeLibraryReady();
    }
    renderNotificationStateOverride();
  };

  let pollCount = 0;
  const pollTimer = window.setInterval(() => {
    renderNotificationStateOverride();
    pollCount += 1;
    if (getNativeOneSignalBridge() || pollCount >= 20) {
      window.clearInterval(pollTimer);
    }
  }, 500);

  renderNotificationStateOverride();
})();
