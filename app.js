const DEFAULT_MAX_WATER_ML = 3;
const MIN_DRAW_ML = 0.05;
const DISPLAY_OPTION_LIMIT = 12;
const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_LOOKAHEAD_MS = 2147483647;
const STORAGE_KEYS = {
  fills: "peptide-calculator-v2-fills",
  schedules: "peptide-calculator-v2-schedules",
  selectedFill: "peptide-calculator-v2-selected-fill",
  userId: "peptide-calculator-v2-user-id",
  expandedFill: "peptide-calculator-v2-expanded-fill",
  theme: "peptide-calculator-v2-theme",
  reorderAlerts: "peptide-calculator-v2-reorder-alerts",
  activeView: "peptide-calculator-v2-active-view",
};
const APP_CONFIG = window.APP_CONFIG || {};

const elements = {
  calculatorForm: document.getElementById("calculator-form"),
  vialAmount: document.getElementById("vial-mg"),
  doseAmount: document.getElementById("dose-mg"),
  doseUnit: document.getElementById("dose-unit"),
  syringeMax: document.getElementById("syringe-max"),
  maxWaterMl: document.getElementById("max-water-ml"),
  waterWarning: document.getElementById("water-warning"),
  vialAmountLabel: document.getElementById("vial-amount-label"),
  doseAmountLabel: document.getElementById("dose-amount-label"),
  resultsSummary: document.getElementById("results-summary"),
  resultsGrid: document.getElementById("results-grid"),
  resetForm: document.getElementById("reset-form"),
  selectedFill: document.getElementById("selected-fill"),
  currentPeptides: document.getElementById("current-peptides"),
  dosageForm: document.getElementById("dosage-form"),
  fillSource: document.getElementById("fill-source"),
  scheduleDoseAmount: document.getElementById("schedule-dose-amount"),
  scheduleDoseLabel: document.getElementById("schedule-dose-label"),
  startDate: document.getElementById("start-date"),
  intervalDays: document.getElementById("interval-days"),
  reminderTime: document.getElementById("reminder-time"),
  reminderList: document.getElementById("reminder-list"),
  calendarList: document.getElementById("calendar-list"),
  enableNotifications: document.getElementById("enable-notifications"),
  notificationStatus: document.getElementById("notification-status"),
  themeToggle: document.getElementById("theme-toggle"),
  saveFillModal: document.getElementById("save-fill-modal"),
  saveFillForm: document.getElementById("save-fill-form"),
  saveFillPreview: document.getElementById("save-fill-preview"),
  saveFillName: document.getElementById("save-fill-name"),
  modalDoseLabel: document.getElementById("modal-dose-label"),
  modalDoseDisplay: document.getElementById("modal-dose-display"),
  saveFillInterval: document.getElementById("save-fill-interval"),
  saveFillTime: document.getElementById("save-fill-time"),
  saveFillStartDate: document.getElementById("save-fill-start-date"),
  closeSaveFill: document.getElementById("close-save-fill"),
  cancelSaveFill: document.getElementById("cancel-save-fill"),
  viewTabs: Array.from(document.querySelectorAll("[data-view-target]")),
  views: Array.from(document.querySelectorAll("[data-view]")),
};

const state = {
  fills: readStorage(STORAGE_KEYS.fills, []).map(normalizeFill).filter(isValidFill),
  schedules: readStorage(STORAGE_KEYS.schedules, []).map(normalizeSchedule).filter(isValidSchedule),
  selectedFillId: readStorage(STORAGE_KEYS.selectedFill, null),
  expandedFillId: readStorage(STORAGE_KEYS.expandedFill, null),
  theme: readStorage(STORAGE_KEYS.theme, "dark"),
  reorderAlerts: readStorage(STORAGE_KEYS.reorderAlerts, {}),
  activeView: readStorage(STORAGE_KEYS.activeView, "calculator-view"),
  userId: readStorage(STORAGE_KEYS.userId, null) || crypto.randomUUID(),
  latestOptions: [],
  pendingSaveOptionId: null,
};

let reminderTimer = null;

initialize();

