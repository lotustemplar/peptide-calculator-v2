const DEFAULT_MAX_WATER_ML = 3;
const MIN_DRAW_ML = 0.05;
const DISPLAY_OPTION_LIMIT = 12;
const STORAGE_KEYS = {
  fills: "peptide-calculator-v2-fills",
  schedules: "peptide-calculator-v2-schedules",
  selectedFill: "peptide-calculator-v2-selected-fill",
  userId: "peptide-calculator-v2-user-id",
};
const REMINDER_LOOKAHEAD_MS = 2147483647;
const APP_CONFIG = window.APP_CONFIG || {};

const elements = {
  calculatorForm: document.getElementById("calculator-form"),
  vialMg: document.getElementById("vial-mg"),
  doseMg: document.getElementById("dose-mg"),
  doseUnit: document.getElementById("dose-unit"),
  syringeMax: document.getElementById("syringe-max"),
  maxWaterMl: document.getElementById("max-water-ml"),
  waterWarning: document.getElementById("water-warning"),
  vialAmountLabel: document.getElementById("vial-amount-label"),
  doseAmountLabel: document.getElementById("dose-amount-label"),
  resultsSummary: document.getElementById("results-summary"),
  resetForm: document.getElementById("reset-form"),
  resultsGrid: document.getElementById("results-grid"),
  selectedFill: document.getElementById("selected-fill"),
  currentPeptides: document.getElementById("current-peptides"),
  reminderForm: document.getElementById("reminder-form"),
  reminderName: document.getElementById("reminder-name"),
  fillSource: document.getElementById("fill-source"),
  startDate: document.getElementById("start-date"),
  intervalDays: document.getElementById("interval-days"),
  reminderTime: document.getElementById("reminder-time"),
  reminderList: document.getElementById("reminder-list"),
  calendarList: document.getElementById("calendar-list"),
  enableNotifications: document.getElementById("enable-notifications"),
  notificationStatus: document.getElementById("notification-status"),
};

const state = {
  fills: readStorage(STORAGE_KEYS.fills, []).map(normalizeFill).filter(isCalculableFill),
  schedules: readStorage(STORAGE_KEYS.schedules, []).map(normalizeSchedule).filter(isValidSchedule),
  selectedOption: normalizeSelection(readStorage(STORAGE_KEYS.selectedFill, null)),
  userId: readStorage(STORAGE_KEYS.userId, null) || crypto.randomUUID(),
  latestOptions: [],
};

let reminderTimer = null;

initialize();

function initialize() {
  writeStorage(STORAGE_KEYS.userId, state.userId);
  setTodayAsDefault();
  updateUnitLabels();
  updateWaterWarning();
  bindEvents();
  renderCalculator();
  renderCurrentPeptides();
  renderFillSourceOptions();
  renderSchedules();
  renderCalendar();
  renderNotificationState();
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

  elements.calculatorForm.addEventListener("submit", (event) => {
    event.preventDefault();
    renderCalculator();
  });

  elements.resetForm.addEventListener("click", () => {
    elements.doseUnit.value = "mg";
    elements.vialMg.value = "10";
    elements.doseMg.value = "0.5";
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

  elements.reminderForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveReminder();
  });

  elements.enableNotifications.addEventListener("click", async () => {
    if (hasMedianOneSignal()) {
      try {
        window.median.onesignal.promptForPushNotifications();
        elements.notificationStatus.textContent = "Native push permission request sent through Median.";
        return;
      } catch (error) {
        // Fall through to web notification permission.
      }
    }

    if (!("Notification" in window)) {
      elements.notificationStatus.textContent = "This device does not support browser notifications.";
      return;
    }

    const permission = await Notification.requestPermission();
    renderNotificationState(permission);
  });
}

