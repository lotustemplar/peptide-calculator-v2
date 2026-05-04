const RUNTIME_FIX_DEFAULT_MAX_WATER_ML = 3;
const RUNTIME_FIX_MIN_DRAW_ML = 0.1;
const RUNTIME_FIX_DRAW_STEP_ML = 0.05;
const RUNTIME_FIX_DISPLAY_OPTION_LIMIT = 18;
const RUNTIME_FIX_STORAGE_KEYS = {
  fills: "peptide-calculator-v2-fills",
  schedules: "peptide-calculator-v2-schedules",
  selectedFill: "peptide-calculator-v2-selected-fill",
  expandedFill: "peptide-calculator-v2-expanded-fill",
  activeView: "peptide-calculator-v2-active-view",
};

function getPushExternalIdForSync() {
  const prefix = (window.APP_CONFIG && window.APP_CONFIG.onesignalExternalIdPrefix) || "peptide-calculator-v2";
  if (typeof state === "undefined" || !state?.userId) {
    return null;
  }
  return `${prefix}-${state.userId}`;
}

async function syncRemindersToBackend() {
  if (!window.APP_CONFIG?.backendBaseUrl) {
    return;
  }

  const schedules = typeof state !== "undefined" && Array.isArray(state?.schedules)
    ? state.schedules
    : JSON.parse(localStorage.getItem(RUNTIME_FIX_STORAGE_KEYS.schedules) || "[]");

  if (!Array.isArray(schedules)) {
    return;
  }

  const payload = {
    userId: getPushExternalIdForSync(),
    schedules: schedules
      .map((schedule) => {
        const fill = typeof resolveScheduleFill === "function"
          ? resolveScheduleFill(schedule)
          : schedule?.fillSnapshot;
        if (!fill) {
          return null;
        }

        return {
          id: schedule.id,
          name: fill.name,
          startDate: schedule.startDate,
          reminderTime: schedule.reminderTime,
          intervalDays: schedule.intervalDays,
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

  if (!payload.userId) {
    return;
  }

  try {
    await fetch(`${window.APP_CONFIG.backendBaseUrl.replace(/\/$/, "")}/reminders/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    // Keep the app usable even if backend sync is unavailable.
  }
}

(function attachRuntimeFixes() {
  const form = document.getElementById("calculator-form");
  const resultsGrid = document.getElementById("results-grid");
  const resultsSummary = document.getElementById("results-summary");
  const resultsCard = resultsGrid?.closest(".results-card");
  const saveFillModal = document.getElementById("save-fill-modal");
  const saveFillForm = document.getElementById("save-fill-form");
  const saveFillPreview = document.getElementById("save-fill-preview");
  const saveFillName = document.getElementById("save-fill-name");
  const modalDoseLabel = document.getElementById("modal-dose-label");
  const modalDoseDisplay = document.getElementById("modal-dose-display");
  const saveFillInterval = document.getElementById("save-fill-interval");
  const saveFillTime = document.getElementById("save-fill-time");
  const saveFillStartDate = document.getElementById("save-fill-start-date");
  const closeSaveFill = document.getElementById("close-save-fill");
  const cancelSaveFill = document.getElementById("cancel-save-fill");
  const currentPeptides = document.getElementById("current-peptides");
  const reminderList = document.getElementById("reminder-list");
  const calendarList = document.getElementById("calendar-list");
  const viewTabs = Array.from(document.querySelectorAll("[data-view-target]"));
  const views = Array.from(document.querySelectorAll("[data-view]"));

  if (!form || !resultsGrid || !saveFillModal || !saveFillForm) {
    return;
  }

  let pendingOption = null;

  function readJsonStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJsonStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getFills() {
    if (typeof state !== "undefined" && Array.isArray(state?.fills)) {
      return state.fills;
    }
    return readJsonStorage(RUNTIME_FIX_STORAGE_KEYS.fills, []);
  }

  function getSchedules() {
    if (typeof state !== "undefined" && Array.isArray(state?.schedules)) {
      return state.schedules;
    }
    return readJsonStorage(RUNTIME_FIX_STORAGE_KEYS.schedules, []);
  }

  function writeFills(fills) {
    if (typeof state !== "undefined") {
      state.fills = fills;
    }
    writeJsonStorage(RUNTIME_FIX_STORAGE_KEYS.fills, fills);
  }

  function writeSchedules(schedules) {
    if (typeof state !== "undefined") {
      state.schedules = schedules;
    }
    writeJsonStorage(RUNTIME_FIX_STORAGE_KEYS.schedules, schedules);
  }

  function isPositiveNumber(value) {
    return Number.isFinite(value) && value > 0;
  }

  function roundToStep(value, step) {
    return Math.round(value / step) * step;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: value < 1 ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  function formatMl(value) {
    return `${Number(value).toFixed(2)} mL`;
  }

  function formatDrawMl(value) {
    return `${Number(value).toFixed(2)} mL`;
  }

  function formatDose(value, unitLabel) {
    return `${formatNumber(value)} ${unitLabel}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatDate(dateValue) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(dateValue));
  }

  function buildWaterLine(option) {
    return `${formatNumber(option.concentrationPerMl)} ${option.unitLabel}/mL concentration`;
  }

  function getInputs() {
    return {
      vialAmount: Number(document.getElementById("vial-mg")?.value),
      doseAmount: Number(document.getElementById("dose-mg")?.value),
      syringeMax: Number(document.getElementById("syringe-max")?.value),
      maxWaterMl: Number(document.getElementById("max-water-ml")?.value),
      unitLabel: document.getElementById("dose-unit")?.value || "mg",
    };
  }

  function buildTargetDraws(syringeMax) {
    const upperBound = Math.min(Math.max(syringeMax, RUNTIME_FIX_MIN_DRAW_ML), 1);
    const draws = [];
    for (let draw = RUNTIME_FIX_MIN_DRAW_ML; draw <= upperBound + 0.0001; draw += RUNTIME_FIX_DRAW_STEP_ML) {
      draws.push(Number(draw.toFixed(2)));
    }
    return draws;
  }

  function scoreOption(option) {
    const preferredCenter = option.doseMl <= 0.3 ? 0.2 : 0.5;
    const comfortPenalty = Math.abs(option.doseMl - preferredCenter) * 10;
    const overThreePenalty = option.waterMl > RUNTIME_FIX_DEFAULT_MAX_WATER_ML ? 5 + (option.waterMl - RUNTIME_FIX_DEFAULT_MAX_WATER_ML) * 4 : 0;
    return comfortPenalty + overThreePenalty + option.doseMl;
  }

  function describeDraw(doseMl) {
    if (Math.abs(doseMl - roundToStep(doseMl, 0.1)) < 1e-9) {
      return "Clean tenth-of-a-mL draw.";
    }
    return "Rounded 0.05 mL draw for easier measuring.";
  }

  function computeOptions() {
    const { vialAmount, doseAmount, syringeMax, maxWaterMl, unitLabel } = getInputs();

    if (!isPositiveNumber(vialAmount) || !isPositiveNumber(doseAmount) || !isPositiveNumber(syringeMax) || !isPositiveNumber(maxWaterMl)) {
      return { error: "Enter valid values to see fill options.", options: [] };
    }

    if (doseAmount > vialAmount) {
      return { error: "The desired dose cannot be larger than the total amount in the vial.", options: [] };
    }

    const options = buildTargetDraws(syringeMax)
      .map((doseMl) => {
        const waterMl = (vialAmount * doseMl) / doseAmount;
        if (!isPositiveNumber(waterMl) || waterMl > maxWaterMl) {
          return null;
        }

        return {
          id: `${vialAmount}-${doseAmount}-${syringeMax}-${maxWaterMl}-${doseMl}-${unitLabel}`,
          vialAmount,
          doseAmount,
          syringeMax,
          maxWaterMl,
          waterMl: Number(waterMl.toFixed(2)),
          unitLabel,
          concentrationPerMl: vialAmount / waterMl,
          doseMl,
          guidance: describeDraw(doseMl),
        };
      })
      .filter(Boolean)
      .map((option) => ({ ...option, score: scoreOption(option) }))
      .sort((left, right) => left.score - right.score)
      .slice(0, RUNTIME_FIX_DISPLAY_OPTION_LIMIT);

    if (!options.length) {
      return {
        error: `No easy draw options fit within ${formatMl(maxWaterMl)} of BAC water and your ${formatMl(syringeMax)} syringe limit.`,
        options: [],
      };
    }

    return { error: null, options };
  }

  function setActiveViewFallback(viewId) {
    views.forEach((view) => {
      view.classList.toggle("is-active", view.dataset.view === viewId);
    });
    viewTabs.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.viewTarget === viewId);
    });
    localStorage.setItem(RUNTIME_FIX_STORAGE_KEYS.activeView, JSON.stringify(viewId));
    if (typeof state !== "undefined") {
      state.activeView = viewId;
    }
  }

  function bindFallbackTabs() {
    viewTabs.forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        setActiveViewFallback(button.dataset.viewTarget);
      }, true);
    });
  }

  function renderFallbackCabinet() {
    if (!currentPeptides) {
      return;
    }
    const fills = getFills();
    const schedules = getSchedules();

    if (!fills.length) {
      currentPeptides.innerHTML = '<div class="empty-state">No fills saved yet.</div>';
      return;
    }

    currentPeptides.innerHTML = fills.map((fill) => {
      const fillSchedules = schedules.filter((schedule) => schedule.fillSavedId === fill.savedId);
      const primarySchedule = fillSchedules[0] || null;
      return `
        <article class="cabinet-card">
          <div class="card-topline">
            <div>
              <h3>${escapeHtml(fill.name)}</h3>
              <p class="card-note"><span class="water-amount-emphasis">${formatMl(fill.waterMl)}</span> - BAC WATER AMOUNT</p>
              <p class="card-note">${escapeHtml(buildWaterLine(fill))}</p>
            </div>
          </div>
          ${primarySchedule ? `
            <div class="result-metrics">
              <div class="metric">
                <span>Draw each dose</span>
                <strong>${formatDrawMl(primarySchedule.doseMl)}</strong>
              </div>
              <div class="metric">
                <span>Dose</span>
                <strong>${formatDose(primarySchedule.doseAmount, fill.unitLabel)}</strong>
              </div>
            </div>
          ` : '<div class="empty-state">No schedule saved for this fill yet.</div>'}
        </article>
      `;
    }).join("");
  }

  function renderFallbackSchedules() {
    if (!reminderList) {
      return;
    }
    const fills = getFills();
    const schedules = getSchedules();
    if (!schedules.length) {
      reminderList.innerHTML = '<div class="empty-state">No dosage plans saved yet.</div>';
      return;
    }

    reminderList.innerHTML = schedules.map((schedule) => {
      const fill = fills.find((item) => item.savedId === schedule.fillSavedId) || schedule.fillSnapshot;
      return `
        <article class="list-card">
          <div class="list-topline">
            <div>
              <h3>${escapeHtml(fill?.name || "Saved Fill")}</h3>
              <p class="card-note">${formatDose(schedule.doseAmount, schedule.unitLabel)} every ${schedule.intervalDays} day${schedule.intervalDays === 1 ? "" : "s"}</p>
            </div>
          </div>
          <div class="schedule-metrics">
            <div class="metric">
              <span>Draw each dose</span>
              <strong>${formatDrawMl(schedule.doseMl)}</strong>
            </div>
            <div class="metric">
              <span>Reminder time</span>
              <strong>${escapeHtml(schedule.reminderTime)}</strong>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderFallbackCalendar() {
    if (!calendarList) {
      return;
    }
    const fills = getFills();
    const schedules = getSchedules();
    if (!schedules.length) {
      calendarList.innerHTML = '<div class="empty-state">No calendar items yet.</div>';
      return;
    }

    calendarList.innerHTML = schedules.map((schedule) => {
      const fill = fills.find((item) => item.savedId === schedule.fillSavedId) || schedule.fillSnapshot;
      return `
        <article class="calendar-day">
          <div class="list-topline">
            <div>
              <h3>${escapeHtml(fill?.name || "Saved Fill")}</h3>
              <p class="card-note">Starts ${formatDate(schedule.startDate)}</p>
            </div>
          </div>
          <div class="schedule-metrics">
            <div class="metric">
              <span>Frequency</span>
              <strong>Every ${schedule.intervalDays} day${schedule.intervalDays === 1 ? "" : "s"}</strong>
            </div>
            <div class="metric">
              <span>Draw each dose</span>
              <strong>${formatDrawMl(schedule.doseMl)}</strong>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderFallbackViews() {
    renderFallbackCabinet();
    renderFallbackSchedules();
    renderFallbackCalendar();
  }

  function closeFallbackSaveFillModal() {
    pendingOption = null;
    saveFillModal.classList.add("is-hidden");
    saveFillModal.setAttribute("aria-hidden", "true");
  }

  function openFallbackSaveFillModal(option) {
    pendingOption = option;
    if (typeof state !== "undefined") {
      state.latestOptions = [option];
      state.pendingSaveOptionId = option.id;
    }

    saveFillName.value = "";
    modalDoseLabel.textContent = `Dosage amount (${option.unitLabel})`;
    modalDoseDisplay.value = `${formatNumber(option.doseAmount)} ${option.unitLabel}`;
    saveFillInterval.value = document.getElementById("interval-days")?.value || "7";
    saveFillTime.value = document.getElementById("reminder-time")?.value || "09:00";
    saveFillStartDate.value = document.getElementById("start-date")?.value || new Date().toISOString().split("T")[0];
    saveFillPreview.innerHTML = `
      <div class="preview-pill">
        <span class="water-amount-emphasis">${formatMl(option.waterMl)}</span>
        <strong>BAC WATER AMOUNT</strong>
      </div>
      <div class="preview-pill">
        <span>${escapeHtml(buildWaterLine(option))}</span>
        <strong>Draw each dose: ${formatDrawMl(option.doseMl)}</strong>
      </div>
    `;
    saveFillModal.classList.remove("is-hidden");
    saveFillModal.setAttribute("aria-hidden", "false");
    saveFillName.focus();
  }

  function attachSaveButtons(options) {
    resultsGrid.querySelectorAll('[data-action="save-option"]').forEach((button) => {
      button.addEventListener("click", () => {
        const option = options.find((item) => item.id === button.dataset.id);
        if (option) {
          openFallbackSaveFillModal(option);
        }
      });
    });
  }

  function scrollToResults() {
    if (resultsCard) {
      resultsCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderFallbackOptions(force = false) {
    const hasRenderedCards = resultsGrid.querySelector(".result-card");
    if (!force && hasRenderedCards) {
      return;
    }

    const { error, options } = computeOptions();
    if (resultsSummary) {
      resultsSummary.textContent = "These options are built around easy draw amounts from 0.10 mL to 1.00 mL in 0.05 mL steps.";
    }

    if (error) {
      resultsGrid.innerHTML = `<div class="empty-state">${escapeHtml(error)}</div>`;
      return;
    }

    resultsGrid.innerHTML = options.map((option, index) => {
      const recommendedBadge = index === 0 ? '<span class="badge">Recommended</span>' : '';
      const cautionBadge = option.waterMl > RUNTIME_FIX_DEFAULT_MAX_WATER_ML ? '<span class="badge warning">Above 3 mL</span>' : '';
      const cardClass = option.waterMl > RUNTIME_FIX_DEFAULT_MAX_WATER_ML ? 'result-card caution' : 'result-card';
      return `
        <article class="${cardClass} ${index === 0 ? 'recommended' : ''}">
          <div class="card-topline">
            <div>
              <h3><span class="water-amount-emphasis">${formatMl(option.waterMl)}</span> - BAC WATER AMOUNT</h3>
              <p class="card-note">${escapeHtml(buildWaterLine(option))}</p>
            </div>
            ${recommendedBadge || cautionBadge}
          </div>
          <div class="result-metrics">
            <div class="metric">
              <span>Draw each dose</span>
              <strong>${formatDrawMl(option.doseMl)}</strong>
            </div>
          </div>
          <p class="card-note">${escapeHtml(option.guidance)}</p>
          <div class="card-actions">
            <button class="primary-button" type="button" data-action="save-option" data-id="${option.id}">Save Fill</button>
          </div>
        </article>
      `;
    }).join("");

    attachSaveButtons(options);
  }

  function saveFallbackFill() {
    if (!pendingOption) {
      return;
    }

    const name = saveFillName.value.trim() || "Unnamed Peptide Fill";
    const intervalDays = Number(saveFillInterval.value);
    const reminderTime = saveFillTime.value;
    const startDate = saveFillStartDate.value;

    if (!Number.isInteger(intervalDays) || intervalDays < 1 || !reminderTime || !startDate) {
      window.alert("Please enter a valid schedule before saving the fill.");
      return;
    }

    const fill = {
      savedId: crypto.randomUUID(),
      name,
      vialAmount: pendingOption.vialAmount,
      waterMl: pendingOption.waterMl,
      unitLabel: pendingOption.unitLabel,
      syringeMax: pendingOption.syringeMax,
      maxWaterMl: pendingOption.maxWaterMl,
      recommendedDoseAmount: pendingOption.doseAmount,
      concentrationPerMl: pendingOption.concentrationPerMl,
      savedAt: new Date().toISOString(),
    };

    const schedule = {
      id: crypto.randomUUID(),
      fillSavedId: fill.savedId,
      doseAmount: pendingOption.doseAmount,
      doseMl: pendingOption.doseMl,
      unitLabel: fill.unitLabel,
      intervalDays,
      reminderTime,
      startDate,
      createdAt: new Date().toISOString(),
      lastTriggeredAt: null,
      fillSnapshot: fill,
    };

    const fills = [fill, ...getFills()];
    const schedules = [schedule, ...getSchedules()];
    writeFills(fills);
    writeSchedules(schedules);
    localStorage.setItem(RUNTIME_FIX_STORAGE_KEYS.selectedFill, JSON.stringify(fill.savedId));
    localStorage.setItem(RUNTIME_FIX_STORAGE_KEYS.expandedFill, JSON.stringify(fill.savedId));

    if (typeof state !== "undefined") {
      state.selectedFillId = fill.savedId;
      state.expandedFillId = fill.savedId;
      state.latestOptions = [pendingOption];
    }

    closeFallbackSaveFillModal();
    renderFallbackViews();
    setActiveViewFallback("cabinet-view");
    syncRemindersToBackend();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    renderFallbackOptions(true);
    window.setTimeout(scrollToResults, 20);
  }, true);

  saveFillForm.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    saveFallbackFill();
  }, true);

  [closeSaveFill, cancelSaveFill].forEach((button) => {
    button?.addEventListener("click", closeFallbackSaveFillModal, true);
  });

  saveFillModal.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeModal === "true") {
      closeFallbackSaveFillModal();
    }
  }, true);

  ["vial-mg", "dose-mg", "dose-unit", "syringe-max", "max-water-ml"].forEach((id) => {
    const element = document.getElementById(id);
    element?.addEventListener("input", () => window.setTimeout(() => renderFallbackOptions(true), 0));
    element?.addEventListener("change", () => window.setTimeout(() => renderFallbackOptions(true), 0));
  });

  bindFallbackTabs();
  renderFallbackViews();
  const savedView = readJsonStorage(RUNTIME_FIX_STORAGE_KEYS.activeView, "calculator-view");
  setActiveViewFallback(savedView);
  window.setTimeout(() => renderFallbackOptions(false), 50);
})();
