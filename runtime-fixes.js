const RUNTIME_FIX_DEFAULT_MAX_WATER_ML = 3;
const RUNTIME_FIX_MIN_DRAW_ML = 0.05;
const RUNTIME_FIX_DISPLAY_OPTION_LIMIT = 12;

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
  if (typeof state === "undefined" || !Array.isArray(state?.schedules)) {
    return;
  }

  const payload = {
    userId: getPushExternalIdForSync(),
    schedules: state.schedules
      .map((schedule) => {
        const fill = typeof resolveScheduleFill === "function" ? resolveScheduleFill(schedule) : schedule?.fillSnapshot;
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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    // Keep the app usable even when the backend is unavailable.
  }
}

(function attachRuntimeFixes() {
  const form = document.getElementById("calculator-form");
  const resultsGrid = document.getElementById("results-grid");
  const resultsSummary = document.getElementById("results-summary");

  if (!form || !resultsGrid) {
    return;
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

  function isPositiveNumber(value) {
    return Number.isFinite(value) && value > 0;
  }

  function roundToStep(value, step) {
    return Math.round(value / step) * step;
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
    const overThreePenalty = waterMl > RUNTIME_FIX_DEFAULT_MAX_WATER_ML ? 4 + (waterMl - RUNTIME_FIX_DEFAULT_MAX_WATER_ML) * 4 : 0;
    return tenthPenalty + fiveUnitPenalty + comfortPenalty + syringePenalty + overThreePenalty;
  }

  function describeDraw(doseMl, syringeMax, waterMl) {
    if (Math.abs(doseMl - roundToStep(doseMl, 0.1)) < 1e-9) {
      return "Clean tenth-of-a-mL draw. This should be especially easy to read on the syringe.";
    }
    if (Math.abs(doseMl - roundToStep(doseMl, 0.05)) < 1e-9) {
      return "Clean 5-unit draw. This stays at the minimum readability threshold.";
    }

    const ratio = doseMl / syringeMax;
    if (ratio <= 0.3) {
      return waterMl > RUNTIME_FIX_DEFAULT_MAX_WATER_ML
        ? "Small draw made easier by adding more water than usual."
        : "Small draw with room in the syringe.";
    }
    if (ratio <= 0.75) {
      return "Balanced draw volume that is usually easy to measure.";
    }
    return "Larger draw, but still inside your syringe limit.";
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: value < 1 ? 2 : 0,
      maximumFractionDigits: value < 1 ? 3 : 2,
    }).format(value);
  }

  function formatMl(value) {
    return `${Number(value).toFixed(2)} mL`;
  }

  function formatDrawMl(value) {
    return `${value < 1 ? Number(value).toFixed(3) : Number(value).toFixed(2)} mL`;
  }

  function formatUnits(value) {
    return `${Math.round(value)} units`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function buildFormulaSummary(vialAmount, waterMl, doseAmount, concentrationPerMl, doseMl, unitLabel) {
    return `${formatNumber(vialAmount)} ${unitLabel} / ${formatMl(waterMl)} = ${formatNumber(concentrationPerMl)} ${unitLabel}/mL. ${formatNumber(doseAmount)} ${unitLabel} / ${formatNumber(concentrationPerMl)} ${unitLabel}/mL = ${formatDrawMl(doseMl)}.`;
  }

  function computeOptions() {
    const { vialAmount, doseAmount, syringeMax, maxWaterMl, unitLabel } = getInputs();

    if (!isPositiveNumber(vialAmount) || !isPositiveNumber(doseAmount) || !isPositiveNumber(syringeMax) || !isPositiveNumber(maxWaterMl)) {
      return { error: "Enter valid values to see fill options.", options: [] };
    }

    if (doseAmount > vialAmount) {
      return { error: "The desired dose cannot be larger than the total amount in the vial.", options: [] };
    }

    const options = buildWaterOptions(maxWaterMl)
      .map((waterMl) => {
        const concentrationPerMl = vialAmount / waterMl;
        const doseMl = doseAmount / concentrationPerMl;
        if (!isPositiveNumber(concentrationPerMl) || !isPositiveNumber(doseMl) || doseMl < RUNTIME_FIX_MIN_DRAW_ML || doseMl > syringeMax) {
          return null;
        }

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
          insulinUnits: doseMl * 100,
          score: scoreOption(waterMl, doseMl, syringeMax),
          guidance: describeDraw(doseMl, syringeMax, waterMl),
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.score - right.score)
      .slice(0, RUNTIME_FIX_DISPLAY_OPTION_LIMIT);

    if (!options.length) {
      return {
        error: `No options fit within a ${formatMl(syringeMax)} syringe while keeping each draw at or above ${formatDrawMl(RUNTIME_FIX_MIN_DRAW_ML)}.`,
        options: [],
      };
    }

    return { error: null, options };
  }

  function attachSaveButtons(options) {
    resultsGrid.querySelectorAll('[data-action="save-option"]').forEach((button) => {
      button.addEventListener("click", () => {
        if (typeof state !== "undefined") {
          state.latestOptions = options;
        }
        if (typeof openSaveFillModal === "function") {
          openSaveFillModal(button.dataset.id);
        }
      });
    });
  }

  function renderFallbackOptions(force = false) {
    const hasRenderedCards = resultsGrid.querySelector(".result-card");
    if (!force && hasRenderedCards) {
      return;
    }

    const { error, options } = computeOptions();

    if (resultsSummary) {
      resultsSummary.textContent = `These options prefer rounded draw amounts and reject anything under ${formatDrawMl(RUNTIME_FIX_MIN_DRAW_ML)}.`;
    }

    if (error) {
      resultsGrid.innerHTML = `<div class="empty-state">${escapeHtml(error)}</div>`;
      return;
    }

    resultsGrid.innerHTML = options
      .map((option, index) => {
        const recommendedBadge = index === 0 ? '<span class="badge">Recommended</span>' : "";
        const cautionBadge = option.waterMl > RUNTIME_FIX_DEFAULT_MAX_WATER_ML ? '<span class="badge warning">Above 3 mL</span>' : "";
        const cardClass = option.waterMl > RUNTIME_FIX_DEFAULT_MAX_WATER_ML ? "result-card caution" : "result-card";
        return `
          <article class="${cardClass} ${index === 0 ? "recommended" : ""}">
            <div class="card-topline">
              <div>
                <h3>${formatMl(option.waterMl)} bacteriostatic water</h3>
                <p class="card-note">${escapeHtml(option.guidance)}</p>
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

            <p class="card-note">${escapeHtml(buildFormulaSummary(option.vialAmount, option.waterMl, option.doseAmount, option.concentrationPerMl, option.doseMl, option.unitLabel))}</p>
            ${option.waterMl > RUNTIME_FIX_DEFAULT_MAX_WATER_ML ? '<p class="card-note safety-note">This option is above 3 mL. It may improve measurability, but vial space can become a practical limit.</p>' : ""}

            <div class="card-actions">
              <button class="primary-button" type="button" data-action="save-option" data-id="${option.id}">Save Fill</button>
            </div>
          </article>
        `;
      })
      .join("");

    attachSaveButtons(options);
  }

  form.addEventListener("submit", () => {
    window.setTimeout(() => renderFallbackOptions(true), 0);
  });

  ["vial-mg", "dose-mg", "dose-unit", "syringe-max", "max-water-ml"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => {
      window.setTimeout(() => renderFallbackOptions(true), 0);
    });
    document.getElementById(id)?.addEventListener("change", () => {
      window.setTimeout(() => renderFallbackOptions(true), 0);
    });
  });

  window.setTimeout(() => renderFallbackOptions(false), 50);
})();
