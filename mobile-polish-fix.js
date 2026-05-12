(function attachMobilePolishFix() {
  const STORAGE_KEYS = {
    fills: "peptide-calculator-v2-fills",
    schedules: "peptide-calculator-v2-schedules",
    activeView: "peptide-calculator-v2-active-view",
  };
  const MIN_DRAW_ML = 0.05;

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
      return;
    }
    fn();
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function isPositiveNumber(value) {
    return Number.isFinite(Number(value)) && Number(value) > 0;
  }

  function formatNumber(value) {
    return Number(value).toFixed(2).replace(/\.00$/, "");
  }

  function injectStyles() {
    if (document.getElementById("fitgen-mobile-polish-style")) return;
    const style = document.createElement("style");
    style.id = "fitgen-mobile-polish-style";
    style.textContent = `
      .fitgen-suggestion-wrap {
        max-width: 100%;
        overflow-x: auto;
        overflow-y: hidden;
        flex-wrap: nowrap;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        padding-bottom: 2px;
      }

      .fitgen-suggestion-wrap::-webkit-scrollbar {
        display: none;
      }

      .fitgen-suggestion-wrap.is-typing {
        display: none;
      }

      .fitgen-edit-overlay[hidden] {
        display: none !important;
      }

      .fitgen-edit-overlay {
        position: fixed;
        inset: 0;
        z-index: 10020;
        display: grid;
        place-items: center;
        padding: 16px;
        background: rgba(5, 10, 18, 0.72);
        backdrop-filter: blur(8px);
      }

      .fitgen-edit-card {
        width: min(760px, calc(100vw - 24px));
        max-height: calc(100vh - 32px);
        overflow-y: auto;
        padding: 22px;
        border-radius: 28px;
        background: var(--surface-strong, rgba(13, 29, 45, 0.98));
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: var(--shadow, 0 24px 56px rgba(0, 0, 0, 0.28));
      }

      .fitgen-edit-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
        margin-bottom: 16px;
      }

      .fitgen-edit-head h2 {
        margin: 6px 0 4px;
        font-family: "Sora", sans-serif;
      }

      .fitgen-edit-copy {
        margin: 0;
        color: var(--muted);
        line-height: 1.5;
      }

      .fitgen-edit-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      .fitgen-edit-grid label {
        display: grid;
        gap: 8px;
      }

      .fitgen-edit-grid label span {
        font-size: 0.94rem;
        font-weight: 600;
      }

      .fitgen-edit-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 18px;
      }

      .fitgen-edit-note {
        margin: 0 0 14px;
        padding: 12px 14px;
        border-radius: 16px;
        background: rgba(63, 214, 197, 0.08);
        border: 1px solid rgba(63, 214, 197, 0.14);
        color: var(--muted);
      }

      @media (max-width: 720px) {
        .fitgen-edit-grid {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function attachSuggestionBehavior(inputId) {
    const input = document.getElementById(inputId);
    if (!input || input.dataset.fitgenTypingManaged === "true") return;

    const wrap = input.parentElement?.querySelector(".fitgen-suggestion-wrap") || input.nextElementSibling;
    if (!wrap || !wrap.classList || !wrap.classList.contains("fitgen-suggestion-wrap")) return;

    input.dataset.fitgenTypingManaged = "true";

    input.addEventListener("focus", () => {
      wrap.classList.add("is-typing");
      window.setTimeout(() => {
        input.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);
    });

    input.addEventListener("blur", () => {
      window.setTimeout(() => wrap.classList.remove("is-typing"), 160);
    });
  }

  function ensureEditModal() {
    let overlay = document.getElementById("fitgen-edit-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "fitgen-edit-overlay";
    overlay.className = "fitgen-edit-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="fitgen-edit-card" role="dialog" aria-modal="true" aria-labelledby="fitgen-edit-title">
        <div class="fitgen-edit-head">
          <div>
            <p class="section-kicker">Edit Fill</p>
            <h2 id="fitgen-edit-title">Update your peptide fill</h2>
            <p class="fitgen-edit-copy">Adjust the fill amount, dose, schedule cadence, and reminder time without dropping into raw prompt boxes.</p>
          </div>
          <button class="ghost-button icon-button" type="button" id="fitgen-edit-close" aria-label="Close edit fill dialog">×</button>
        </div>
        <p class="fitgen-edit-note" id="fitgen-edit-note"></p>
        <form id="fitgen-edit-form" class="fitgen-edit-grid">
          <label>
            <span>Fill name</span>
            <input id="fitgen-edit-name" type="text" maxlength="80" required>
          </label>
          <label>
            <span>BAC water amount (mL)</span>
            <input id="fitgen-edit-water" type="number" min="0.5" step="0.05" required>
          </label>
          <label>
            <span id="fitgen-edit-dose-label">Dose amount</span>
            <input id="fitgen-edit-dose" type="number" min="0.01" step="0.01" required>
          </label>
          <label>
            <span>Every X days</span>
            <input id="fitgen-edit-interval" type="number" min="1" step="1" required>
          </label>
          <label>
            <span>Reminder time</span>
            <input id="fitgen-edit-time" type="time" required>
          </label>
          <label>
            <span>Start date</span>
            <input id="fitgen-edit-start" type="date" required>
          </label>
          <div class="fitgen-edit-actions">
            <button class="primary-button" type="submit">Save Changes</button>
            <button class="secondary-button" type="button" id="fitgen-edit-cancel">Cancel</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => {
      overlay.hidden = true;
      document.body.classList.remove("fitgen-settings-open");
    };

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });
    overlay.querySelector("#fitgen-edit-close").addEventListener("click", close);
    overlay.querySelector("#fitgen-edit-cancel").addEventListener("click", close);

    return overlay;
  }

  function openEditModal(fillId) {
    const fills = readJson(STORAGE_KEYS.fills, []);
    const schedules = readJson(STORAGE_KEYS.schedules, []);
    const fill = fills.find((item) => item.savedId === fillId);
    if (!fill) return;

    const linkedSchedules = schedules.filter((item) => item.fillSavedId === fillId);
    const primarySchedule = linkedSchedules[0] || null;
    const overlay = ensureEditModal();

    overlay.dataset.fillId = fillId;
    overlay.querySelector("#fitgen-edit-name").value = fill.name || "";
    overlay.querySelector("#fitgen-edit-water").value = Number(fill.waterMl || 0).toFixed(2);
    overlay.querySelector("#fitgen-edit-dose").value = formatNumber(primarySchedule?.doseAmount || fill.recommendedDoseAmount || 0);
    overlay.querySelector("#fitgen-edit-interval").value = String(primarySchedule?.intervalDays || 7);
    overlay.querySelector("#fitgen-edit-time").value = primarySchedule?.reminderTime || "09:00";
    overlay.querySelector("#fitgen-edit-start").value = primarySchedule?.startDate || new Date().toISOString().split("T")[0];
    overlay.querySelector("#fitgen-edit-dose-label").textContent = `Dose amount (${fill.unitLabel || "mg"})`;
    overlay.querySelector("#fitgen-edit-note").textContent = `${formatNumber(fill.vialAmount)} ${fill.unitLabel || "mg"} vial · currently ${formatNumber(fill.waterMl)} mL BAC water · ${linkedSchedules.length || 1} linked schedule${linkedSchedules.length === 1 ? "" : "s"}.`;

    overlay.hidden = false;
    window.setTimeout(() => {
      overlay.querySelector("#fitgen-edit-name").focus();
    }, 40);
  }

  async function saveEditedFill(event) {
    event.preventDefault();

    const overlay = document.getElementById("fitgen-edit-overlay");
    const fillId = overlay?.dataset.fillId;
    if (!fillId) return;

    const fills = readJson(STORAGE_KEYS.fills, []);
    const schedules = readJson(STORAGE_KEYS.schedules, []);
    const fillIndex = fills.findIndex((item) => item.savedId === fillId);
    if (fillIndex === -1) return;

    const fill = { ...fills[fillIndex] };
    const nextName = overlay.querySelector("#fitgen-edit-name").value.trim() || fill.name || "Unnamed Peptide Fill";
    const nextWaterMl = Number(overlay.querySelector("#fitgen-edit-water").value);
    const nextDoseAmount = Number(overlay.querySelector("#fitgen-edit-dose").value);
    const nextIntervalDays = Number(overlay.querySelector("#fitgen-edit-interval").value);
    const nextTime = overlay.querySelector("#fitgen-edit-time").value;
    const nextStart = overlay.querySelector("#fitgen-edit-start").value;
    const vialAmount = Number(fill.vialAmount || 0);
    const syringeMax = Number(fill.syringeMax || 1);

    if (!isPositiveNumber(vialAmount) || !isPositiveNumber(nextWaterMl) || !isPositiveNumber(nextDoseAmount) || !Number.isInteger(nextIntervalDays) || nextIntervalDays < 1 || !nextTime || !nextStart) {
      window.alert("Please enter valid fill and schedule values.");
      return;
    }

    const nextConcentration = vialAmount / nextWaterMl;
    const nextDoseMl = nextDoseAmount / nextConcentration;

    if (!isPositiveNumber(nextDoseMl) || nextDoseMl < MIN_DRAW_ML || nextDoseMl > syringeMax) {
      window.alert(`That dose would require ${nextDoseMl.toFixed(2)} mL, which falls outside the supported draw range for this fill.`);
      return;
    }

    fill.name = nextName;
    fill.waterMl = Number(nextWaterMl.toFixed(2));
    fill.concentrationPerMl = nextConcentration;
    fill.recommendedDoseAmount = nextDoseAmount;
    fill.maxWaterMl = Math.max(Number(fill.maxWaterMl || 0), fill.waterMl);
    fills[fillIndex] = fill;

    const updatedSchedules = schedules.map((schedule) => {
      if (schedule.fillSavedId !== fillId) return schedule;
      return {
        ...schedule,
        doseAmount: nextDoseAmount,
        doseMl: Number(nextDoseMl.toFixed(2)),
        intervalDays: nextIntervalDays,
        reminderTime: nextTime,
        startDate: nextStart,
        fillSnapshot: {
          ...(schedule.fillSnapshot || {}),
          ...fill,
        },
      };
    });

    writeJson(STORAGE_KEYS.fills, fills);
    writeJson(STORAGE_KEYS.schedules, updatedSchedules);
    writeJson(STORAGE_KEYS.activeView, "cabinet-view");

    if (window.state && Array.isArray(window.state.fills)) {
      window.state.fills = fills;
    }
    if (window.state && Array.isArray(window.state.schedules)) {
      window.state.schedules = updatedSchedules;
      window.state.activeView = "cabinet-view";
    }

    overlay.hidden = true;

    if (typeof window.syncRemindersToBackend === "function") {
      try {
        await window.syncRemindersToBackend();
      } catch {}
    }

    if (typeof window.renderAll === "function") {
      try {
        window.renderAll();
      } catch {}
    }

    window.setTimeout(() => {
      window.location.reload();
    }, 80);
  }

  ready(() => {
    injectStyles();
    attachSuggestionBehavior("save-fill-name");
    attachSuggestionBehavior("med-name");

    const overlay = ensureEditModal();
    overlay.querySelector("#fitgen-edit-form").addEventListener("submit", saveEditedFill);

    document.addEventListener("click", (event) => {
      const editButton = event.target instanceof HTMLElement ? event.target.closest('[data-action="edit-fill"]') : null;
      if (!editButton) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openEditModal(editButton.dataset.id);
    }, true);
  });
})();