function initialize() {
  writeStorage(STORAGE_KEYS.userId, state.userId);
  if (state.selectedFillId && !findFillById(state.selectedFillId)) {
    state.selectedFillId = state.fills[0]?.savedId || null;
  }
  if (!elements.views.some((view) => view.dataset.view === state.activeView)) {
    state.activeView = "calculator-view";
  }
  setDefaultDates();
  applyTheme(state.theme);
  setActiveView(state.activeView, false);
  updateUnitLabels();
  updateWaterWarning();
  bindEvents();
  renderAll();
  maybeRegisterNativePushIdentity();
  queueNextReminder();
}

function bindEvents() {
  elements.viewTabs.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveView(button.dataset.viewTarget);
    });
  });

  elements.themeToggle.addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    writeStorage(STORAGE_KEYS.theme, state.theme);
    applyTheme(state.theme);
  });

  elements.calculatorForm.addEventListener("submit", (event) => {
    event.preventDefault();
    renderCalculator();
  });

  elements.resetForm.addEventListener("click", () => {
    elements.doseUnit.value = "mg";
    elements.vialAmount.value = "30";
    elements.doseAmount.value = "3";
    elements.syringeMax.value = "1";
    elements.maxWaterMl.value = String(DEFAULT_MAX_WATER_ML);
    updateUnitLabels();
    updateWaterWarning();
    renderCalculator();
  });

  elements.doseUnit.addEventListener("change", () => {
    updateUnitLabels();
    renderCalculator();
  });

  elements.maxWaterMl.addEventListener("input", () => {
    updateWaterWarning();
    renderCalculator();
  });

  elements.fillSource.addEventListener("change", updateScheduleDoseLabel);

  elements.dosageForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveDosagePlan();
  });

  elements.enableNotifications.addEventListener("click", async () => {
    if (hasMedianOneSignal()) {
      try {
        window.median.onesignal.promptForPushNotifications();
        elements.notificationStatus.textContent = "Native push permission request sent through Median.";
        return;
      } catch (error) {
        // Fall through to browser notifications.
      }
    }

    if (!("Notification" in window)) {
      elements.notificationStatus.textContent = "This device does not support browser notifications.";
      return;
    }

    const permission = await Notification.requestPermission();
    renderNotificationState(permission);
  });

  elements.saveFillForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveFillFromModal();
  });

  [elements.closeSaveFill, elements.cancelSaveFill].forEach((button) => {
    button.addEventListener("click", closeSaveFillModal);
  });

  elements.saveFillModal.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeModal === "true") {
      closeSaveFillModal();
    }
  });
}

function renderAll() {
  renderCalculator();
  renderSelectedFill();
  renderFillSourceOptions();
  renderCurrentPeptides();
  renderSchedules();
  renderCalendar();
  renderNotificationState();
}

function setActiveView(viewId, persist = true) {
  state.activeView = viewId;
  elements.views.forEach((view) => {
    view.classList.toggle("is-active", view.dataset.view === viewId);
  });
  elements.viewTabs.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.viewTarget === viewId);
  });
  if (persist) {
    writeStorage(STORAGE_KEYS.activeView, viewId);
  }
}

