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
};

const state = {
  fills: readStorage(STORAGE_KEYS.fills, []).map(normalizeFill).filter(isValidFill),
  schedules: readStorage(STORAGE_KEYS.schedules, []).map(normalizeSchedule).filter(isValidSchedule),
  selectedFillId: readStorage(STORAGE_KEYS.selectedFill, null),
  expandedFillId: readStorage(STORAGE_KEYS.expandedFill, null),
  theme: readStorage(STORAGE_KEYS.theme, "dark"),
  reorderAlerts: readStorage(STORAGE_KEYS.reorderAlerts, {}),
  userId: readStorage(STORAGE_KEYS.userId, null) || crypto.randomUUID(),
  latestOptions: [],
  pendingSaveOptionId: null,
};

let reminderTimer = null;

initialize();

function initialize() {
  writeStorage(STORAGE_KEYS.userId, state.userId);
  setDefaultDates();
  applyTheme(state.theme);
  updateUnitLabels();
  updateWaterWarning();
  bindEvents();
  renderAll();
  maybeRegisterNativePushIdentity();
  queueNextReminder();
}

function bindEvents() {
  document.querySelectorAll("[data-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.querySelector(button.dataset.jump);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
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
        // Fall back to browser notifications.
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
  elements.saveFillName.value = option.name || "";
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
        <strong>${primarySchedule ? formatDose(primarySchedule.doseAmount, fill.unitLabel) : formatDose(fill.recommendedDoseAmount, fill.unitLabel)}</strong>
      </div>
      <div class="selected-pill">
        <span>Draw</span>
        <strong>${primarySchedule ? formatDrawMl(primarySchedule.doseMl) : formatDrawMl(fill.recommendedDoseAmount / fill.concentrationPerMl)}</strong>
      </div>
      <div class="selected-pill">
        <span>Concentration</span>
        <strong>${formatNumber(fill.concentrationPerMl)} ${escapeHtml(fill.unitLabel)}/mL</strong>
      </div>
      <div class="selected-pill">
        <span>1 mL syringe units</span>
        <strong>${formatUnits((primarySchedule ? primarySchedule.doseMl : fill.recommendedDoseAmount / fill.concentrationPerMl) * 100)}</strong>
      </div>
    </div>
    <p class="card-note">${buildFormulaSummary(fill.vialAmount, fill.waterMl, primarySchedule ? primarySchedule.doseAmount : fill.recommendedDoseAmount, fill.concentrationPerMl, primarySchedule ? primarySchedule.doseMl : fill.recommendedDoseAmount / fill.concentrationPerMl, fill.unitLabel)}</p>
  `;
}

function renderFillSourceOptions() {
  if (!state.fills.length) {
    elements.fillSource.innerHTML = '<option value="">Save a fill first</option>';
    updateScheduleDoseLabel();
    return;
  }

  elements.fillSource.innerHTML = state.fills
    .sort((left, right) => new Date(right.savedAt || 0) - new Date(left.savedAt || 0))
    .map((fill) => `<option value="${fill.savedId}">${escapeHtml(fill.name)}</option>`)
    .join("");

  if (state.selectedFillId && state.fills.some((fill) => fill.savedId === state.selectedFillId)) {
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

  elements.scheduleDoseAmount.value = "";
  setDefaultDates();
  renderCurrentPeptides();
  renderSchedules();
  renderCalendar();
  syncRemindersToBackend();
  queueNextReminder();
}

function renderCurrentPeptides() {
  if (!state.fills.length) {
    elements.currentPeptides.innerHTML = `
      <div class="empty-state">
        No fills saved yet. Save an option above to start your Peptide Cabinet.
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
              <p class="card-note">${usage.refillDue ? `Refill due before ${formatDateTime(usage.refillDue)}.` : usage.totalSchedules ? "This fill has enough medication for the currently saved plan." : "Save a dosage plan to start depletion tracking."}</p>
              ${usage.shouldReorder ? '<p class="reorder-note">4 doses or fewer remain. Re-order soon.</p>' : ""}
            </div>
          </div>

          <div class="peptide-fill-list ${expanded ? "" : "is-collapsed"}">
            <p class="card-note">${buildFormulaSummary(fill.vialAmount, fill.waterMl, schedules[0]?.doseAmount || fill.recommendedDoseAmount, fill.concentrationPerMl, schedules[0]?.doseMl || fill.recommendedDoseAmount / fill.concentrationPerMl, fill.unitLabel)}</p>
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
                  <strong>${formatRefillDue(fill, schedule)}</strong>
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
      document.querySelector("#dosage-card").scrollIntoView({ behavior: "smooth", block: "start" });
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
              <h3>${fill ? escapeHtml(fill.name) : "Saved Dose"}</h3>
              <p class="card-note">${formatDose(schedule.doseAmount, schedule.unitLabel)} • draw ${formatDrawMl(schedule.doseMl)}</p>
            </div>
            <span class="badge">Every ${schedule.intervalDays} day${schedule.intervalDays === 1 ? "" : "s"}</span>
          </div>
          <div class="schedule-metrics">
            <div class="metric">
              <span>Start</span>
              <strong>${formatDate(schedule.startDate)}</strong>
            </div>
            <div class="metric">
              <span>Next reminder</span>
              <strong>${nextDose ? formatDateTime(nextDose) : "Check inputs"}</strong>
            </div>
          </div>
          <div class="card-actions">
            <button class="mini-button" type="button" data-action="test-reminder" data-id="${schedule.id}">Test Alert</button>
            <button class="mini-button" type="button" data-action="delete-reminder" data-id="${schedule.id}">Delete</button>
          </div>
        </article>
      `;
    })
    .join("");

  elements.reminderList.querySelectorAll('[data-action="delete-reminder"]').forEach((button) => {
    button.addEventListener("click", () => deleteSchedule(button.dataset.id));
  });

  elements.reminderList.querySelectorAll('[data-action="test-reminder"]').forEach((button) => {
    button.addEventListener("click", () => {
      const schedule = state.schedules.find((item) => item.id === button.dataset.id);
      if (schedule) {
        fireReminder(schedule);
      }
    });
  });
}

function renderCalendar() {
  const entries = buildCalendarEntries(state.schedules);
  if (!entries.length) {
    elements.calendarList.innerHTML = `
      <div class="empty-state">
        Your calendar is empty right now. Save a fill or add a dosage plan to see upcoming doses here.
      </div>
    `;
    return;
  }

  const groupedByDay = entries.reduce((groups, entry) => {
    const dayKey = entry.when.toISOString().split("T")[0];
    if (!groups[dayKey]) {
      groups[dayKey] = [];
    }
    groups[dayKey].push(entry);
    return groups;
  }, {});

  elements.calendarList.innerHTML = Object.entries(groupedByDay)
    .map(([dayKey, dayEntries]) => `
      <article class="calendar-day">
        <div class="list-topline">
          <div>
            <h3>${formatDate(dayKey)}</h3>
            <p class="card-note">${dayEntries.length} planned dose${dayEntries.length === 1 ? "" : "s"}</p>
          </div>
        </div>
        <div class="calendar-day-list">
          ${dayEntries
            .map((entry) => `
              <div class="calendar-item">
                <div class="list-topline">
                  <div>
                    <h4>${escapeHtml(entry.fillName)}</h4>
                    <p class="subtle-line">${formatDose(entry.doseAmount, entry.unitLabel)} • draw ${formatDrawMl(entry.doseMl)}</p>
                  </div>
                  <span class="badge">${formatTime(entry.when)}</span>
                </div>
              </div>
            `)
            .join("")}
        </div>
      </article>
    `)
    .join("");
}

function buildCalendarEntries(schedules) {
  const now = new Date();
  const entries = [];

  schedules.forEach((schedule) => {
    const fill = resolveScheduleFill(schedule);
    let nextAt = getNextOccurrence(schedule, now);
    let count = 0;

    while (fill && nextAt && count < 4) {
      entries.push({
        scheduleId: schedule.id,
        fillName: fill.name,
        doseAmount: schedule.doseAmount,
        doseMl: schedule.doseMl,
        unitLabel: schedule.unitLabel,
        when: nextAt,
      });
      nextAt = new Date(nextAt.getTime() + schedule.intervalDays * DAY_MS);
      count += 1;
    }
  });

  return entries.sort((left, right) => left.when - right.when).slice(0, 20);
}

function getFillUsageSummary(fill, schedules, fromDate) {
  const sortedSchedules = schedules.slice().sort((left, right) => new Date(left.createdAt || 0) - new Date(right.createdAt || 0));
  const consumedAmount = sortedSchedules.reduce((sum, schedule) => sum + getTakenOccurrences(schedule, fromDate) * schedule.doseAmount, 0);
  const consumedVolume = sortedSchedules.reduce((sum, schedule) => sum + getTakenOccurrences(schedule, fromDate) * schedule.doseMl, 0);
  const remainingAmount = clamp(fill.vialAmount - consumedAmount, 0, fill.vialAmount);
  const remainingVolumeMl = clamp(fill.waterMl - consumedVolume, 0, fill.waterMl);
  const primarySchedule = sortedSchedules[0] || null;
  const dosesLeft = primarySchedule ? Math.floor((remainingAmount / primarySchedule.doseAmount) + 1e-9) : null;
  const nextDose = sortedSchedules
    .map((schedule) => getNextOccurrence(schedule, fromDate))
    .filter(Boolean)
    .sort((left, right) => left - right)[0] || null;
  const reorderLinePercent = primarySchedule ? clamp((primarySchedule.doseMl * 4 * 100) / fill.waterMl, 0, 100) : null;
  return {
    remainingAmount,
    remainingVolumeMl,
    percentRemaining: fill.waterMl ? (remainingVolumeMl / fill.waterMl) * 100 : 0,
    dosesLeft,
    nextDose,
    refillDue: getRefillDueDate(fill, sortedSchedules, fromDate),
    shouldReorder: dosesLeft !== null && dosesLeft <= 4,
    reorderLinePercent,
    totalSchedules: sortedSchedules.length,
  };
}

function getRefillDueDate(fill, schedules, fromDate) {
  if (!schedules.length) {
    return null;
  }

  let remainingAmount = clamp(
    fill.vialAmount - schedules.reduce((sum, schedule) => sum + getTakenOccurrences(schedule, fromDate) * schedule.doseAmount, 0),
    0,
    fill.vialAmount
  );

  const cursors = schedules
    .map((schedule) => ({
      schedule,
      nextAt: getNextOccurrence(schedule, fromDate),
    }))
    .filter((cursor) => cursor.nextAt);

  for (let index = 0; index < 512 && cursors.length; index += 1) {
    cursors.sort((left, right) => left.nextAt - right.nextAt);
    const cursor = cursors[0];
    if (remainingAmount + 1e-9 < cursor.schedule.doseAmount) {
      return cursor.nextAt;
    }
    remainingAmount -= cursor.schedule.doseAmount;
    cursor.nextAt = new Date(cursor.nextAt.getTime() + cursor.schedule.intervalDays * DAY_MS);
  }

  return null;
}

function formatRefillDue(fill, schedule) {
  const usage = getFillUsageSummary(fill, getSchedulesForFill(fill.savedId), new Date());
  return usage.refillDue ? formatDate(usage.refillDue.toISOString()) : "Not soon";
}

function maybeNotifyReorder(fill, usage) {
  const alreadyAlerted = Boolean(state.reorderAlerts[fill.savedId]);
  if (usage.shouldReorder && !alreadyAlerted) {
    state.reorderAlerts[fill.savedId] = true;
    writeStorage(STORAGE_KEYS.reorderAlerts, state.reorderAlerts);
    window.alert(`${fill.name}: 4 doses or fewer remain. Re-order soon.`);
    return;
  }

  if (!usage.shouldReorder && alreadyAlerted) {
    state.reorderAlerts[fill.savedId] = false;
    writeStorage(STORAGE_KEYS.reorderAlerts, state.reorderAlerts);
  }
}

function deleteSchedule(scheduleId) {
  state.schedules = state.schedules.filter((schedule) => schedule.id !== scheduleId);
  writeStorage(STORAGE_KEYS.schedules, state.schedules);
  renderCurrentPeptides();
  renderSchedules();
  renderCalendar();
  syncRemindersToBackend();
  queueNextReminder();
}

function renameFillRecord(fill) {
  const nextNameInput = window.prompt("NAME YOUR PEPTIDE FILL", fill.name);
  if (nextNameInput === null) {
    return;
  }

  const nextName = nextNameInput.trim() || "Unnamed Peptide Fill";
  state.fills = state.fills.map((item) => (item.savedId === fill.savedId ? normalizeFill({ ...item, name: nextName }) : item));
  state.schedules = state.schedules.map((schedule) =>
    schedule.fillSavedId === fill.savedId
      ? normalizeSchedule({
          ...schedule,
          fillSnapshot: {
            ...resolveScheduleFill(schedule),
            name: nextName,
          },
        })
      : schedule
  );

  writeStorage(STORAGE_KEYS.fills, state.fills);
  writeStorage(STORAGE_KEYS.schedules, state.schedules);
  renderSelectedFill();
  renderFillSourceOptions();
  renderCurrentPeptides();
  renderSchedules();
  renderCalendar();
  syncRemindersToBackend();
}

function deleteFillRecord(fill) {
  state.fills = state.fills.filter((item) => item.savedId !== fill.savedId);
  state.schedules = state.schedules.filter((schedule) => schedule.fillSavedId !== fill.savedId);
  if (state.selectedFillId === fill.savedId) {
    state.selectedFillId = state.fills[0]?.savedId || null;
  }
  if (state.expandedFillId === fill.savedId) {
    state.expandedFillId = null;
  }

  writeStorage(STORAGE_KEYS.fills, state.fills);
  writeStorage(STORAGE_KEYS.schedules, state.schedules);
  writeStorage(STORAGE_KEYS.selectedFill, state.selectedFillId);
  writeStorage(STORAGE_KEYS.expandedFill, state.expandedFillId);
  renderAll();
  syncRemindersToBackend();
  queueNextReminder();
}

function queueNextReminder() {
  if (reminderTimer) {
    window.clearTimeout(reminderTimer);
  }

  const now = new Date();
  const upcoming = state.schedules
    .map((schedule) => ({ schedule, nextAt: getNextOccurrence(schedule, now) }))
    .filter((entry) => entry.nextAt)
    .sort((left, right) => left.nextAt - right.nextAt);

  if (!upcoming.length) {
    return;
  }

  const next = upcoming[0];
  const delay = next.nextAt.getTime() - now.getTime();

  if (delay > REMINDER_LOOKAHEAD_MS) {
    reminderTimer = window.setTimeout(queueNextReminder, REMINDER_LOOKAHEAD_MS);
    return;
  }

  reminderTimer = window.setTimeout(() => {
    const freshSchedule = state.schedules.find((item) => item.id === next.schedule.id);
    if (freshSchedule) {
      fireReminder(freshSchedule);
      freshSchedule.lastTriggeredAt = next.nextAt.toISOString();
      writeStorage(STORAGE_KEYS.schedules, state.schedules);
      renderCurrentPeptides();
      renderSchedules();
      renderCalendar();
    }
    queueNextReminder();
  }, Math.max(delay, 1000));
}

function fireReminder(schedule) {
  const fill = resolveScheduleFill(schedule);
  const title = `${fill ? fill.name : "Peptide"} Reminder`;
  const body = `Take ${formatDose(schedule.doseAmount, schedule.unitLabel)} and draw ${formatDrawMl(schedule.doseMl)} from the constituted vial.`;

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "./icon.svg",
    });
  } else {
    window.alert(`${title}\n\n${body}`);
  }
}

function renderNotificationState(forcedPermission) {
  if (hasMedianOneSignal()) {
    elements.notificationStatus.textContent =
      "Median native push is available. Connect OneSignal and a backend to make reminders work even when the app is closed.";
    return;
  }

  if (!("Notification" in window)) {
    elements.notificationStatus.textContent = "This device does not support browser notifications.";
    return;
  }

  const permission = forcedPermission || Notification.permission;
  if (permission === "granted") {
    elements.notificationStatus.textContent = "Notifications are enabled for upcoming reminders.";
  } else if (permission === "denied") {
    elements.notificationStatus.textContent = "Notifications are blocked. Browser alerts will be used instead.";
  } else {
    elements.notificationStatus.textContent =
      "Notifications are not enabled yet. Turn them on for cleaner reminder popups.";
  }
}

function updateUnitLabels() {
  const unitLabel = getCurrentUnitLabel();
  elements.vialAmountLabel.textContent = `Amount in vial (${unitLabel})`;
  elements.doseAmountLabel.textContent = `Desired dose (${unitLabel})`;
  elements.modalDoseLabel.textContent = `Dosage amount (${unitLabel})`;
  updateScheduleDoseLabel();
}

function updateWaterWarning() {
  const maxWaterMl = Number(elements.maxWaterMl.value);
  if (!isPositiveNumber(maxWaterMl)) {
    elements.waterWarning.textContent = "Enter a valid water ceiling in mL.";
    elements.waterWarning.className = "form-message warning";
    return;
  }

  if (maxWaterMl > DEFAULT_MAX_WATER_ML) {
    elements.waterWarning.textContent =
      "More than 3 mL is allowed for easier draw amounts, but many vials cannot comfortably fit more than 3 mL at once.";
    elements.waterWarning.className = "form-message warning";
    return;
  }

  elements.waterWarning.textContent = "Staying at or under 3 mL is usually preferred for vial fit.";
  elements.waterWarning.className = "form-message";
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  elements.themeToggle.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
}

function normalizeFill(fill) {
  const vialAmount = Number(fill?.vialAmount ?? fill?.vialMg);
  const waterMl = Number(fill?.waterMl);
  const unitLabel = fill?.unitLabel || "mg";
  const concentrationPerMl = isPositiveNumber(vialAmount) && isPositiveNumber(waterMl) ? vialAmount / waterMl : Number.NaN;
  return {
    savedId: fill?.savedId || crypto.randomUUID(),
    name: fill?.name || fill?.fillName || fill?.label || fill?.peptideName || "Unnamed Peptide Fill",
    vialAmount,
    waterMl,
    unitLabel,
    concentrationPerMl,
    syringeMax: isPositiveNumber(fill?.syringeMax) ? Number(fill.syringeMax) : null,
    maxWaterMl: isPositiveNumber(fill?.maxWaterMl) ? Number(fill.maxWaterMl) : null,
    recommendedDoseAmount: Number(fill?.recommendedDoseAmount ?? fill?.doseAmount ?? fill?.doseMg ?? 0),
    savedAt: fill?.savedAt || new Date().toISOString(),
  };
}

function normalizeSchedule(schedule) {
  const doseAmount = Number(schedule?.doseAmount ?? schedule?.fill?.doseAmount ?? schedule?.fill?.doseMg);
  const fillSnapshot = schedule?.fillSnapshot ? normalizeFill(schedule.fillSnapshot) : schedule?.fill ? normalizeFill(schedule.fill) : null;
  const fallbackConcentration = fillSnapshot?.concentrationPerMl || Number.NaN;
  const doseMl = Number(schedule?.doseMl ?? (isPositiveNumber(doseAmount) && isPositiveNumber(fallbackConcentration) ? doseAmount / fallbackConcentration : Number.NaN));
  return {
    id: schedule?.id || crypto.randomUUID(),
    fillSavedId: schedule?.fillSavedId || schedule?.fillId || null,
    doseAmount,
    doseMl,
    unitLabel: schedule?.unitLabel || fillSnapshot?.unitLabel || "mg",
    intervalDays: Number(schedule?.intervalDays),
    reminderTime: schedule?.reminderTime || "09:00",
    startDate: schedule?.startDate || new Date().toISOString().split("T")[0],
    createdAt: schedule?.createdAt || new Date().toISOString(),
    lastTriggeredAt: schedule?.lastTriggeredAt || null,
    fillSnapshot,
  };
}

function isValidFill(fill) {
  return fill && isPositiveNumber(fill.vialAmount) && isPositiveNumber(fill.waterMl) && isPositiveNumber(fill.concentrationPerMl);
}

function isValidSchedule(schedule) {
  return Boolean(
    schedule &&
      (schedule.fillSavedId || schedule.fillSnapshot) &&
      isPositiveNumber(schedule.doseAmount) &&
      isPositiveNumber(schedule.doseMl) &&
      schedule.doseMl >= MIN_DRAW_ML &&
      Number.isInteger(schedule.intervalDays) &&
      schedule.intervalDays >= 1 &&
      schedule.startDate &&
      schedule.reminderTime
  );
}

function findFillById(savedId) {
  return state.fills.find((fill) => fill.savedId === savedId) || null;
}

function resolveScheduleFill(schedule) {
  return findFillById(schedule.fillSavedId) || schedule.fillSnapshot || null;
}

function getSchedulesForFill(savedId) {
  return state.schedules.filter((schedule) => schedule.fillSavedId === savedId);
}

function getTakenOccurrences(schedule, fromDate) {
  const start = combineDateAndTime(schedule.startDate, schedule.reminderTime);
  if (!start || start > fromDate) {
    return 0;
  }
  const elapsed = fromDate.getTime() - start.getTime();
  return Math.floor(elapsed / (schedule.intervalDays * DAY_MS)) + 1;
}

function getNextOccurrence(schedule, fromDate) {
  const start = combineDateAndTime(schedule.startDate, schedule.reminderTime);
  if (!start) {
    return null;
  }
  if (start > fromDate) {
    return start;
  }
  const intervalMs = schedule.intervalDays * DAY_MS;
  const elapsed = fromDate.getTime() - start.getTime();
  const steps = Math.floor(elapsed / intervalMs) + 1;
  return new Date(start.getTime() + steps * intervalMs);
}

function hasMedianOneSignal() {
  return Boolean(window.median && window.median.onesignal);
}

function maybeRegisterNativePushIdentity() {
  if (!hasMedianOneSignal()) {
    return;
  }

  const prefix = APP_CONFIG.onesignalExternalIdPrefix || "peptide-calculator-v2";
  const externalId = `${prefix}-${state.userId}`;
  try {
    if (typeof window.median.onesignal.login === "function") {
      window.median.onesignal.login(externalId);
    }
  } catch (error) {
    // Ignore bridge errors during web testing.
  }
}

async function syncRemindersToBackend() {
  if (!APP_CONFIG.backendBaseUrl) {
    return;
  }

  const payload = {
    userId: state.userId,
    schedules: state.schedules
      .map((schedule) => {
        const fill = resolveScheduleFill(schedule);
        if (!fill) {
          return null;
        }
        return {
          id: schedule.id,
          fillSavedId: schedule.fillSavedId,
          fillName: fill.name,
          unitLabel: schedule.unitLabel,
          doseAmount: schedule.doseAmount,
          doseMl: schedule.doseMl,
          intervalDays: schedule.intervalDays,
          reminderTime: schedule.reminderTime,
          startDate: schedule.startDate,
          fill: {
            vialAmount: fill.vialAmount,
            waterMl: fill.waterMl,
            concentrationPerMl: fill.concentrationPerMl,
          },
        };
      })
      .filter(Boolean),
  };

  try {
    await fetch(`${APP_CONFIG.backendBaseUrl.replace(/\/$/, "")}/reminders/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    // Keep the app usable even when the backend is not configured yet.
  }
}

