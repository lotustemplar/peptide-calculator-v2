(function attachNativeReminderUxFix() {
  const AUTO_PROMPT_KEY = "fitgen-native-reminder-autoprompt-v1";

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
      return;
    }
    fn();
  }

  function getBridge() {
    return window.FitGenNativeReminders || null;
  }

  function safeParse(json, fallback) {
    try {
      return JSON.parse(json);
    } catch {
      return fallback;
    }
  }

  function scheduleSyncBursts() {
    if (typeof window.syncRemindersToBackend !== "function") return;
    [400, 1400, 3200].forEach((delay) => {
      window.setTimeout(() => {
        try {
          window.syncRemindersToBackend();
        } catch {}
      }, delay);
    });
  }

  function tryAutoPrompt() {
    const bridge = getBridge();
    if (!bridge || typeof bridge.getStatus !== "function" || typeof bridge.requestPermissions !== "function") {
      return;
    }

    const alreadyPrompted = localStorage.getItem(AUTO_PROMPT_KEY) === "1";
    const status = safeParse(bridge.getStatus(), {});
    const notificationsGranted = Boolean(status.notificationPermissionGranted);
    const exactGranted = Boolean(status.exactAlarmPermissionGranted);

    if (notificationsGranted && exactGranted) {
      return;
    }

    if (alreadyPrompted) {
      return;
    }

    localStorage.setItem(AUTO_PROMPT_KEY, "1");
    window.setTimeout(() => {
      try {
        bridge.requestPermissions();
      } catch {}
    }, 900);
  }

  ready(() => {
    tryAutoPrompt();

    const saveFillForm = document.getElementById("save-fill-form");
    if (saveFillForm) {
      saveFillForm.addEventListener("submit", () => {
        scheduleSyncBursts();
      }, true);
    }

    document.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest('#push-sync-now, #push-test-btn, [data-action="mark-taken"], [data-action="delete-reminder"]') : null;
      if (!target) return;
      scheduleSyncBursts();
    }, true);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        scheduleSyncBursts();
      }
    });

    window.addEventListener("pageshow", () => {
      scheduleSyncBursts();
    });
  });
})();