function renderCalculator() {
  const vialAmount = Number(elements.vialAmount.value);
  const doseAmount = Number(elements.doseAmount.value);
  const syringeMax = Number(elements.syringeMax.value);
  const maxWaterMl = Number(elements.maxWaterMl.value);
  const unitLabel = getCurrentUnitLabel();

  updateWaterWarning();
  elements.resultsSummary.textContent =
    `These options prefer rounded draw amounts and reject anything under ${formatDrawMl(MIN_DRAW_ML)}.`;

  if (!isPositiveNumber(vialAmount) || !isPositiveNumber(doseAmount) || !isPositiveNumber(syringeMax) || !isPositiveNumber(maxWaterMl)) {
    state.latestOptions = [];
    elements.resultsGrid.innerHTML = '<div class="empty-state">Enter valid values to see fill options.</div>';
    return;
  }

  if (doseAmount > vialAmount) {
    state.latestOptions = [];
    elements.resultsGrid.innerHTML =
      '<div class="empty-state">The desired dose cannot be larger than the total amount in the vial.</div>';
    return;
  }

  const options = buildOptions(vialAmount, doseAmount, syringeMax, maxWaterMl, unitLabel);
  state.latestOptions = options;

  if (!options.length) {
    elements.resultsGrid.innerHTML = `
      <div class="empty-state">
        No options fit within a ${formatMl(syringeMax)} syringe while keeping each draw at or above ${formatDrawMl(MIN_DRAW_ML)}.
        Try increasing the water ceiling, using a larger syringe, or lowering the dose target.
      </div>
    `;
    return;
  }

  elements.resultsGrid.innerHTML = options
    .map((option, index) => {
      const recommendedBadge = index === 0 ? '<span class="badge">Recommended</span>' : "";
      const cautionBadge = option.waterMl > DEFAULT_MAX_WATER_ML ? '<span class="badge warning">Above 3 mL</span>' : "";
      const cardClass = option.waterMl > DEFAULT_MAX_WATER_ML ? "result-card caution" : "result-card";
      return `
        <article class="${cardClass} ${index === 0 ? "recommended" : ""}">
          <div class="card-topline">
            <div>
              <h3>${formatMl(option.waterMl)} bacteriostatic water</h3>
              <p class="card-note">${option.guidance}</p>
            </div>
            ${recommendedBadge || cautionBadge}
          </div>

          <div class="result-metrics">
            <div class="metric">
              <span>Draw per dose</span>
              <strong>${formatDrawMl(option.doseMl)}</strong>
            </div>
            <div class="metric">
              <span>Concentration</span>
              <strong>${formatNumber(option.concentrationPerMl)} ${escapeHtml(option.unitLabel)}/mL</strong>
            </div>
            <div class="metric">
              <span>1 mL syringe units</span>
              <strong>${formatUnits(option.insulinUnits)}</strong>
            </div>
          </div>

          <p class="card-note">${buildFormulaSummary(option.vialAmount, option.waterMl, option.doseAmount, option.concentrationPerMl, option.doseMl, option.unitLabel)}</p>
          ${option.waterMl > DEFAULT_MAX_WATER_ML ? '<p class="card-note safety-note">This option is above 3 mL. It may improve measurability, but vial space can become a practical limit.</p>' : ""}

          <div class="card-actions">
            <button class="primary-button" type="button" data-action="save-option" data-id="${option.id}">Save Fill</button>
          </div>
        </article>
      `;
    })
    .join("");

  elements.resultsGrid.querySelectorAll('[data-action="save-option"]').forEach((button) => {
    button.addEventListener("click", () => openSaveFillModal(button.dataset.id));
  });
}

function buildOptions(vialAmount, doseAmount, syringeMax, maxWaterMl, unitLabel) {
  return buildWaterOptions(maxWaterMl)
    .map((waterMl) => {
      const concentrationPerMl = vialAmount / waterMl;
      const doseMl = doseAmount / concentrationPerMl;
      if (!isPositiveNumber(concentrationPerMl) || !isPositiveNumber(doseMl) || doseMl < MIN_DRAW_ML || doseMl > syringeMax) {
        return null;
      }

      const insulinUnits = doseMl * 100;
      return {
        id: `${vialAmount}-${doseAmount}-${syringeMax}-${maxWaterMl}-${waterMl}-${unitLabel}`,
        vialAmount,
        doseAmount,
        syringeMax,
        maxWaterMl,
        waterMl,
        unitLabel,
        concentrationPerMl,
        doseMl,
        insulinUnits,
        score: scoreOption(waterMl, doseMl, syringeMax),
        guidance: describeDraw(doseMl, syringeMax, waterMl),
      };
    })
    .filter(Boolean)
    .filter(auditOption)
    .sort((left, right) => left.score - right.score)
    .slice(0, DISPLAY_OPTION_LIMIT);
}

function buildWaterOptions(maxWaterMl) {
  const options = [];
  const upperBound = Math.max(maxWaterMl, 0.5);
  for (let waterMl = 0.5; waterMl <= upperBound + 0.0001; waterMl += 0.05) {
    options.push(Number(waterMl.toFixed(2)));
  }
  return options;
}