function updateUnitLabels() {
  const unitLabel = getCurrentUnitLabel();
  elements.vialAmountLabel.textContent = `Amount in vial (${unitLabel})`;
  elements.doseAmountLabel.textContent = `Desired dose (${unitLabel})`;
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

function renderCalculator() {
  const vialMg = Number(elements.vialMg.value);
  const doseMg = Number(elements.doseMg.value);
  const syringeMax = Number(elements.syringeMax.value);
  const maxWaterMl = Number(elements.maxWaterMl.value);
  const unitLabel = getCurrentUnitLabel();

  updateWaterWarning();
  elements.resultsSummary.textContent =
    `These options prefer rounded draw amounts and reject anything under ${formatDrawMl(MIN_DRAW_ML)}.`;

  if (
    !isPositiveNumber(vialMg) ||
    !isPositiveNumber(doseMg) ||
    !isPositiveNumber(syringeMax) ||
    !isPositiveNumber(maxWaterMl)
  ) {
    elements.resultsGrid.innerHTML = `<div class="empty-state">Enter valid values to see fill options.</div>`;
    state.latestOptions = [];
    renderSelectedFill();
    renderFillSourceOptions();
    return;
  }

  if (doseMg > vialMg) {
    elements.resultsGrid.innerHTML = `
      <div class="empty-state">
        The desired dose cannot be larger than the total amount in the vial.
      </div>
    `;
    state.latestOptions = [];
    renderSelectedFill();
    renderFillSourceOptions();
    return;
  }

  const options = buildOptions(vialMg, doseMg, syringeMax, maxWaterMl, unitLabel);
  state.latestOptions = options;

  if (!options.length) {
    elements.resultsGrid.innerHTML = `
      <div class="empty-state">
        No options fit within a ${formatMl(syringeMax)} syringe while keeping each draw at or above ${formatDrawMl(MIN_DRAW_ML)}.
        Try increasing the maximum water, using a larger syringe, or lowering the dose target.
      </div>
    `;
    renderSelectedFill();
    renderFillSourceOptions();
    return;
  }

  elements.resultsGrid.innerHTML = options
    .map((option, index) => {
      const active = state.selectedOption && state.selectedOption.id === option.id;
      const cautionBadge = option.waterMl > DEFAULT_MAX_WATER_ML ? `<span class="badge warning">Above 3 mL</span>` : "";
      const recommendedBadge = index === 0 ? `<span class="badge">Recommended</span>` : cautionBadge;
      const cardClass = option.waterMl > DEFAULT_MAX_WATER_ML ? "result-card caution" : "result-card";
      return `
        <article class="${cardClass} ${index === 0 ? "recommended" : ""}">
          <div class="card-topline">
            <div>
              <h3>${formatMl(option.waterMl)} bacteriostatic water</h3>
              <p class="card-note">${option.guidance}</p>
            </div>
            ${recommendedBadge}
          </div>

          <div class="result-metrics">
            <div class="metric">
              <span>Draw per dose</span>
              <strong>${formatDrawMl(option.doseMl)}</strong>
            </div>
            <div class="metric">
              <span>Concentration</span>
              <strong>${formatNumber(option.concentrationMgMl)} ${escapeHtml(option.unitLabel)}/mL</strong>
            </div>
            <div class="metric">
              <span>1 mL syringe units</span>
              <strong>${formatUnits(option.insulinUnits)}</strong>
            </div>
          </div>
          <p class="card-note">${option.formulaSummary}</p>
          ${option.waterMl > DEFAULT_MAX_WATER_ML ? `<p class="card-note safety-note">This option is above 3 mL. It may improve measurability, but vial space can become a practical limit.</p>` : ""}

          <div class="card-actions">
            <button class="primary-button" type="button" data-action="select-option" data-id="${option.id}">
              ${active ? "Selected" : "Choose This Fill"}
            </button>
            <button class="secondary-button" type="button" data-action="save-option" data-id="${option.id}">
              Save Fill
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  elements.resultsGrid.querySelectorAll("[data-action='select-option']").forEach((button) => {
    button.addEventListener("click", () => {
      const option = state.latestOptions.find((item) => item.id === button.dataset.id);
      if (!option) {
        return;
      }

      state.selectedOption = normalizeSelection(option);
      writeStorage(STORAGE_KEYS.selectedFill, state.selectedOption);
      renderSelectedFill();
      renderCalculator();
      renderFillSourceOptions();
    });
  });

  elements.resultsGrid.querySelectorAll("[data-action='save-option']").forEach((button) => {
    button.addEventListener("click", () => {
      const option = state.latestOptions.find((item) => item.id === button.dataset.id);
      if (!option) {
        return;
      }

      const peptideNameInput = window.prompt("Peptide name", option.peptideName || "Semaglutide");
      if (peptideNameInput === null) {
        return;
      }

      const peptideName = peptideNameInput.trim() || "Unnamed Peptide";
      const fillNameInput = window.prompt("Fill name", `${peptideName} Fill`);
      if (fillNameInput === null) {
        return;
      }

      const fillName = fillNameInput.trim() || `${peptideName} Fill`;
      const savedFill = normalizeFill({
        ...option,
        savedId: crypto.randomUUID(),
        peptideName,
        fillName,
        label: fillName,
        savedAt: new Date().toISOString(),
      });

      state.fills = [savedFill, ...state.fills];
      state.selectedOption = normalizeSelection(savedFill);
      writeStorage(STORAGE_KEYS.fills, state.fills);
      writeStorage(STORAGE_KEYS.selectedFill, state.selectedOption);
      renderCurrentPeptides();
      renderSelectedFill();
      renderFillSourceOptions();
      syncRemindersToBackend();
    });
  });

  renderSelectedFill();
  renderFillSourceOptions();
}

function buildOptions(vialMg, doseMg, syringeMax, maxWaterMl, unitLabel) {
  const waterOptions = buildWaterOptions(maxWaterMl);

  return waterOptions
    .map((waterMl) => {
      const derived = deriveCalculatedFields({ vialMg, doseMg, waterMl });
      const concentrationMgMl = derived.concentrationMgMl;
      const doseMl = derived.doseMl;

      if (
        !isPositiveNumber(concentrationMgMl) ||
        !isPositiveNumber(doseMl) ||
        doseMl > syringeMax ||
        doseMl < MIN_DRAW_ML
      ) {
        return null;
      }

      return {
        id: `${vialMg}-${doseMg}-${syringeMax}-${maxWaterMl}-${waterMl}-${unitLabel}`,
        vialMg,
        doseMg,
        syringeMax,
        maxWaterMl,
        waterMl,
        unitLabel,
        concentrationMgMl,
        doseMl,
        insulinUnits: derived.insulinUnits,
        score: scoreOption(waterMl, doseMl, syringeMax),
        guidance: describeDraw(doseMl, syringeMax, waterMl),
        formulaSummary: buildFormulaSummary(vialMg, waterMl, doseMg, concentrationMgMl, doseMl, unitLabel),
      };
    })
    .filter(Boolean)
    .filter(auditOption)
    .sort((left, right) => left.score - right.score)
    .slice(0, DISPLAY_OPTION_LIMIT);
}

function buildWaterOptions(maxWaterMl) {
  const options = new Set();
  const upperBound = Math.max(maxWaterMl, 0.5);

  for (let water = 0.5; water <= upperBound + 0.0001; water += 0.05) {
    options.add(Number(water.toFixed(2)));
  }

  return Array.from(options).sort((left, right) => left - right);
}

function scoreOption(waterMl, doseMl, syringeMax) {
  const nearestTenth = Math.round(doseMl / 0.1) * 0.1;
  const nearestFiveUnits = Math.round(doseMl / 0.05) * 0.05;
  const tenthPenalty = Math.abs(doseMl - nearestTenth) * 100;
  const fiveUnitPenalty = Math.abs(doseMl - nearestFiveUnits) * 60;
  const idealCenter = doseMl < 0.5 ? 0.2 : 0.5;
  const comfortPenalty = Math.abs(doseMl - idealCenter) * 8;
  const syringePenalty = Math.abs((doseMl / syringeMax) - 0.35) * 4;
  const overThreePenalty = waterMl > DEFAULT_MAX_WATER_ML ? 2 + (waterMl - DEFAULT_MAX_WATER_ML) * 2 : 0;
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

function renderSelectedFill() {
  if (!state.selectedOption) {
    elements.selectedFill.innerHTML =
      '<p class="selected-fill-empty">Choose one of the options below to mark it as your active fill.</p>';
    return;
  }

  const unitLabel = state.selectedOption.unitLabel || "mg";
  const activeTitle = state.selectedOption.fillName
    ? `${escapeHtml(state.selectedOption.fillName)}`
    : `${formatMl(state.selectedOption.waterMl)} water for ${formatDose(state.selectedOption.vialMg, unitLabel)} vial`;
  const activeSubtitle = state.selectedOption.peptideName
    ? `${escapeHtml(state.selectedOption.peptideName)} • ${formatMl(state.selectedOption.waterMl)} bacteriostatic water`
    : `${formatMl(state.selectedOption.waterMl)} water for ${formatDose(state.selectedOption.vialMg, unitLabel)} vial`;

  elements.selectedFill.innerHTML = `
    <div class="card-topline">
      <div>
        <span class="section-kicker">Active Fill</span>
        <h3>${activeTitle}</h3>
        <p class="card-note">${activeSubtitle}</p>
      </div>
      <span class="badge">Ready</span>
    </div>
    <div class="selected-fill-grid">
      <div class="selected-pill">
        <span>Dose</span>
        <strong>${formatDose(state.selectedOption.doseMg, unitLabel)}</strong>
      </div>
      <div class="selected-pill">
        <span>Draw</span>
        <strong>${formatDrawMl(state.selectedOption.doseMl)}</strong>
      </div>
      <div class="selected-pill">
        <span>Concentration</span>
        <strong>${formatNumber(state.selectedOption.concentrationMgMl)} ${escapeHtml(unitLabel)}/mL</strong>
      </div>
      <div class="selected-pill">
        <span>1 mL syringe units</span>
        <strong>${formatUnits(state.selectedOption.insulinUnits)}</strong>
      </div>
    </div>
    <p class="card-note">${buildFormulaSummary(
      state.selectedOption.vialMg,
      state.selectedOption.waterMl,
      state.selectedOption.doseMg,
      state.selectedOption.concentrationMgMl,
      state.selectedOption.doseMl,
      unitLabel
    )}</p>
  `;
}

function renderCurrentPeptides() {
  if (!state.fills.length) {
    elements.currentPeptides.innerHTML = `
      <div class="empty-state">
        No peptide fills saved yet. Save a named fill like Semaglutide Fill to build your organizer.
      </div>
    `;
    return;
  }

  const groupedFills = groupFillsByPeptide(state.fills);

  elements.currentPeptides.innerHTML = groupedFills
    .map(({ peptideName, fills }) => {
      const peptideSchedules = state.schedules.filter(
        (schedule) => resolvePeptideName(schedule.fill) === peptideName
      );
      const nextReminder = peptideSchedules
        .map((schedule) => getNextOccurrence(schedule, new Date()))
        .filter(Boolean)
        .sort((left, right) => left - right)[0];

      return `
        <article class="peptide-card">
          <div class="list-topline">
            <div>
              <h3>${escapeHtml(peptideName)}</h3>
              <p class="card-note">
                ${fills.length} fill${fills.length === 1 ? "" : "s"} saved
                ${nextReminder ? `• next dose ${formatDateTime(nextReminder)}` : "• no schedule yet"}
              </p>
            </div>
            <span class="badge">${peptideSchedules.length} reminder${peptideSchedules.length === 1 ? "" : "s"}</span>
          </div>

          <div class="peptide-fill-list">
            ${fills
              .map(
                (fill) => `
                  <div class="peptide-fill-item">
                    <div class="list-topline">
                      <div>
                        <h4>${escapeHtml(resolveFillName(fill))}</h4>
                        <p class="subtle-line">
                          Add ${formatMl(fill.waterMl)} BAC water • ${formatDose(fill.vialMg, fill.unitLabel)} vial • ${formatDose(fill.doseMg, fill.unitLabel)} dose
                        </p>
                      </div>
                      <span class="badge">${formatDrawMl(fill.doseMl)} draw</span>
                    </div>

                    <div class="result-metrics">
                      <div class="metric">
                        <span>Concentration</span>
                        <strong>${formatNumber(fill.concentrationMgMl)} ${escapeHtml(fill.unitLabel)}/mL</strong>
                      </div>
                      <div class="metric">
                        <span>1 mL syringe units</span>
                        <strong>${formatUnits(fill.insulinUnits)}</strong>
                      </div>
                      <div class="metric">
                        <span>Max syringe</span>
                        <strong>${fill.syringeMax ? formatMl(fill.syringeMax) : "Not set"}</strong>
                      </div>
                    </div>
                    <p class="card-note">${buildFormulaSummary(
                      fill.vialMg,
                      fill.waterMl,
                      fill.doseMg,
                      fill.concentrationMgMl,
                      fill.doseMl,
                      fill.unitLabel
                    )}</p>

                    <div class="card-actions">
                      <button class="mini-button" type="button" data-action="use-fill" data-id="${fill.savedId}">Use Fill</button>
                      <button class="mini-button" type="button" data-action="delete-fill" data-id="${fill.savedId}">Delete</button>
                    </div>
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
      `;
    })
    .join("");

  elements.currentPeptides.querySelectorAll("[data-action='use-fill']").forEach((button) => {
    button.addEventListener("click", () => {
      const fill = state.fills.find((item) => item.savedId === button.dataset.id);
      if (!fill) {
        return;
      }

      elements.doseUnit.value = fill.unitLabel || "mg";
      elements.vialMg.value = fill.vialMg;
      elements.doseMg.value = fill.doseMg;
      elements.syringeMax.value = fill.syringeMax || elements.syringeMax.value;
      elements.maxWaterMl.value = fill.maxWaterMl || Math.max(fill.waterMl, DEFAULT_MAX_WATER_ML);
      updateUnitLabels();
      updateWaterWarning();
      state.selectedOption = normalizeSelection(fill);
      writeStorage(STORAGE_KEYS.selectedFill, state.selectedOption);
      renderCalculator();
    });
  });

  elements.currentPeptides.querySelectorAll("[data-action='delete-fill']").forEach((button) => {
    button.addEventListener("click", () => {
      state.fills = state.fills.filter((item) => item.savedId !== button.dataset.id);
      writeStorage(STORAGE_KEYS.fills, state.fills);
      renderCurrentPeptides();
      renderFillSourceOptions();
      renderCalendar();
      syncRemindersToBackend();
    });
  });
}

function renderFillSourceOptions() {
  const options = [];

  if (state.selectedOption) {
    options.push({
      key: "current-selection",
      label: `Current selection: ${resolvePeptideName(state.selectedOption)} - ${resolveFillName(
        state.selectedOption
      )} (${formatDrawMl(state.selectedOption.doseMl)} draw)`,
      fill: state.selectedOption,
    });
  }

  state.fills.forEach((fill) => {
    options.push({
      key: fill.savedId,
      label: `${resolvePeptideName(fill)} - ${resolveFillName(fill)}`,
      fill,
    });
  });

  if (!options.length) {
    elements.fillSource.innerHTML = `<option value="">Save or choose a fill first</option>`;
    elements.fillSource.disabled = true;
    return;
  }

  elements.fillSource.disabled = false;
  elements.fillSource.innerHTML = options
    .map((option) => `<option value="${option.key}">${escapeHtml(option.label)}</option>`)
    .join("");
}

function saveReminder() {
  const fillSource = elements.fillSource.value;
  const intervalDays = Number(elements.intervalDays.value);
  const reminderTime = elements.reminderTime.value;
  const startDate = elements.startDate.value;

  if (!fillSource || !intervalDays || intervalDays < 1 || !reminderTime || !startDate) {
    return;
  }

  const fill = resolveFillFromSelection(fillSource);
  if (!fill) {
    return;
  }

  const reminder = {
    id: crypto.randomUUID(),
    name: elements.reminderName.value.trim() || `${formatDose(fill.doseMg, fill.unitLabel)} reminder`,
    intervalDays,
    reminderTime,
    startDate,
    fill: normalizeFill({
      label: fill.label || `${formatDose(fill.doseMg, fill.unitLabel)} dose`,
      peptideName: resolvePeptideName(fill),
      fillName: resolveFillName(fill),
      unitLabel: fill.unitLabel,
      doseMg: fill.doseMg,
      waterMl: fill.waterMl,
      vialMg: fill.vialMg,
      syringeMax: fill.syringeMax,
      maxWaterMl: fill.maxWaterMl,
    }),
    createdAt: new Date().toISOString(),
    lastTriggeredAt: null,
  };

  state.schedules = [reminder, ...state.schedules];
  writeStorage(STORAGE_KEYS.schedules, state.schedules);

  elements.reminderForm.reset();
  setTodayAsDefault();
  elements.intervalDays.value = "2";
  elements.reminderTime.value = "09:00";

  renderSchedules();
  renderCurrentPeptides();
  renderCalendar();
  syncRemindersToBackend();
  queueNextReminder();
}

function resolveFillFromSelection(fillSource) {
  if (fillSource === "current-selection") {
    return state.selectedOption;
  }

  return state.fills.find((fill) => fill.savedId === fillSource) || null;
}

function renderSchedules() {
  if (!state.schedules.length) {
    elements.reminderList.innerHTML = `
      <div class="empty-state">
        No reminders yet. Choose a fill, pick a cadence, and save a schedule.
      </div>
    `;
    return;
  }

  elements.reminderList.innerHTML = state.schedules
    .map((schedule) => {
      const nextDose = getNextOccurrence(schedule, new Date());
      return `
        <article class="list-card">
          <div class="list-topline">
            <div>
              <h3>${escapeHtml(schedule.name)}</h3>
              <p class="card-note">
                ${escapeHtml(resolvePeptideName(schedule.fill))} • ${escapeHtml(resolveFillName(
                  schedule.fill
                ))} • ${formatDrawMl(schedule.fill.doseMl)} draw
              </p>
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
          <p class="card-note">${buildFormulaSummary(
            schedule.fill.vialMg,
            schedule.fill.waterMl,
            schedule.fill.doseMg,
            schedule.fill.concentrationMgMl,
            schedule.fill.doseMl,
            schedule.fill.unitLabel
          )}</p>

          <div class="card-actions">
            <button class="mini-button" type="button" data-action="test-reminder" data-id="${schedule.id}">
              Test Alert
            </button>
            <button class="mini-button" type="button" data-action="delete-reminder" data-id="${schedule.id}">
              Delete
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  elements.reminderList.querySelectorAll("[data-action='delete-reminder']").forEach((button) => {
    button.addEventListener("click", () => {
      state.schedules = state.schedules.filter((schedule) => schedule.id !== button.dataset.id);
      writeStorage(STORAGE_KEYS.schedules, state.schedules);
      renderSchedules();
      renderCurrentPeptides();
      renderCalendar();
      syncRemindersToBackend();
      queueNextReminder();
    });
  });

  elements.reminderList.querySelectorAll("[data-action='test-reminder']").forEach((button) => {
    button.addEventListener("click", () => {
      const schedule = state.schedules.find((item) => item.id === button.dataset.id);
      if (schedule) {
        fireReminder(schedule);
      }
    });
  });
}

function getNextOccurrence(schedule, fromDate) {
  const start = combineDateAndTime(schedule.startDate, schedule.reminderTime);
  if (!start) {
    return null;
  }

  if (start > fromDate) {
    return start;
  }

  const intervalMs = schedule.intervalDays * 24 * 60 * 60 * 1000;
  const elapsed = fromDate.getTime() - start.getTime();
  const steps = Math.floor(elapsed / intervalMs) + 1;
  return new Date(start.getTime() + steps * intervalMs);
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
      renderSchedules();
      renderCurrentPeptides();
      renderCalendar();
    }
    queueNextReminder();
  }, Math.max(delay, 1000));
}

function fireReminder(schedule) {
  const unitLabel = schedule.fill.unitLabel || "mg";
  const title = `${resolvePeptideName(schedule.fill)} Reminder`;
  const body =
    `${resolveFillName(schedule.fill)}: take ${formatDose(schedule.fill.doseMg, unitLabel)} and ` +
    `draw ${formatDrawMl(schedule.fill.doseMl)} from the constituted vial.`;

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

function renderCalendar() {
  const entries = buildCalendarEntries(state.schedules);

  if (!entries.length) {
    elements.calendarList.innerHTML = `
      <div class="empty-state">
        Your calendar is empty right now. Save a reminder to see upcoming peptide doses here.
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
    .map(
      ([dayKey, dayEntries]) => `
        <article class="calendar-day">
          <div class="list-topline">
            <div>
              <h3>${formatDate(dayKey)}</h3>
              <p class="card-note">${dayEntries.length} planned reminder${dayEntries.length === 1 ? "" : "s"}</p>
            </div>
          </div>

          <div class="calendar-day-list">
            ${dayEntries
              .map(
                (entry) => `
                  <div class="calendar-item">
                    <div class="list-topline">
                      <div>
                        <h4>${escapeHtml(entry.peptideName)}</h4>
                        <p class="subtle-line">${escapeHtml(entry.fillName)} • ${escapeHtml(entry.scheduleName)}</p>
                      </div>
                      <span class="badge">${formatTime(entry.when)}</span>
                    </div>
                    <p class="subtle-line">
                      Add ${formatMl(entry.waterMl)} BAC water and draw ${formatDrawMl(entry.doseMl)} for ${formatDose(entry.doseMg, entry.unitLabel)}.
                    </p>
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
      `
    )
    .join("");
}

function setTodayAsDefault() {
  if (!elements.startDate.value) {
    elements.startDate.value = new Date().toISOString().split("T")[0];
  }
}

function combineDateAndTime(dateString, timeString) {
  if (!dateString || !timeString) {
    return null;
  }

  const combined = new Date(`${dateString}T${timeString}:00`);
  return Number.isNaN(combined.getTime()) ? null : combined;
}

function groupFillsByPeptide(fills) {
  const groups = fills.reduce((map, fill) => {
    const peptideName = resolvePeptideName(fill);
    if (!map.has(peptideName)) {
      map.set(peptideName, []);
    }
    map.get(peptideName).push(fill);
    return map;
  }, new Map());

  return Array.from(groups.entries())
    .map(([peptideName, peptideFills]) => ({
      peptideName,
      fills: peptideFills.sort((left, right) => new Date(right.savedAt || 0) - new Date(left.savedAt || 0)),
    }))
    .sort((left, right) => left.peptideName.localeCompare(right.peptideName));
}

function buildCalendarEntries(schedules) {
  const now = new Date();
  const entries = [];

  schedules.forEach((schedule) => {
    let next = getNextOccurrence(schedule, now);
    let count = 0;

    while (next && count < 4) {
      entries.push({
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        peptideName: resolvePeptideName(schedule.fill),
        fillName: resolveFillName(schedule.fill),
        waterMl: schedule.fill.waterMl,
        doseMl: schedule.fill.doseMl,
        doseMg: schedule.fill.doseMg,
        unitLabel: schedule.fill.unitLabel || "mg",
        when: next,
      });

      next = new Date(next.getTime() + schedule.intervalDays * 24 * 60 * 60 * 1000);
      count += 1;
    }
  });

  return entries.sort((left, right) => left.when - right.when).slice(0, 20);
}

function deriveCalculatedFields(fill) {
  const vialMg = Number(fill?.vialMg);
  const doseMg = Number(fill?.doseMg);
  const waterMl = Number(fill?.waterMl);

  if (!isPositiveNumber(vialMg) || !isPositiveNumber(doseMg) || !isPositiveNumber(waterMl)) {
    return {
      concentrationMgMl: Number.NaN,
      doseMl: Number.NaN,
      insulinUnits: Number.NaN,
    };
  }

  const concentrationMgMl = vialMg / waterMl;
  const doseMl = doseMg / concentrationMgMl;
  const insulinUnits = doseMl * 100;

  return {
    concentrationMgMl,
    doseMl,
    insulinUnits,
  };
}

function buildFormulaSummary(vialMg, waterMl, doseMg, concentrationMgMl, doseMl, unitLabel) {
  const insulinUnits = Number(doseMl) * 100;
  return (
    `${formatNumber(vialMg)} ${escapeHtml(unitLabel)} / ${formatNumber(waterMl)} mL = ` +
    `${formatNumber(concentrationMgMl)} ${escapeHtml(unitLabel)}/mL. ` +
    `${formatNumber(doseMg)} ${escapeHtml(unitLabel)} / ${formatNumber(concentrationMgMl)} ${escapeHtml(unitLabel)}/mL = ` +
    `${formatDrawNumber(doseMl)} mL (${formatNumber(insulinUnits)} units).`
  );
}

function auditOption(option) {
  if (!isCalculableFill(option)) {
    return false;
  }

  const expectedConcentration = Number(option.vialMg) / Number(option.waterMl);
  const expectedDoseMl = Number(option.doseMg) / expectedConcentration;
  const expectedUnits = expectedDoseMl * 100;
  const reconstructedVialMg = Number(option.concentrationMgMl) * Number(option.waterMl);
  const tolerance = 1e-9;

  return (
    Math.abs(Number(option.concentrationMgMl) - expectedConcentration) < tolerance &&
    Math.abs(Number(option.doseMl) - expectedDoseMl) < tolerance &&
    Math.abs(Number(option.insulinUnits) - expectedUnits) < tolerance &&
    Math.abs(reconstructedVialMg - Number(option.vialMg)) < tolerance &&
    Number(option.doseMl) >= MIN_DRAW_ML
  );
}

function normalizeFill(fill) {
  const derived = deriveCalculatedFields(fill);
  const peptideName = fill?.peptideName || fill?.peptide || "Unnamed Peptide";
  const fillName = fill?.fillName || fill?.label || `${peptideName} Fill`;
  const unitLabel = fill?.unitLabel || "mg";

  return {
    ...fill,
    vialMg: Number(fill?.vialMg),
    doseMg: Number(fill?.doseMg),
    syringeMax: fill?.syringeMax ? Number(fill.syringeMax) : null,
    maxWaterMl: fill?.maxWaterMl ? Number(fill.maxWaterMl) : null,
    waterMl: Number(fill?.waterMl),
    unitLabel,
    concentrationMgMl: derived.concentrationMgMl,
    doseMl: derived.doseMl,
    insulinUnits: derived.insulinUnits,
    peptideName,
    fillName,
    label: fill?.label || fillName,
  };
}

function normalizeSelection(fill) {
  if (!fill) {
    return null;
  }

  const normalized = normalizeFill(fill);
  return isCalculableFill(normalized) ? normalized : null;
}

function normalizeSchedule(schedule) {
  return {
    ...schedule,
    intervalDays: Number(schedule?.intervalDays),
    fill: normalizeFill(schedule?.fill || {}),
  };
}

function isValidSchedule(schedule) {
  return Boolean(
    schedule &&
      isCalculableFill(schedule.fill) &&
      Number.isInteger(schedule.intervalDays) &&
      schedule.intervalDays >= 1 &&
      schedule.startDate &&
      schedule.reminderTime
  );
}

function isCalculableFill(fill) {
  return (
    fill &&
    isPositiveNumber(fill.vialMg) &&
    isPositiveNumber(fill.doseMg) &&
    isPositiveNumber(fill.waterMl) &&
    Number.isFinite(fill.concentrationMgMl) &&
    Number.isFinite(fill.doseMl) &&
    Number.isFinite(fill.insulinUnits) &&
    fill.doseMg <= fill.vialMg &&
    fill.doseMl >= MIN_DRAW_ML
  );
}

function resolvePeptideName(fill) {
  return fill?.peptideName || fill?.peptide || "Unnamed Peptide";
}

function resolveFillName(fill) {
  return fill?.fillName || fill?.label || `${resolvePeptideName(fill)} Fill`;
}

function getCurrentUnitLabel() {
  return elements.doseUnit.value || "mg";
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
    schedules: state.schedules.map((schedule) => ({
      id: schedule.id,
      name: schedule.name,
      startDate: schedule.startDate,
      reminderTime: schedule.reminderTime,
      intervalDays: schedule.intervalDays,
      fill: {
        peptideName: resolvePeptideName(schedule.fill),
        fillName: resolveFillName(schedule.fill),
        unitLabel: schedule.fill.unitLabel,
        waterMl: schedule.fill.waterMl,
        doseMg: schedule.fill.doseMg,
        doseMl: schedule.fill.doseMl,
        vialMg: schedule.fill.vialMg,
      },
    })),
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
    // Keep the app usable even if the backend is not ready yet.
  }
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
