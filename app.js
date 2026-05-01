const MAX_WATER_ML = 3;
const PREFERRED_WATER_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
const STORAGE_KEYS = {
  fills: "peptide-calculator-v2-fills",
  schedules: "peptide-calculator-v2-schedules",
  selectedFill: "peptide-calculator-v2-selected-fill",
};
const REMINDER_LOOKAHEAD_MS = 2147483647;

const elements = {
  calculatorForm: document.getElementById("calculator-form"),
  vialMg: document.getElementById("vial-mg"),
  doseMg: document.getElementById("dose-mg"),
  syringeMax: document.getElementById("syringe-max"),
  resetForm: document.getElementById("reset-form"),
  resultsGrid: document.getElementById("results-grid"),
  selectedFill: document.getElementById("selected-fill"),
  savedFills: document.getElementById("saved-fills"),
  reminderForm: document.getElementById("reminder-form"),
  reminderName: document.getElementById("reminder-name"),
  fillSource: document.getElementById("fill-source"),
  startDate: document.getElementById("start-date"),
  intervalDays: document.getElementById("interval-days"),
  reminderTime: document.getElementById("reminder-time"),
  reminderList: document.getElementById("reminder-list"),
  enableNotifications: document.getElementById("enable-notifications"),
  notificationStatus: document.getElementById("notification-status"),
};

const state = {
  fills: readStorage(STORAGE_KEYS.fills, []),
  schedules: readStorage(STORAGE_KEYS.schedules, []),
  selectedOption: readStorage(STORAGE_KEYS.selectedFill, null),
  latestOptions: [],
};

let reminderTimer = null;

initialize();

function initialize() {
  setTodayAsDefault();
  bindEvents();
  renderCalculator();
  renderSavedFills();
  renderFillSourceOptions();
  renderSchedules();
  renderNotificationState();
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
    elements.vialMg.value = "10";
    elements.doseMg.value = "0.5";
    elements.syringeMax.value = "1";
    renderCalculator();
  });

  elements.reminderForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveReminder();
  });

  elements.enableNotifications.addEventListener("click", async () => {
    if (!("Notification" in window)) {
      elements.notificationStatus.textContent = "This device does not support browser notifications.";
      return;
    }

    const permission = await Notification.requestPermission();
    renderNotificationState(permission);
  });
}