function scoreOption(waterMl, doseMl, syringeMax) {
  const tenthPenalty = Math.abs(doseMl - roundToStep(doseMl, 0.1)) * 140;
  const fiveUnitPenalty = Math.abs(doseMl - roundToStep(doseMl, 0.05)) * 90;
  const comfortPenalty = Math.abs(doseMl - (doseMl < 0.5 ? 0.2 : 0.5)) * 10;
  const syringePenalty = Math.abs((doseMl / syringeMax) - 0.35) * 6;
  const overThreePenalty = waterMl > DEFAULT_MAX_WATER_ML ? 4 + (waterMl - DEFAULT_MAX_WATER_ML) * 4 : 0;
  return tenthPenalty + fiveUnitPenalty + comfortPenalty + syringePenalty + overThreePenalty;
}

function describeDraw(doseMl, syringeMax, waterMl) {
  if (doseMl === roundToStep(doseMl, 0.1)) {
    return "Clean tenth-of-a-mL draw. This should be especially easy to read on the syringe.";
  }
  if (doseMl === roundToStep(doseMl, 0.05)) {
    return "Clean 5-unit draw. This stays at the minimum readability threshold.";
  }

  const ratio = doseMl / syringeMax;
  if (ratio <= 0.3) {
    return waterMl > DEFAULT_MAX_WATER_ML
      ? "Small draw made easier by adding more water than usual."
      : "Small draw with room in the syringe.";
  }
  if (ratio <= 0.75) {
    return "Balanced draw volume that is usually easy to measure.";
  }
  return "Larger draw, but still inside your syringe limit.";
}

function auditOption(option) {
  const expectedConcentration = option.vialAmount / option.waterMl;
  const expectedDoseMl = option.doseAmount / expectedConcentration;
  const expectedUnits = expectedDoseMl * 100;
  const tolerance = 1e-9;
  return (
    Math.abs(option.concentrationPerMl - expectedConcentration) < tolerance &&
    Math.abs(option.doseMl - expectedDoseMl) < tolerance &&
    Math.abs(option.insulinUnits - expectedUnits) < tolerance &&
    option.doseMl >= MIN_DRAW_ML
  );
}

function openSaveFillModal(optionId) {
  const option = state.latestOptions.find((item) => item.id === optionId);
  if (!option) {
    return;
  }

  state.pendingSaveOptionId = optionId;
  elements.saveFillName.value = "";
  elements.modalDoseLabel.textContent = `Dosage amount (${option.unitLabel})`;
  elements.modalDoseDisplay.value = `${formatNumber(option.doseAmount)} ${option.unitLabel}`;
  elements.saveFillInterval.value = elements.intervalDays.value || "7";
  elements.saveFillTime.value = elements.reminderTime.value || "09:00";
  elements.saveFillStartDate.value = elements.startDate.value || new Date().toISOString().split("T")[0];
  elements.saveFillPreview.innerHTML = `
    <div class="preview-pill">
      <span>Add this much BAC water</span>
      <strong>${formatMl(option.waterMl)}</strong>
    </div>
    <div class="preview-pill">
      <span>Draw each dose</span>
      <strong>${formatDrawMl(option.doseMl)}</strong>
    </div>
    <div class="preview-pill">
      <span>Concentration</span>
      <strong>${formatNumber(option.concentrationPerMl)} ${escapeHtml(option.unitLabel)}/mL</strong>
    </div>
    <div class="preview-pill">
      <span>1 mL syringe units</span>
      <strong>${formatUnits(option.insulinUnits)}</strong>
    </div>
  `;
  elements.saveFillModal.classList.remove("is-hidden");
  elements.saveFillModal.setAttribute("aria-hidden", "false");
  elements.saveFillName.focus();
}

function closeSaveFillModal() {
  state.pendingSaveOptionId = null;
  elements.saveFillModal.classList.add("is-hidden");
  elements.saveFillModal.setAttribute("aria-hidden", "true");
}

