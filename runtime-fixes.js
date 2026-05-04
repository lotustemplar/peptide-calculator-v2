const RUNTIME_FIX_DEFAULT_MAX_WATER_ML = 3;
const RUNTIME_FIX_MIN_DRAW_ML = 0.1;
const RUNTIME_FIX_DRAW_STEP_ML = 0.05;
const RUNTIME_FIX_DISPLAY_OPTION_LIMIT = 18;
const RUNTIME_FIX_STORAGE_KEYS = {
  fills: "peptide-calculator-v2-fills",
  schedules: "peptide-calculator-v2-schedules",
  selectedFill: "peptide-calculator-v2-selected-fill",
  activeView: "peptide-calculator-v2-active-view",
  dailyPromptSeen: "peptide-calculator-v2-daily-prompt-seen",
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
        const fill = schedule?.fillSnapshot;
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
  } catch {
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
  const scheduleView = document.getElementById("schedule-view");
  const scheduleButton = viewTabs.find((button) => button.dataset.viewTarget === "schedule-view");

  if (!form || !resultsGrid || !saveFillModal || !saveFillForm || !currentPeptides || !reminderList || !calendarList) {
    return;
  }

  let pendingOption = null;
  injectFallbackStyles();

  function injectFallbackStyles() {
    if (document.getElementById("runtime-fixes-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "runtime-fixes-style";
    style.textContent = `
      .water-amount-emphasis {
        color: var(--teal);
        font-family: "Sora", sans-serif;
        font-size: 1.2rem;
        font-weight: 700;
      }
      .cabinet-actions-fallback,
      .today-schedule-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 14px;
      }
      .vial-row-fallback {
        display: grid;
        grid-template-columns: 92px minmax(0, 1fr);
        gap: 14px;
        align-items: center;
        margin: 14px 0;
      }
      .vial-visual-fallback {
        display: grid;
        justify-items: center;
        gap: 8px;
      }
      .vial-shell-fallback {
        position: relative;
        width: 66px;
        height: 142px;
        border-radius: 22px 22px 16px 16px;
        border: 1px solid rgba(255,255,255,0.14);
        background: linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03));
        overflow: hidden;
      }
      body[data-theme="light"] .vial-shell-fallback {
        border-color: rgba(16,39,37,0.14);
        background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(232,240,236,0.9));
      }
      .vial-shell-fallback::before {
        content: "";
        position: absolute;
        inset: 8px;
        border-radius: 14px;
        background: rgba(255,255,255,0.05);
      }
      .vial-liquid-fallback {
        position: absolute;
        left: 8px;
        right: 8px;
        bottom: 8px;
        border-radius: 0 0 14px 14px;
        background: linear-gradient(180deg, rgba(63,214,197,0.96), rgba(63,214,197,0.28));
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.4);
      }
      .vial-threshold-fallback {
        position: absolute;
        left: 6px;
        right: 6px;
        height: 2px;
        border-radius: 999px;
        background: rgba(255,130,115,0.95);
        box-shadow: 0 0 0 4px rgba(255,130,115,0.12);
      }
      .vial-remaining-label {
        color: var(--muted);
        font-size: 0.82rem;
      }
      .vial-copy-fallback {
        display: grid;
        gap: 6px;
      }
      .vial-copy-fallback strong {
        font-family: "Sora", sans-serif;
      }
      .tab-button.has-alert {
        color: #ff8a80;
        font-weight: 700;
      }
      .tab-button.has-alert.is-active {
        color: #ffd3cf;
      }
      .today-schedule-banner {
        margin: 0 0 16px;
        padding: 16px;
        border-radius: 18px;
        background: rgba(255,130,115,0.14);
        border: 1px solid rgba(255,130,115,0.2);
      }
      .today-schedule-banner h3 {
        margin: 0 0 8px;
        font-family: "Sora", sans-serif;
        color: #ffb8b1;
      }
      .today-schedule-banner p {
        margin: 0;
        color: var(--muted);
      }
      .today-schedule-card {
        margin-top: 12px;
        padding: 14px;
        border-radius: 16px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
      }
      body[data-theme="light"] .today-schedule-card {
        background: rgba(255,255,255,0.88);
        border-color: rgba(16,39,37,0.08);
      }
      .today-schedule-card h4 {
        margin: 0 0 6px;
        font-family: "Sora", sans-serif;
      }
      .today-schedule-card p {
        margin: 0;
      }
      @media (max-width: 720px) {
        .vial-row-fallback {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

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

  function readFills() {
    if (typeof state !== "undefined" && Array.isArray(state?.fills)) {
      return state.fills;
    }
    return readJsonStorage(RUNTIME_FIX_STORAGE_KEYS.fills, []);
  }

  function readSchedules() {
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

  function persistState(fills, schedules) {
    writeFills(fills);
    writeSchedules(schedules);
    renderAllFallback();
    syncRemindersToBackend();
  }

  function isPositiveNumber(value) {
    return Number.isFinite(value) && value > 0;
  }

  function roundToStep(value, step) {
    return Math.round(value / step) * step;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
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

  function formatDateTime(dateValue, timeValue) {
    return `${formatDate(dateValue)} at ${timeValue}`;
  }

  function todayKey() {
    const now = new Date();
    const month = `${now.getMonth() + 1}`.padStart(2, "0");
    const day = `${now.getDate()}`.padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
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

  function buildWaterLine(option) {
    return `${formatNumber(option.concentrationPerMl)} ${option.unitLabel}/mL concentration`;
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

  function getStartDateTime(schedule) {
    const date = schedule.startDate || todayKey();
    const time = schedule.reminderTime || "09:00";
    return new Date(`${date}T${time}:00`);
  }

  function normalizeSchedule(schedule) {
    return {
      ...schedule,
      takenDates: Array.isArray(schedule.takenDates) ? schedule.takenDates : [],
    };
  }

  function isScheduleDueOnDate(schedule, dateStr) {
    const start = getStartDateTime(schedule);
    const check = new Date(`${dateStr}T00:00:00`);
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const checkDay = new Date(check.getFullYear(), check.getMonth(), check.getDate());
    const diffDays = Math.floor((checkDay.getTime() - startDay.getTime()) / (24 * 60 * 60 * 1000));
    return diffDays >= 0 && diffDays % Number(schedule.intervalDays || 1) === 0;
  }

  function getTakenCount(schedule) {
    return normalizeSchedule(schedule).takenDates.length;
  }

  function getNextDue(schedule, fromDateStr = todayKey()) {
    for (let i = 0; i < 365; i += 1) {
      const probe = new Date(`${fromDateStr}T00:00:00`);
      probe.setDate(probe.getDate() + i);
      const year = probe.getFullYear();
      const month = `${probe.getMonth() + 1}`.padStart(2, "0");
      const day = `${probe.getDate()}`.padStart(2, "0");
      const probeKey = `${year}-${month}-${day}`;
      if (isScheduleDueOnDate(schedule, probeKey) && !normalizeSchedule(schedule).takenDates.includes(probeKey)) {
        return probeKey;
      }
    }
    return null;
  }

  function getTodayDueSchedules() {
    const fills = readFills();
    return readSchedules()
      .map(normalizeSchedule)
      .map((schedule) => {
        const fill = fills.find((item) => item.savedId === schedule.fillSavedId) || schedule.fillSnapshot;
        return { schedule, fill };
      })
      .filter(({ schedule, fill }) => fill && isScheduleDueOnDate(schedule, todayKey()) && !schedule.takenDates.includes(todayKey()));
  }

  function maybeShowDailyBrowserPrompt(count) {
    if (!("Notification" in window) || Notification.permission !== "granted" || count <= 0) {
      return;
    }
    const seen = readJsonStorage(RUNTIME_FIX_STORAGE_KEYS.dailyPromptSeen, null);
    if (seen === todayKey()) {
      return;
    }
    localStorage.setItem(RUNTIME_FIX_STORAGE_KEYS.dailyPromptSeen, JSON.stringify(todayKey()));
    try {
      new Notification(`Schedule (${count})`, {
        body: `You have ${count} peptide dose${count === 1 ? "" : "s"} due today.`,
      });
    } catch {
      // Ignore notification failures.
    }
  }

  function getFillUsage(fill, schedules) {
    const totalAmount = Number(fill.vialAmount || 0);
    const totalConsumed = schedules.reduce((sum, schedule) => sum + (getTakenCount(schedule) * Number(schedule.doseAmount || 0)), 0);
    const remainingAmount = Math.max(totalAmount - totalConsumed, 0);
    const concentrationPerMl = Number(fill.concentrationPerMl || (fill.vialAmount / fill.waterMl) || 0);
    const remainingVolumeMl = concentrationPerMl > 0 ? remainingAmount / concentrationPerMl : 0;
    const primaryDose = Number(schedules[0]?.doseAmount || fill.recommendedDoseAmount || 0);
    const dosesLeft = primaryDose > 0 ? Math.floor(remainingAmount / primaryDose) : null;
    const nextDueKey = schedules.length ? getNextDue(schedules[0]) : null;
    return {
      remainingAmount,
      remainingVolumeMl,
      percentRemaining: totalAmount > 0 ? clamp((remainingAmount / totalAmount) * 100, 0, 100) : 0,
      dosesLeft,
      nextDueKey,
    };
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

  function renderScheduleIndicator() {
    if (!scheduleButton) {
      return;
    }
    const todayCount = getTodayDueSchedules().length;
    scheduleButton.textContent = todayCount > 0 ? `Schedule (${todayCount})` : "Schedule";
    scheduleButton.classList.toggle("has-alert", todayCount > 0);
    maybeShowDailyBrowserPrompt(todayCount);
  }

  function renderFallbackCabinet() {
    const fills = readFills();
    const schedules = readSchedules().map(normalizeSchedule);

    if (!fills.length) {
      currentPeptides.innerHTML = '<div class="empty-state">No fills saved yet.</div>';
      return;
    }

    currentPeptides.innerHTML = fills.map((fill) => {
      const fillSchedules = schedules.filter((schedule) => schedule.fillSavedId === fill.savedId);
      const primarySchedule = fillSchedules[0] || null;
      const usage = getFillUsage(fill, fillSchedules);
      const reorderPercent = usage.dosesLeft !== null && usage.dosesLeft <= 4 ? 40 : 0;
      return `
        <article class="cabinet-card">
          <div class="card-topline">
            <div>
              <h3>${escapeHtml(fill.name)}</h3>
              <p class="card-note"><span class="water-amount-emphasis">${formatMl(fill.waterMl)}</span> - BAC WATER AMOUNT</p>
              <p class="card-note">${escapeHtml(buildWaterLine(fill))}</p>
            </div>
          </div>
          <div class="vial-row-fallback">
            <div class="vial-visual-fallback">
              <div class="vial-shell-fallback">
                <div class="vial-liquid-fallback" style="height:${usage.percentRemaining}%"></div>
                ${reorderPercent ? `<div class="vial-threshold-fallback" style="bottom:${reorderPercent}%"></div>` : ""}
              </div>
              <span class="vial-remaining-label">${formatNumber(usage.percentRemaining)}% left</span>
            </div>
            <div class="vial-copy-fallback">
              <strong>${formatDose(usage.remainingAmount, fill.unitLabel)} remaining</strong>
              <span class="card-note">${formatMl(usage.remainingVolumeMl)} left in the vial</span>
              <span class="card-note">${usage.dosesLeft === null ? "No dose plan yet." : `${usage.dosesLeft} doses left`}</span>
              ${usage.nextDueKey ? `<span class="card-note">Next dose ${formatDateTime(usage.nextDueKey, primarySchedule?.reminderTime || "09:00")}</span>` : ""}
              ${usage.dosesLeft !== null && usage.dosesLeft <= 4 ? '<span class="reorder-note">4 doses or fewer remain. Re-order soon.</span>' : ""}
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
              <div class="metric">
                <span>Frequency</span>
                <strong>Every ${primarySchedule.intervalDays} day${primarySchedule.intervalDays === 1 ? "" : "s"}</strong>
              </div>
            </div>
          ` : '<div class="empty-state">No schedule saved for this fill yet.</div>'}
          <div class="cabinet-actions-fallback">
            <button class="mini-button" type="button" data-action="edit-fill" data-id="${fill.savedId}">Edit</button>
            <button class="mini-button" type="button" data-action="delete-fill" data-id="${fill.savedId}">Delete</button>
          </div>
        </article>
      `;
    }).join("");

    currentPeptides.querySelectorAll('[data-action="edit-fill"]').forEach((button) => {
      button.addEventListener("click", () => editFillRecord(button.dataset.id));
    });
    currentPeptides.querySelectorAll('[data-action="delete-fill"]').forEach((button) => {
      button.addEventListener("click", () => deleteFillRecord(button.dataset.id));
    });
  }

  function renderFallbackSchedules() {
    const fills = readFills();
    const schedules = readSchedules().map(normalizeSchedule);
    const todayDue = getTodayDueSchedules();

    const bannerHtml = todayDue.length
      ? `
        <div class="today-schedule-banner">
          <h3>Schedule (${todayDue.length})</h3>
          <p>${todayDue.length} peptide dose${todayDue.length === 1 ? "" : "s"} due today.</p>
          ${todayDue.map(({ schedule, fill }) => `
            <div class="today-schedule-card">
              <h4>${escapeHtml(fill.name)}</h4>
              <p>${formatDose(schedule.doseAmount, schedule.unitLabel)} at ${escapeHtml(schedule.reminderTime)}. Draw ${formatDrawMl(schedule.doseMl)}.</p>
              <div class="today-schedule-actions">
                <button class="primary-button" type="button" data-action="mark-taken" data-id="${schedule.id}">Mark as taken</button>
              </div>
            </div>
          `).join("")}
        </div>
      `
      : '<div class="empty-state">No peptides are due today.</div>';

    const listHtml = schedules.length
      ? schedules.map((schedule) => {
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
        }).join("")
      : '<div class="empty-state">No dosage plans saved yet.</div>';

    reminderList.innerHTML = `${bannerHtml}${listHtml}`;

    reminderList.querySelectorAll('[data-action="mark-taken"]').forEach((button) => {
      button.addEventListener("click", () => markScheduleTaken(button.dataset.id));
    });
  }

  function renderFallbackCalendar() {
    const fills = readFills();
    const schedules = readSchedules().map(normalizeSchedule);
    if (!schedules.length) {
      calendarList.innerHTML = '<div class="empty-state">No calendar items yet.</div>';
      return;
    }

    calendarList.innerHTML = schedules.map((schedule) => {
      const fill = fills.find((item) => item.savedId === schedule.fillSavedId) || schedule.fillSnapshot;
      const nextDueKey = getNextDue(schedule);
      return `
        <article class="calendar-day">
          <div class="list-topline">
            <div>
              <h3>${escapeHtml(fill?.name || "Saved Fill")}</h3>
              <p class="card-note">Next due ${nextDueKey ? formatDateTime(nextDueKey, schedule.reminderTime) : "scheduled"}</p>
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

  function renderAllFallback() {
    renderScheduleIndicator();
    renderFallbackCabinet();
    renderFallbackSchedules();
    renderFallbackCalendar();
  }

  function markScheduleTaken(scheduleId) {
    const schedules = readSchedules().map(normalizeSchedule);
    const index = schedules.findIndex((schedule) => schedule.id === scheduleId);
    if (index === -1) {
      return;
    }
    const schedule = schedules[index];
    if (!schedule.takenDates.includes(todayKey())) {
      schedule.takenDates = [...schedule.takenDates, todayKey()];
      schedules[index] = schedule;
      persistState(readFills(), schedules);
    }
  }

  function editFillRecord(fillId) {
    const fills = readFills();
    const schedules = readSchedules().map(normalizeSchedule);
    const fillIndex = fills.findIndex((fill) => fill.savedId === fillId);
    if (fillIndex === -1) {
      return;
    }

    const fill = { ...fills[fillIndex] };
    const linkedSchedules = schedules.filter((schedule) => schedule.fillSavedId === fillId);
    const primarySchedule = linkedSchedules[0] || null;

    const nextName = window.prompt("Fill name", fill.name);
    if (nextName === null) {
      return;
    }
    const nextWaterRaw = window.prompt("BAC water amount (mL)", String(fill.waterMl));
    if (nextWaterRaw === null) {
      return;
    }
    const nextDoseRaw = window.prompt(`Dose amount (${fill.unitLabel})`, String(primarySchedule?.doseAmount || fill.recommendedDoseAmount || ""));
    if (nextDoseRaw === null) {
      return;
    }
    const nextIntervalRaw = window.prompt("Every X days", String(primarySchedule?.intervalDays || 7));
    if (nextIntervalRaw === null) {
      return;
    }
    const nextTime = window.prompt("Reminder time (HH:MM)", primarySchedule?.reminderTime || "09:00");
    if (nextTime === null) {
      return;
    }
    const nextStart = window.prompt("Start date (YYYY-MM-DD)", primarySchedule?.startDate || todayKey());
    if (nextStart === null) {
      return;
    }

    const nextWaterMl = Number(nextWaterRaw);
    const nextDoseAmount = Number(nextDoseRaw);
    const nextIntervalDays = Number(nextIntervalRaw);
    const nextConcentration = fill.vialAmount / nextWaterMl;
    const nextDoseMl = nextDoseAmount / nextConcentration;

    if (!isPositiveNumber(nextWaterMl) || !isPositiveNumber(nextDoseAmount) || !Number.isInteger(nextIntervalDays) || nextIntervalDays < 1) {
      window.alert("Please enter valid fill values.");
      return;
    }
    if (!isPositiveNumber(nextDoseMl) || nextDoseMl < RUNTIME_FIX_MIN_DRAW_ML || nextDoseMl > Number(fill.syringeMax || 1)) {
      window.alert(`That dose would require ${formatDrawMl(nextDoseMl)}, which is outside the supported draw range.`);
      return;
    }

    fill.name = nextName.trim() || fill.name;
    fill.waterMl = Number(nextWaterMl.toFixed(2));
    fill.concentrationPerMl = nextConcentration;
    fill.recommendedDoseAmount = nextDoseAmount;
    fill.maxWaterMl = Math.max(fill.maxWaterMl || 0, fill.waterMl);
    fills[fillIndex] = fill;

    const updatedSchedules = schedules.map((schedule) => {
      if (schedule.fillSavedId !== fillId) {
        return schedule;
      }
      return {
        ...schedule,
        doseAmount: nextDoseAmount,
        doseMl: nextDoseMl,
        intervalDays: nextIntervalDays,
        reminderTime: nextTime,
        startDate: nextStart,
        fillSnapshot: fill,
      };
    });

    persistState(fills, updatedSchedules);
  }

  function deleteFillRecord(fillId) {
    const fill = readFills().find((item) => item.savedId === fillId);
    if (!fill) {
      return;
    }
    if (!window.confirm(`Delete ${fill.name} and its linked schedule?`)) {
      return;
    }
    const fills = readFills().filter((item) => item.savedId !== fillId);
    const schedules = readSchedules().filter((item) => item.fillSavedId !== fillId);
    persistState(fills, schedules);
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
    saveFillStartDate.value = document.getElementById("start-date")?.value || todayKey();
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
      const recommendedBadge = index === 0 ? '<span class="badge">Recommended</span>' : "";
      const cautionBadge = option.waterMl > RUNTIME_FIX_DEFAULT_MAX_WATER_ML ? '<span class="badge warning">Above 3 mL</span>' : "";
      const cardClass = option.waterMl > RUNTIME_FIX_DEFAULT_MAX_WATER_ML ? "result-card caution" : "result-card";
      return `
        <article class="${cardClass} ${index === 0 ? "recommended" : ""}">
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
      takenDates: [],
      fillSnapshot: fill,
    };

    const fills = [fill, ...readFills()];
    const schedules = [schedule, ...readSchedules().map(normalizeSchedule)];
    writeFills(fills);
    writeSchedules(schedules);
    localStorage.setItem(RUNTIME_FIX_STORAGE_KEYS.selectedFill, JSON.stringify(fill.savedId));
    if (typeof state !== "undefined") {
      state.selectedFillId = fill.savedId;
      state.latestOptions = [pendingOption];
    }

    closeFallbackSaveFillModal();
    renderAllFallback();
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
  renderAllFallback();
  const savedView = readJsonStorage(RUNTIME_FIX_STORAGE_KEYS.activeView, "calculator-view");
  setActiveViewFallback(savedView);
  window.setTimeout(() => renderFallbackOptions(false), 50);
})();
