(function () {
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
      return;
    }
    fn();
  }

  function injectStyles() {
    if (document.getElementById("fitgen-settings-fix-styles")) return;
    const style = document.createElement("style");
    style.id = "fitgen-settings-fix-styles";
    style.textContent = `
      .fitgen-settings-overlay[hidden] {
        display: none !important;
      }

      .fitgen-settings-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: stretch;
        justify-content: flex-end;
        background: rgba(6, 10, 18, 0.72);
        backdrop-filter: blur(8px);
        padding: 0;
      }

      .fitgen-settings-panel {
        width: min(92vw, 34rem);
        height: 100%;
        overflow-y: auto;
        background: rgba(12, 18, 28, 0.96);
        border-left: 1px solid rgba(128, 180, 190, 0.18);
        box-shadow: -24px 0 60px rgba(0, 0, 0, 0.35);
        padding: 1.25rem 1.1rem 1.5rem;
      }

      .fitgen-settings-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .fitgen-settings-kicker {
        margin: 0 0 0.35rem;
        font-size: 0.76rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--teal, #62d3c6);
      }

      .fitgen-settings-title {
        margin: 0;
        font-size: 1.35rem;
        line-height: 1.15;
      }

      .fitgen-settings-copy {
        margin: 0.45rem 0 0;
        color: var(--muted, rgba(226, 232, 240, 0.72));
        line-height: 1.5;
      }

      .fitgen-settings-close,
      .fitgen-settings-trigger {
        appearance: none;
        border: 1px solid rgba(128, 180, 190, 0.18);
        background: rgba(20, 29, 42, 0.72);
        color: var(--text, #eef7f7);
        border-radius: 999px;
        cursor: pointer;
        font: inherit;
        transition: transform 140ms ease, background 140ms ease, border-color 140ms ease;
      }

      .fitgen-settings-close:hover,
      .fitgen-settings-trigger:hover {
        transform: translateY(-1px);
        background: rgba(30, 44, 61, 0.92);
        border-color: rgba(98, 211, 198, 0.45);
      }

      .fitgen-settings-close {
        min-width: 2.5rem;
        min-height: 2.5rem;
        padding: 0;
        font-size: 1.2rem;
        line-height: 1;
      }

      .fitgen-settings-trigger {
        padding: 0.72rem 1rem;
        font-weight: 600;
      }

      .fitgen-settings-section {
        display: grid;
        gap: 0.9rem;
      }

      .fitgen-settings-section .fitgen-settings-note {
        margin: 0;
        padding: 0.9rem 1rem;
        border-radius: 1rem;
        background: rgba(98, 211, 198, 0.08);
        border: 1px solid rgba(98, 211, 198, 0.14);
        color: var(--muted, rgba(226, 232, 240, 0.78));
        line-height: 1.45;
      }

      .fitgen-settings-notifications {
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
      }

      body.fitgen-settings-open {
        overflow: hidden;
      }
    `;
    document.head.appendChild(style);
  }

  function findNotificationBlock(dosageForm, enableBtn, syncBtn, testBtn) {
    let node = enableBtn;
    while (node && node !== document.body) {
      const hasControls =
        typeof node.querySelector === "function" &&
        node.querySelector("#enable-notifications") &&
        node.querySelector("#push-sync-now") &&
        node.querySelector("#push-test-btn");
      const containsDosageForm = Boolean(dosageForm && node.contains(dosageForm));

      if (hasControls && !containsDosageForm) {
        return node;
      }

      node = node.parentElement;
    }

    if (dosageForm) {
      let sibling = dosageForm.previousElementSibling;
      while (sibling) {
        if (typeof sibling.querySelector === "function" && sibling.querySelector("#enable-notifications")) {
          return sibling;
        }
        sibling = sibling.previousElementSibling;
      }
    }

    return enableBtn.parentElement;
  }

  function openSheet(overlay) {
    overlay.hidden = false;
    document.body.classList.add("fitgen-settings-open");
  }

  function closeSheet(overlay) {
    overlay.hidden = true;
    document.body.classList.remove("fitgen-settings-open");
  }

  ready(function initSettingsSheet() {
    if (document.getElementById("fitgen-settings-overlay")) return;

    const dosageForm = document.getElementById("dosage-form");
    const enableBtn = document.getElementById("enable-notifications");
    const syncBtn = document.getElementById("push-sync-now");
    const testBtn = document.getElementById("push-test-btn");

    if (!enableBtn || !syncBtn || !testBtn) return;

    injectStyles();

    const notificationBlock = findNotificationBlock(dosageForm, enableBtn, syncBtn, testBtn);
    if (!notificationBlock) return;

    const overlay = document.createElement("div");
    overlay.id = "fitgen-settings-overlay";
    overlay.className = "fitgen-settings-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <aside class="fitgen-settings-panel" role="dialog" aria-modal="true" aria-labelledby="fitgen-settings-title">
        <div class="fitgen-settings-head">
          <div>
            <p class="fitgen-settings-kicker">Settings</p>
            <h2 class="fitgen-settings-title" id="fitgen-settings-title">App settings</h2>
            <p class="fitgen-settings-copy">Notification setup lives here so Schedule stays focused on what you need to take today.</p>
          </div>
          <button class="fitgen-settings-close" type="button" aria-label="Close settings">×</button>
        </div>
        <section class="fitgen-settings-section">
          <p class="fitgen-settings-note">Use this area for notification setup and quick app-level actions. Your Schedule screen is now reserved for dose timing and mark-as-taken tasks.</p>
        </section>
      </aside>
    `;

    const section = overlay.querySelector(".fitgen-settings-section");
    const closeBtn = overlay.querySelector(".fitgen-settings-close");
    notificationBlock.classList.add("fitgen-settings-notifications");
    section.appendChild(notificationBlock);
    document.body.appendChild(overlay);

    const themeToggle = document.getElementById("theme-toggle");
    let trigger;
    if (themeToggle) {
      trigger = themeToggle.cloneNode(false);
      trigger.id = "settings-toggle";
      trigger.className = (themeToggle.className || "") + " fitgen-settings-trigger";
      trigger.type = "button";
      trigger.textContent = "Settings";
      themeToggle.replaceWith(trigger);
    } else {
      trigger = document.createElement("button");
      trigger.id = "settings-toggle";
      trigger.className = "fitgen-settings-trigger";
      trigger.type = "button";
      trigger.textContent = "Settings";
      const mount =
        document.querySelector("header") ||
        document.querySelector(".app-header") ||
        document.querySelector(".top-bar") ||
        document.body;
      mount.appendChild(trigger);
    }

    trigger.addEventListener("click", function () {
      openSheet(overlay);
    });

    closeBtn.addEventListener("click", function () {
      closeSheet(overlay);
    });

    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) {
        closeSheet(overlay);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !overlay.hidden) {
        closeSheet(overlay);
      }
    });
  });
})();