function saveFillFromModal() {
  const option = state.latestOptions.find((item) => item.id === state.pendingSaveOptionId);
  if (!option) {
    closeSaveFillModal();
    return;
  }

  const name = elements.saveFillName.value.trim() || "Unnamed Peptide Fill";
  const intervalDays = Number(elements.saveFillInterval.value);
  const reminderTime = elements.saveFillTime.value;
  const startDate = elements.saveFillStartDate.value;

  if (!Number.isInteger(intervalDays) || intervalDays < 1 || !reminderTime || !startDate) {
    window.alert("Please enter a valid schedule before saving the fill.");
    return;
  }

  const fill = normalizeFill({
    savedId: crypto.randomUUID(),
    name,
    vialAmount: option.vialAmount,
    waterMl: option.waterMl,
    unitLabel: option.unitLabel,
    syringeMax: option.syringeMax,
    maxWaterMl: option.maxWaterMl,
    recommendedDoseAmount: option.doseAmount,
    savedAt: new Date().toISOString(),
  });

  state.fills = [fill, ...state.fills];
  state.selectedFillId = fill.savedId;
  state.expandedFillId = fill.savedId;
  writeStorage(STORAGE_KEYS.fills, state.fills);
  writeStorage(STORAGE_KEYS.selectedFill, state.selectedFillId);
  writeStorage(STORAGE_KEYS.expandedFill, state.expandedFillId);

  createScheduleForFill(fill, {
    doseAmount: option.doseAmount,
    intervalDays,
    reminderTime,
    startDate,
  });

  closeSaveFillModal();
  renderAll();
  setActiveView("cabinet-view");
  syncRemindersToBackend();
  queueNextReminder();
}

function createScheduleForFill(fill, details) {
  const doseAmount = Number(details.doseAmount);
  const doseMl = doseAmount / fill.concentrationPerMl;

  if (!isPositiveNumber(doseAmount) || !isPositiveNumber(doseMl) || doseMl < MIN_DRAW_ML) {
    return null;
  }

  const schedule = normalizeSchedule({
    id: crypto.randomUUID(),
    fillSavedId: fill.savedId,
    doseAmount,
    doseMl,
    unitLabel: fill.unitLabel,
    intervalDays: details.intervalDays,
    reminderTime: details.reminderTime,
    startDate: details.startDate,
    createdAt: new Date().toISOString(),
    lastTriggeredAt: null,
    fillSnapshot: fill,
  });

  if (!isValidSchedule(schedule)) {
    return null;
  }

  state.schedules = [schedule, ...state.schedules];
  writeStorage(STORAGE_KEYS.schedules, state.schedules);
  return schedule;
}

function renderSelectedFill() {
  const fill = findFillById(state.selectedFillId);
  if (!fill) {
    elements.selectedFill.innerHTML = '<p class="selected-fill-empty">Save a fill option to add it into your Peptide Cabinet.</p>';
    return;
  }

  const primarySchedule = getSchedulesForFill(fill.savedId)[0] || null;
  const preferredDose = primarySchedule ? primarySchedule.doseAmount : fill.recommendedDoseAmount;
  const preferredDraw = primarySchedule ? primarySchedule.doseMl : preferredDose / fill.concentrationPerMl;
  elements.selectedFill.innerHTML = `
    <div class="card-topline">
      <div>
        <span class="section-kicker">Active Fill</span>
        <h3>${escapeHtml(fill.name)}</h3>
        <p class="card-note">Add ${formatMl(fill.waterMl)} BAC water to ${formatDose(fill.vialAmount, fill.unitLabel)} for this fill.</p>
      </div>
      <span class="badge">Ready</span>
    </div>
    <div class="selected-fill-grid">
      <div class="selected-pill">
        <span>Preferred dose</span>
        <strong>${formatDose(preferredDose, fill.unitLabel)}</strong>
      </div>
      <div class="selected-pill">
        <span>Draw</span>
        <strong>${formatDrawMl(preferredDraw)}</strong>
      </div>
      <div class="selected-pill">
        <span>Concentration</span>
        <strong>${formatNumber(fill.concentrationPerMl)} ${escapeHtml(fill.unitLabel)}/mL</strong>
      </div>
      <div class="selected-pill">
        <span>1 mL syringe units</span>
        <strong>${formatUnits(preferredDraw * 100)}</strong>
      </div>
    </div>
    <p class="card-note">${buildFormulaSummary(fill.vialAmount, fill.waterMl, preferredDose, fill.concentrationPerMl, preferredDraw, fill.unitLabel)}</p>
  `;
}