function renderCalculator() {
  const vialMg = Number(elements.vialMg.value);
  const doseMg = Number(elements.doseMg.value);
  const syringeMax = Number(elements.syringeMax.value);

  if (!vialMg || !doseMg || !syringeMax || vialMg <= 0 || doseMg <= 0 || syringeMax <= 0) {
    elements.resultsGrid.innerHTML = `<div class="empty-state">Enter valid values to see fill options.</div>`;
    state.latestOptions = [];
    renderSelectedFill();
    renderFillSourceOptions();
    return;
  }

  const options = buildOptions(vialMg, doseMg, syringeMax);
  state.latestOptions = options;

  if (!options.length) {
    elements.resultsGrid.innerHTML = `
      <div class="empty-state">
        No options fit within a ${formatMl(syringeMax)} syringe when water is capped at ${formatMl(MAX_WATER_ML)}.
        Try a smaller dose or a larger syringe.
      </div>
    `;
    renderSelectedFill();
    renderFillSourceOptions();
    return;
  }

  elements.resultsGrid.innerHTML = options
    .map((option, index) => {
      const active = state.selectedOption && state.selectedOption.id === option.id;
      return `
        <article class="result-card ${index === 0 ? "recommended" : ""}">
          <div class="card-topline">
            <div>
              <h3>${formatMl(option.waterMl)} bacteriostatic water</h3>
              <p class="card-note">${option.guidance}</p>
            </div>
            ${index === 0 ? `<span class="badge">Recommended</span>` : ""}
          </div>

          <div class="result-metrics">
            <div class="metric">
              <span>Draw per dose</span>
              <strong>${formatMl(option.doseMl)}</strong>
            </div>
            <div class="metric">
              <span>Concentration</span>
              <strong>${formatNumber(option.concentrationMgMl)} mg/mL</strong>
            </div>
            <div class="metric">
              <span>1 mL syringe units</span>
              <strong>${formatUnits(option.insulinUnits)}</strong>
            </div>
          </div>

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

      state.selectedOption = option;
      writeStorage(STORAGE_KEYS.selectedFill, option);
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

      const label = window.prompt(
        "Give this fill a name",
        `${formatDose(option.doseMg)} from ${formatDose(option.vialMg)} vial`
      );

      if (label === null) {
        return;
      }

      const savedFill = {
        ...option,
        savedId: crypto.randomUUID(),
        label: label.trim() || `${formatDose(option.doseMg)} from ${formatDose(option.vialMg)} vial`,
        savedAt: new Date().toISOString(),
      };

      state.fills = [savedFill, ...state.fills];
      writeStorage(STORAGE_KEYS.fills, state.fills);
      renderSavedFills();
      renderFillSourceOptions();
    });
  });

  renderSelectedFill();
  renderFillSourceOptions();
}

function buildOptions(vialMg, doseMg, syringeMax) {
  const extraWaterOptions = [];
  for (let water = 0.6; water <= MAX_WATER_ML; water += 0.2) {
    extraWaterOptions.push(Number(water.toFixed(2)));
  }

  const uniqueWaterOptions = Array.from(new Set([...PREFERRED_WATER_OPTIONS, ...extraWaterOptions])).sort(
    (left, right) => left - right
  );

  return uniqueWaterOptions
    .map((waterMl) => {
      const concentrationMgMl = vialMg / waterMl;
      const doseMl = doseMg / concentrationMgMl;

      if (doseMl > syringeMax) {
        return null;
      }

      const insulinUnits = doseMl * 100;
      return {
        id: `${vialMg}-${doseMg}-${syringeMax}-${waterMl}`,
        vialMg,
        doseMg,
        syringeMax,
        waterMl,
        concentrationMgMl,
        doseMl,
        insulinUnits,
        score: scoreOption(waterMl, doseMl, syringeMax),
        guidance: describeDraw(doseMl, syringeMax),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.score - right.score)
    .slice(0, 9);
}

function scoreOption(waterMl, doseMl, syringeMax) {
  const drawStepPenalty = Math.abs(doseMl * 20 - Math.round(doseMl * 20));
  const waterStepPenalty = Math.abs(waterMl * 4 - Math.round(waterMl * 4));
  const comfortZone = doseMl / syringeMax;
  const comfortPenalty = Math.abs(comfortZone - 0.45);
  const tinyDrawPenalty = doseMl < 0.05 ? 0.7 : 0;
  return drawStepPenalty * 2 + waterStepPenalty + comfortPenalty + tinyDrawPenalty;
}

function describeDraw(doseMl, syringeMax) {
  const ratio = doseMl / syringeMax;
  if (doseMl < 0.05) {
    return "Very tiny draw. Accurate measuring may be harder.";
  }
  if (ratio <= 0.25) {
    return "Small, easy draw with plenty of room in the syringe.";
  }
  if (ratio <= 0.7) {
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

  elements.selectedFill.innerHTML = `
    <div class="card-topline">
      <div>
        <span class="section-kicker">Active Fill</span>
        <h3>${formatMl(state.selectedOption.waterMl)} water for ${formatDose(state.selectedOption.vialMg)} vial</h3>
      </div>
      <span class="badge">Ready</span>
    </div>
    <div class="selected-fill-grid">
      <div class="selected-pill">
        <span>Dose</span>
        <strong>${formatDose(state.selectedOption.doseMg)}</strong>
      </div>
      <div class="selected-pill">
        <span>Draw</span>
        <strong>${formatMl(state.selectedOption.doseMl)}</strong>
      </div>
      <div class="selected-pill">
        <span>Concentration</span>
        <strong>${formatNumber(state.selectedOption.concentrationMgMl)} mg/mL</strong>
      </div>
      <div class="selected-pill">
        <span>1 mL syringe units</span>
        <strong>${formatUnits(state.selectedOption.insulinUnits)}</strong>
      </div>
    </div>
  `;
}

function renderSavedFills() {
  if (!state.fills.length) {
    elements.savedFills.innerHTML = `
      <div class="empty-state">
        No saved fills yet. Save one from the recommended options so you can reuse it later.
      </div>
    `;
    return;
  }

  elements.savedFills.innerHTML = state.fills
    .map(
      (fill) => `
        <article class="list-card">
          <div class="list-topline">
            <div>
              <h3>${escapeHtml(fill.label)}</h3>
              <p class="card-note">${formatDose(fill.doseMg)} dose from a ${formatDose(fill.vialMg)} vial</p>
            </div>
            <span class="badge">${formatMl(fill.waterMl)} water</span>
          </div>

          <div class="result-metrics">
            <div class="metric">
              <span>Draw</span>
              <strong>${formatMl(fill.doseMl)}</strong>
            </div>
            <div class="metric">
              <span>Concentration</span>
              <strong>${formatNumber(fill.concentrationMgMl)} mg/mL</strong>
            </div>
            <div class="metric">
              <span>1 mL syringe units</span>
              <strong>${formatUnits(fill.insulinUnits)}</strong>
            </div>
          </div>

          <div class="card-actions">
            <button class="mini-button" type="button" data-action="use-fill" data-id="${fill.savedId}">Use Fill</button>
            <button class="mini-button" type="button" data-action="delete-fill" data-id="${fill.savedId}">Delete</button>
          </div>
        </article>
      `
    )
    .join("");

  elements.savedFills.querySelectorAll("[data-action='use-fill']").forEach((button) => {
    button.addEventListener("click", () => {
      const fill = state.fills.find((item) => item.savedId === button.dataset.id);
      if (!fill) {
        return;
      }

      elements.vialMg.value = fill.vialMg;
      elements.doseMg.value = fill.doseMg;
      elements.syringeMax.value = fill.syringeMax;
      state.selectedOption = {
        id: fill.id,
        vialMg: fill.vialMg,
        doseMg: fill.doseMg,
        syringeMax: fill.syringeMax,
        waterMl: fill.waterMl,
        concentrationMgMl: fill.concentrationMgMl,
        doseMl: fill.doseMl,
        insulinUnits: fill.insulinUnits,
      };
      writeStorage(STORAGE_KEYS.selectedFill, state.selectedOption);
      renderCalculator();
    });
  });

  elements.savedFills.querySelectorAll("[data-action='delete-fill']").forEach((button) => {
    button.addEventListener("click", () => {
      state.fills = state.fills.filter((item) => item.savedId !== button.dataset.id);
      writeStorage(STORAGE_KEYS.fills, state.fills);
      renderSavedFills();
      renderFillSourceOptions();
    });
  });
}

function renderFillSourceOptions() {
  const options = [];

  if (state.selectedOption) {
    options.push({
      key: "current-selection",
      label: `Current selection: ${formatMl(state.selectedOption.doseMl)} draw`,
      fill: state.selectedOption,
    });
  }

  state.fills.forEach((fill) => {
    options.push({
      key: fill.savedId,
      label: fill.label,
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
    name: elements.reminderName.value.trim() || `${formatDose(fill.doseMg)} reminder`,
    intervalDays,
    reminderTime,
    startDate,
    fill: {
      label: fill.label || `${formatDose(fill.doseMg)} dose`,
      doseMg: fill.doseMg,
      doseMl: fill.doseMl,
      waterMl: fill.waterMl,
      vialMg: fill.vialMg,
    },
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
                ${escapeHtml(schedule.fill.label)} • ${formatMl(schedule.fill.doseMl)} draw
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
    }
    queueNextReminder();
  }, Math.max(delay, 1000));
}

function fireReminder(schedule) {
  const title = schedule.name;
  const body =
    `Time for ${formatDose(schedule.fill.doseMg)}. ` +
    `Draw ${formatMl(schedule.fill.doseMl)} from your constituted vial.`;

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

function formatMl(value) {
  return `${formatNumber(value)} mL`;
}

function formatDose(value) {
  return `${formatNumber(value)} mg`;
}

function formatUnits(value) {
  return `${formatNumber(value)} units`;
}

function formatNumber(value) {
  return Number(value).toFixed(2).replace(/\.00$/, "");
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
