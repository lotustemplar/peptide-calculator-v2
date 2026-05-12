(function disableWebReminderFallback() {
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
      return;
    }
    fn();
  }

  function hasNativeReminderBridge() {
    return Boolean(window.FitGenNativeReminders && typeof window.FitGenNativeReminders.getStatus === "function");
  }

  ready(() => {
    if (!hasNativeReminderBridge()) {
      return;
    }

    window.fireReminder = function nativeReminderHandledByApk() {
      return;
    };

    const status = document.getElementById("notification-status");
    if (status) {
      status.textContent = "Native APK reminders are active. In-app browser reminder fallbacks are disabled.";
    }
  });
})();