function renderFillSourceOptions() {
  if (!state.fills.length) {
    elements.fillSource.innerHTML = '<option value="">Save a fill first</option>';
    updateScheduleDoseLabel();
    return;
  }

  const fills = state.fills
    .slice()
    .sort((left, right) => new Date(right.savedAt || 0) - new Date(left.savedAt || 0));

  elements.fillSource.innerHTML = fills
    .map((fill) => `<option value="${fill.savedId}">${escapeHtml(fill.name)}</option>`)
    .join("");

  if (state.selectedFillId && fills.some((fill) => fill.savedId === state.selectedFillId)) {
    elements.fillSource.value = state.selectedFillId;
  }

  updateScheduleDoseLabel();
}

function updateScheduleDoseLabel() {
  const fill = findFillById(elements.fillSource.value) || findFillById(state.selectedFillId);
  const unitLabel = fill?.unitLabel || getCurrentUnitLabel();
  elements.scheduleDoseLabel.textContent = `Dosage amount (${unitLabel})`;
  if (fill && !elements.scheduleDoseAmount.value) {
    elements.scheduleDoseAmount.placeholder = formatNumber(fill.recommendedDoseAmount || 0);
  }
}

function saveDosagePlan() {
  const fill = findFillById(elements.fillSource.value);
  const doseAmount = Number(elements.scheduleDoseAmount.value);
  const intervalDays = Number(elements.intervalDays.value);
  const reminderTime = elements.reminderTime.value;
  const startDate = elements.startDate.value;

  if (!fill) {
    window.alert("Save a fill before creating a dosage plan.");
    return;
  }

  if (!isPositiveNumber(doseAmount) || !Number.isInteger(intervalDays) || intervalDays < 1 || !reminderTime || !startDate) {
    window.alert("Please enter a valid dosage amount and schedule.");
    return;
  }

  const doseMl = doseAmount / fill.concentrationPerMl;
  if (doseMl < MIN_DRAW_ML) {
    window.alert(`That draw would be below ${formatDrawMl(MIN_DRAW_ML)}, which this app does not allow.`);
    return;
  }
  if (fill.syringeMax && doseMl > fill.syringeMax) {
    window.alert(`That draw would exceed your saved syringe limit of ${formatMl(fill.syringeMax)}.`);
    return;
  }

  createScheduleForFill(fill, {
    doseAmount,
    intervalDays,
    reminderTime,
    startDate,
  });

  state.selectedFillId = fill.savedId;
  writeStorage(STORAGE_KEYS.selectedFill, state.selectedFillId);
  elements.scheduleDoseAmount.value = "";
  setDefaultDates();
  renderCurrentPeptides();
  renderSchedules();
  renderCalendar();
  setActiveView("calendar-view");
  syncRemindersToBackend();
  queueNextReminder();
}