function setDefaultDates() {
  const today = new Date().toISOString().split("T")[0];
  if (!elements.startDate.value) {
    elements.startDate.value = today;
  }
  if (!elements.saveFillStartDate.value) {
    elements.saveFillStartDate.value = today;
  }
}

function combineDateAndTime(dateString, timeString) {
  if (!dateString || !timeString) {
    return null;
  }
  const combined = new Date(`${dateString}T${timeString}:00`);
  return Number.isNaN(combined.getTime()) ? null : combined;
}

function getCurrentUnitLabel() {
  return elements.doseUnit.value || "mg";
}

function readStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeStorage(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function isPositiveNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function roundToStep(value, step) {
  return Number((Math.round(value / step) * step).toFixed(3));
}

function formatMl(value) {
  return `${formatNumber(value)} mL`;
}

function formatDrawMl(value) {
  return `${formatDrawNumber(value)} mL`;
}

function formatDose(value, unitLabel = "mg") {
  return `${formatNumber(value)} ${unitLabel}`;
}

function formatUnits(value) {
  return `${formatNumber(value)} units`;
}

function formatPercent(value) {
  return `${Math.round(value)}%`;
}

function formatNumber(value) {
  return Number(value).toFixed(2).replace(/\.00$/, "");
}

function formatDrawNumber(value) {
  if (value >= 1) {
    return Number(value).toFixed(2).replace(/\.00$/, "");
  }
  return Number(value).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(date) {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildFormulaSummary(vialAmount, waterMl, doseAmount, concentrationPerMl, doseMl, unitLabel) {
  return (
    `${formatNumber(vialAmount)} ${escapeHtml(unitLabel)} / ${formatNumber(waterMl)} mL = ` +
    `${formatNumber(concentrationPerMl)} ${escapeHtml(unitLabel)}/mL. ` +
    `${formatNumber(doseAmount)} ${escapeHtml(unitLabel)} / ${formatNumber(concentrationPerMl)} ${escapeHtml(unitLabel)}/mL = ` +
    `${formatDrawNumber(doseMl)} mL (${formatNumber(doseMl * 100)} units).`
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