function renderCurrentPeptides() {
  if (!state.fills.length) {
    elements.currentPeptides.innerHTML = `
      <div class="empty-state">
        No fills saved yet. Save an option in Fill to start your Peptide Cabinet.
      </div>
    `;
    return;
  }

  const now = new Date();
  const fills = [...state.fills].sort((left, right) => new Date(right.savedAt || 0) - new Date(left.savedAt || 0));

  elements.currentPeptides.innerHTML = fills
    .map((fill) => {
      const schedules = getSchedulesForFill(fill.savedId);
      const usage = getFillUsageSummary(fill, schedules, now);
      maybeNotifyReorder(fill, usage);
      const expanded = state.expandedFillId === fill.savedId;
      const liquidPercent = clamp(usage.percentRemaining, 0, 100);
      const threshold = usage.reorderLinePercent;

      return `
        <article class="cabinet-card">
          <div class="fill-header">
            <div>
              <button class="fill-toggle" type="button" data-action="toggle-fill" data-id="${fill.savedId}">
                <span class="caret">${expanded ? "▾" : "▸"}</span>${escapeHtml(fill.name)}
              </button>
              <p class="card-note">Add ${formatMl(fill.waterMl)} BAC water to ${formatDose(fill.vialAmount, fill.unitLabel)}.</p>
            </div>
            <span class="badge ${usage.shouldReorder ? "warning" : ""}">${usage.shouldReorder ? "Re-order" : `${usage.totalSchedules} plan${usage.totalSchedules === 1 ? "" : "s"}`}</span>
          </div>

          <div class="usage-grid">
            <div class="metric">
              <span>Concentration</span>
              <strong>${formatNumber(fill.concentrationPerMl)} ${escapeHtml(fill.unitLabel)}/mL</strong>
            </div>
            <div class="metric">
              <span>Amount left</span>
              <strong>${formatDose(usage.remainingAmount, fill.unitLabel)}</strong>
            </div>
            <div class="metric">
              <span>Doses left</span>
              <strong>${usage.dosesLeft === null ? "Add schedule" : String(usage.dosesLeft)}</strong>
            </div>
          </div>

          <div class="vial-row">
            <div class="vial-visual">
              <div class="vial-meter">
                <div class="vial-liquid" style="height:${liquidPercent}%"></div>
                ${threshold === null ? "" : `<div class="vial-threshold" style="bottom:${threshold}%"></div>`}
              </div>
              <span class="vial-caption">${formatPercent(liquidPercent)} full</span>
            </div>
            <div class="vial-copy">
              <strong>${formatMl(usage.remainingVolumeMl)} liquid remaining</strong>
              <p class="card-note">${usage.nextDose ? `Next dose ${formatDateTime(usage.nextDose)}.` : "No dosage plan saved yet."}</p>
              <p class="card-note">${usage.refillDue ? `Refill due before ${formatDateTime(usage.refillDue)}.` : usage.totalSchedules ? "This fill still covers the currently saved plan." : "Save a dosage plan to start depletion tracking."}</p>
              ${usage.shouldReorder ? '<p class="reorder-note">4 doses or fewer remain. Re-order soon.</p>' : ""}
            </div>
          </div>

          <div class="peptide-fill-list ${expanded ? "" : "is-collapsed"}">
            <div class="card-actions">
              <button class="mini-button" type="button" data-action="use-fill" data-id="${fill.savedId}">Use Fill</button>
              <button class="mini-button" type="button" data-action="add-dosage" data-id="${fill.savedId}">Add Dosage</button>
              <button class="mini-button" type="button" data-action="rename-fill" data-id="${fill.savedId}">Rename</button>
              <button class="mini-button" type="button" data-action="delete-fill" data-id="${fill.savedId}">Delete</button>
            </div>
            ${renderDosageCards(fill, schedules, now)}
          </div>
        </article>
      `;
    })
    .join("");

  attachCabinetEvents();
}

function renderDosageCards(fill, schedules, now) {
  if (!schedules.length) {
    return '<div class="empty-state">No dosage plans yet. Add one to calculate draw amounts and build the calendar.</div>';
  }

  return `
    <div class="dosage-list">
      ${schedules
        .slice()
        .sort((left, right) => new Date(left.createdAt || 0) - new Date(right.createdAt || 0))
        .map((schedule) => {
          const nextDose = getNextOccurrence(schedule, now);
          const taken = getTakenOccurrences(schedule, now);
          return `
            <article class="dosage-card">
              <div class="list-topline">
                <div>
                  <h4>${formatDose(schedule.doseAmount, fill.unitLabel)}</h4>
                  <p class="subtle-line">Draw ${formatDrawMl(schedule.doseMl)} every ${schedule.intervalDays} day${schedule.intervalDays === 1 ? "" : "s"}</p>
                </div>
                <span class="badge">${taken} taken</span>
              </div>
              <div class="schedule-metrics">
                <div class="metric">
                  <span>Next dose</span>
                  <strong>${nextDose ? formatDateTime(nextDose) : "Check inputs"}</strong>
                </div>
                <div class="metric">
                  <span>Refill due</span>
                  <strong>${formatRefillDue(fill)}</strong>
                </div>
              </div>
              <div class="card-actions">
                <button class="mini-button" type="button" data-action="test-reminder" data-id="${schedule.id}">Test Alert</button>
                <button class="mini-button" type="button" data-action="delete-reminder" data-id="${schedule.id}">Delete</button>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function attachCabinetEvents() {
  elements.currentPeptides.querySelectorAll('[data-action="toggle-fill"]').forEach((button) => {
    button.addEventListener("click", () => {
      state.expandedFillId = state.expandedFillId === button.dataset.id ? null : button.dataset.id;
      writeStorage(STORAGE_KEYS.expandedFill, state.expandedFillId);
      renderCurrentPeptides();
    });
  });

  elements.currentPeptides.querySelectorAll('[data-action="use-fill"]').forEach((button) => {
    button.addEventListener("click", () => {
      const fill = findFillById(button.dataset.id);
      if (!fill) {
        return;
      }
      elements.doseUnit.value = fill.unitLabel;
      elements.vialAmount.value = fill.vialAmount;
      elements.doseAmount.value = fill.recommendedDoseAmount || fill.vialAmount;
      elements.syringeMax.value = fill.syringeMax || elements.syringeMax.value;
      elements.maxWaterMl.value = fill.maxWaterMl || Math.max(fill.waterMl, DEFAULT_MAX_WATER_ML);
      state.selectedFillId = fill.savedId;
      writeStorage(STORAGE_KEYS.selectedFill, state.selectedFillId);
      updateUnitLabels();
      updateWaterWarning();
      renderCalculator();
      renderSelectedFill();
      setActiveView("calculator-view");
    });
  });

  elements.currentPeptides.querySelectorAll('[data-action="add-dosage"]').forEach((button) => {
    button.addEventListener("click", () => {
      const fill = findFillById(button.dataset.id);
      if (!fill) {
        return;
      }
      state.selectedFillId = fill.savedId;
      writeStorage(STORAGE_KEYS.selectedFill, state.selectedFillId);
      renderFillSourceOptions();
      elements.fillSource.value = fill.savedId;
      elements.scheduleDoseAmount.value = formatNumber(fill.recommendedDoseAmount || 0).replace(/\.00$/, "");
      updateScheduleDoseLabel();
      setActiveView("schedule-view");
    });
  });

  elements.currentPeptides.querySelectorAll('[data-action="rename-fill"]').forEach((button) => {
    button.addEventListener("click", () => {
      const fill = findFillById(button.dataset.id);
      if (fill) {
        renameFillRecord(fill);
      }
    });
  });

  elements.currentPeptides.querySelectorAll('[data-action="delete-fill"]').forEach((button) => {
    button.addEventListener("click", () => {
      const fill = findFillById(button.dataset.id);
      if (fill) {
        deleteFillRecord(fill);
      }
    });
  });

  elements.currentPeptides.querySelectorAll('[data-action="delete-reminder"]').forEach((button) => {
    button.addEventListener("click", () => deleteSchedule(button.dataset.id));
  });

  elements.currentPeptides.querySelectorAll('[data-action="test-reminder"]').forEach((button) => {
    button.addEventListener("click", () => {
      const schedule = state.schedules.find((item) => item.id === button.dataset.id);
      if (schedule) {
        fireReminder(schedule);
      }
    });
  });
}

function renderSchedules() {
  if (!state.schedules.length) {
    elements.reminderList.innerHTML = `
      <div class="empty-state">
        No dosage plans yet. Saving a fill can create the first schedule automatically.
      </div>
    `;
    return;
  }

  const now = new Date();
  elements.reminderList.innerHTML = state.schedules
    .slice()
    .sort((left, right) => getNextOccurrence(left, now) - getNextOccurrence(right, now))
    .map((schedule) => {
      const fill = resolveScheduleFill(schedule);
      const nextDose = getNextOccurrence(schedule, now);
      return `
        <article class="list-card">
          <div class="list-topline">
            <div>
              <h3>${fill ? escapeHtml(fill.name) : "Saved Dose