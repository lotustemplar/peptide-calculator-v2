/* global FitGenP0Ux, state */
(function bindP0Ux() {
  const ux = typeof FitGenP0Ux === "undefined" ? null : FitGenP0Ux;
  if (!ux) {
    return;
  }

  const SELECTED_KEY = "peptide-calculator-v2-selected-fill";

  if (typeof ux.hydrateLegacyMirrors === "function") {
    ux.hydrateLegacyMirrors(window.localStorage);
  }
  if (typeof ux.attachMedicationsWriteBridge === "function") {
    ux.attachMedicationsWriteBridge(window.localStorage);
  }
  const FIELD_IDS = {
    doseUnit: "dose-unit",
    vialAmount: "vial-mg",
    doseAmount: "dose-mg",
    syringeMax: "syringe-max",
    maxWaterMl: "max-water-ml",
  };
  const ERROR_IDS = {
    vialAmount: "vial-mg-error",
    doseAmount: "dose-mg-error",
    syringeMax: "syringe-max-error",
    maxWaterMl: "max-water-ml-error",
  };

  let wizardBaseline = ux.characterizedDefaults();
  let confirmState = null;
  let lastFocus = null;
  let snackbarTimer = null;
  let snackbarUndo = null;

  function readPersisted() {
    return ux.readAppState(window.localStorage);
  }

  function readFills() {
    if (typeof state !== "undefined" && Array.isArray(state.fills)) {
      return state.fills;
    }
    return readPersisted().fills;
  }

  function readSchedules() {
    if (typeof state !== "undefined" && Array.isArray(state.schedules)) {
      return state.schedules;
    }
    return readPersisted().schedules;
  }

  function readOccurrences() {
    if (typeof state !== "undefined" && Array.isArray(state.occurrences)) {
      return state.occurrences;
    }
    return readPersisted().occurrences;
  }

  function writeAppState(next) {
    ux.commitAppState(window.localStorage, next);
    if (typeof state !== "undefined") {
      state.fills = next.fills;
      state.schedules = next.schedules;
      state.occurrences = next.occurrences;
    }
  }

  function rerender() {
    if (window.FitGenRuntimeBridge && typeof window.FitGenRuntimeBridge.renderAll === "function") {
      window.FitGenRuntimeBridge.renderAll();
      return;
    }
    if (typeof window.renderAll === "function") {
      window.renderAll();
    }
  }

  function todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function adapter() {
    return ux.createTakenAdapter({
      readAppState: () => ({
        fills: readFills(),
        schedules: readSchedules(),
        occurrences: readOccurrences(),
      }),
      writeAppState,
      timeZone: ux.resolveTimeZone(),
      nowIso: () => new Date().toISOString(),
    });
  }

  function readWizardValues() {
    return {
      doseUnit: document.getElementById(FIELD_IDS.doseUnit)?.value || "",
      vialAmount: document.getElementById(FIELD_IDS.vialAmount)?.value || "",
      doseAmount: document.getElementById(FIELD_IDS.doseAmount)?.value || "",
      syringeMax: document.getElementById(FIELD_IDS.syringeMax)?.value || "",
      maxWaterMl: document.getElementById(FIELD_IDS.maxWaterMl)?.value || "",
    };
  }

  function writeWizardValues(values) {
    const unit = document.getElementById(FIELD_IDS.doseUnit);
    const vial = document.getElementById(FIELD_IDS.vialAmount);
    const dose = document.getElementById(FIELD_IDS.doseAmount);
    const syringe = document.getElementById(FIELD_IDS.syringeMax);
    const water = document.getElementById(FIELD_IDS.maxWaterMl);
    if (unit) unit.value = values.doseUnit;
    if (vial) vial.value = values.vialAmount;
    if (dose) dose.value = values.doseAmount;
    if (syringe) syringe.value = values.syringeMax;
    if (water) water.value = values.maxWaterMl;
  }

  function clearWizardErrors() {
    Object.values(ERROR_IDS).forEach((id) => {
      const node = document.getElementById(id);
      if (!node) {
        return;
      }
      node.textContent = "";
      node.classList.add("is-hidden");
    });
  }

  function showFieldError(field, message) {
    const errorId = ERROR_IDS[field];
    const node = document.getElementById(errorId);
    if (node) {
      node.textContent = message;
      node.classList.remove("is-hidden");
    }
    const input = document.getElementById(FIELD_IDS[field]);
    if (input && typeof input.focus === "function") {
      input.focus();
    }
  }

  function currentWizardStep() {
    const active = document.querySelector(".wizard-pane.is-active");
    const match = active?.id?.match(/wizard-pane-(\d)/);
    return match ? Number(match[1]) : 1;
  }

  function goToWizardStep(step) {
    document.querySelectorAll(".wizard-pane").forEach((pane, index) => {
      pane.classList.toggle("is-active", index + 1 === step);
    });
    document.querySelectorAll(".wizard-dot").forEach((dot, index) => {
      const dotNum = index + 1;
      dot.classList.toggle("is-active", dotNum === step);
      dot.classList.toggle("is-done", dotNum < step);
    });
  }

  function getDialogNodes() {
    return {
      shell: document.getElementById("fitgen-confirm-dialog"),
      title: document.getElementById("fitgen-confirm-title"),
      body: document.getElementById("fitgen-confirm-body"),
      error: document.getElementById("fitgen-confirm-error"),
      primary: document.getElementById("fitgen-confirm-primary"),
      secondary: document.getElementById("fitgen-confirm-secondary"),
      card: document.getElementById("fitgen-confirm-card"),
    };
  }

  function setDialogError(message) {
    const { error } = getDialogNodes();
    if (!error) {
      return;
    }
    error.textContent = message || "";
    error.classList.toggle("is-hidden", !message);
  }

  function focusables() {
    const { card } = getDialogNodes();
    if (!card) {
      return [];
    }
    return Array.from(card.querySelectorAll(ux.FOCUSABLE_SELECTOR)).filter((node) => {
      return node instanceof HTMLElement && !node.classList.contains("is-hidden");
    });
  }

  function closeDialog(restore) {
    const { shell } = getDialogNodes();
    if (shell) {
      shell.classList.add("is-hidden");
      shell.setAttribute("aria-hidden", "true");
    }
    confirmState = null;
    setDialogError("");
    if (restore && lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
    lastFocus = null;
  }

  function openDialog(model) {
    const nodes = getDialogNodes();
    if (!nodes.shell || !nodes.title || !nodes.body || !nodes.primary || !nodes.secondary) {
      return;
    }
    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    confirmState = model;
    nodes.title.textContent = model.title;
    nodes.body.innerHTML = model.bodyHtml;
    nodes.primary.textContent = model.primaryLabel;
    nodes.secondary.textContent = model.secondaryLabel;
    setDialogError("");
    nodes.shell.classList.remove("is-hidden");
    nodes.shell.setAttribute("aria-hidden", "false");
    window.requestAnimationFrame(() => {
      nodes.title.focus();
    });
  }

  function showSnackbar(scheduleId, dateKey) {
    const bar = document.getElementById("fitgen-undo-snackbar");
    const text = document.getElementById("fitgen-undo-snackbar-text");
    const button = document.getElementById("fitgen-undo-snackbar-btn");
    if (!bar || !button) {
      return;
    }
    if (text) {
      text.textContent = ux.TAKEN_SNACKBAR_TEXT;
    }
    button.textContent = ux.UNDO_LABEL;
    snackbarUndo = { scheduleId, dateKey };
    bar.classList.remove("is-hidden");
    window.clearTimeout(snackbarTimer);
    snackbarTimer = window.setTimeout(() => {
      bar.classList.add("is-hidden");
    }, ux.UNDO_SNACKBAR_MS);
  }

  function hideSnackbar() {
    const bar = document.getElementById("fitgen-undo-snackbar");
    bar?.classList.add("is-hidden");
    window.clearTimeout(snackbarTimer);
    snackbarUndo = null;
  }

  function discardWizard() {
    writeWizardValues(ux.discardWizardDraft());
    wizardBaseline = ux.characterizedDefaults();
    clearWizardErrors();
    goToWizardStep(1);
    const results = document.getElementById("results-grid");
    if (results) {
      results.innerHTML = "";
    }
  }

  function handleWizardNext(event) {
    const button = event.target.closest(".wizard-next-btn");
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    const step = currentWizardStep();
    clearWizardErrors();
    const result = ux.validateWizardStep(step, readWizardValues());
    if (!result.ok) {
      const field = ux.firstInvalidField(result);
      const error = result.errors[0];
      if (field && error) {
        showFieldError(field, error.message);
      }
      return;
    }
    const target = Number(button.dataset.next);
    if (target) {
      goToWizardStep(target);
    }
  }

  function handleWizardCancel(event) {
    const button = event.target.closest(".wizard-cancel-btn");
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!ux.isWizardDirty(readWizardValues(), wizardBaseline)) {
      goToWizardStep(1);
      return;
    }
    openDialog({
      kind: "discard-dirty",
      title: ux.DISCARD_TITLE,
      bodyHtml: `<p>${ux.CHARACTERIZED_DEFAULTS_NOTE}</p>`,
      primaryLabel: ux.DISCARD_CONFIRM,
      secondaryLabel: ux.DISCARD_KEEP,
      allowEscape: true,
      onPrimary() {
        discardWizard();
        closeDialog(true);
      },
    });
  }

  function handleWizardBack(event) {
    const button = event.target.closest(".wizard-back-btn");
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    const target = Number(button.dataset.back);
    if (target) {
      clearWizardErrors();
      goToWizardStep(target);
    }
  }

  function syncTabAria() {
    if (typeof ux.syncTabAria === "function") {
      ux.syncTabAria(document);
      return;
    }
    const active = document.querySelector(".app-view.is-active");
    const viewId = active ? active.id : "";
    document.querySelectorAll("[data-view-target]").forEach((tab) => {
      if (tab.getAttribute("data-view-target") === viewId) {
        tab.setAttribute("aria-current", "page");
      } else {
        tab.removeAttribute("aria-current");
      }
    });
  }

  function pendingSaveOption() {
    if (window.FitGenRuntimeBridge && window.FitGenRuntimeBridge.getPendingOption) {
      return window.FitGenRuntimeBridge.getPendingOption();
    }
    if (typeof state !== "undefined" && state.pendingSaveOptionId && Array.isArray(state.latestOptions)) {
      return state.latestOptions.find((item) => item.id === state.pendingSaveOptionId) || null;
    }
    return null;
  }

  function showSaveFormError(message) {
    const node = document.getElementById("save-fill-error");
    if (!node) {
      return;
    }
    node.textContent = message || "";
    node.classList.toggle("is-hidden", !message);
  }

  function handleSaveSubmit(event) {
    if (event.target !== document.getElementById("save-fill-form")) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    showSaveFormError("");
    const option = pendingSaveOption();
    if (!option) {
      return;
    }
    const name = (document.getElementById("save-fill-name")?.value || "").trim() || "Unnamed Peptide Fill";
    const intervalDays = Number(document.getElementById("save-fill-interval")?.value);
    const reminderTime = document.getElementById("save-fill-time")?.value || "";
    const startDate = document.getElementById("save-fill-start-date")?.value || "";
    const scheduleCheck = ux.validateSaveSchedule(intervalDays, reminderTime, startDate);
    if (!scheduleCheck.ok) {
      showSaveFormError(scheduleCheck.message);
      const fieldId =
        scheduleCheck.field === "intervalDays"
          ? "save-fill-interval"
          : scheduleCheck.field === "reminderTime"
            ? "save-fill-time"
            : "save-fill-start-date";
      document.getElementById(fieldId)?.focus();
      return;
    }
    const summary = ux.buildSaveSummary({
      name,
      vialAmount: option.vialAmount,
      unitLabel: option.unitLabel,
      doseAmount: option.doseAmount,
      waterMl: option.waterMl,
      doseMl: option.doseMl,
      insulinUnits: option.insulinUnits ?? null,
      concentrationPerMl: option.concentrationPerMl,
      intervalDays,
      reminderTime,
      startDate,
    });
    const rows = summary.rows
      .map((row) => `<div><dt>${row.label}</dt><dd>${row.value}</dd></div>`)
      .join("");
    openDialog({
      kind: "save-confirm",
      title: summary.title,
      bodyHtml: `<dl>${rows}</dl><p class="fitgen-dialog-disclaimer">${summary.disclaimer}</p>`,
      primaryLabel: ux.SAVE_CONFIRM_PRIMARY,
      secondaryLabel: ux.SAVE_CONFIRM_CANCEL,
      allowEscape: true,
      onPrimary() {
        try {
          persistFill(option, { name, intervalDays, reminderTime, startDate });
        } catch {
          setDialogError(ux.PERSIST_FAIL_ERROR);
          return;
        }
        closeDialog(false);
        if (window.FitGenRuntimeBridge?.closeSaveModal) {
          window.FitGenRuntimeBridge.closeSaveModal();
        }
        if (window.FitGenRuntimeBridge?.setView) {
          window.FitGenRuntimeBridge.setView("cabinet-view");
        }
        rerender();
      },
    });
  }

  function persistFill(option, fields) {
    const fill = {
      savedId: crypto.randomUUID(),
      name: fields.name,
      vialAmount: option.vialAmount,
      waterMl: option.waterMl,
      unitLabel: option.unitLabel,
      syringeMax: option.syringeMax,
      maxWaterMl: option.maxWaterMl,
      recommendedDoseAmount: option.doseAmount,
      concentrationPerMl: option.concentrationPerMl,
      depletionRemaining: option.vialAmount,
      depletionUnit: option.unitLabel,
      lifecycle: "active",
      savedAt: new Date().toISOString(),
    };
    const schedule = {
      id: crypto.randomUUID(),
      fillSavedId: fill.savedId,
      doseAmount: option.doseAmount,
      doseMl: option.doseMl,
      unitLabel: fill.unitLabel,
      intervalDays: fields.intervalDays,
      reminderTime: fields.reminderTime,
      startDate: fields.startDate,
      takenDates: [],
      fillSnapshot: fill,
      lifecycle: "active",
    };
    const next = {
      fills: [fill, ...readFills()],
      schedules: [schedule, ...readSchedules()],
      occurrences: readOccurrences(),
    };
    writeAppState(next);
    window.localStorage.setItem(SELECTED_KEY, JSON.stringify(fill.savedId));
    if (typeof state !== "undefined") {
      state.selectedFillId = fill.savedId;
      state.expandedFillId = fill.savedId;
    }
    if (window.FitGenRuntimeBridge?.persistAndRender) {
      window.FitGenRuntimeBridge.persistAndRender(next.fills, next.schedules);
    }
  }

  function handleDeleteFill(event) {
    const button = event.target.closest("[data-action='delete-fill']");
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    const fill = readFills().find((item) => item.savedId === button.dataset.id);
    const plan = ux.planCabinetCascade(fill, readSchedules());
    if (!plan) {
      return;
    }
    openDialog({
      kind: "cabinet-delete",
      title: ux.cabinetDeleteTitle(plan.fillName),
      bodyHtml: `<p>${ux.cabinetDeleteBody(plan.scheduleCount, plan.historicalTakenCount)}</p>`,
      primaryLabel: ux.CABINET_DELETE_PRIMARY,
      secondaryLabel: ux.CABINET_DELETE_CANCEL,
      allowEscape: true,
      onPrimary() {
        try {
          const applied = ux.applyCabinetArchive({
            fills: readFills(),
            schedules: readSchedules(),
            occurrences: readOccurrences(),
            fillId: plan.fillId,
            todayKey: todayKey(),
          });
          writeAppState(applied);
          if (typeof state !== "undefined") {
            if (state.selectedFillId === plan.fillId) {
              const remaining = ux.activeFills(applied.fills);
              state.selectedFillId = remaining[0]?.savedId || null;
            }
            if (state.expandedFillId === plan.fillId) {
              state.expandedFillId = null;
            }
          }
          if (window.FitGenRuntimeBridge?.persistAndRender) {
            window.FitGenRuntimeBridge.persistAndRender(applied.fills, applied.schedules);
          } else {
            rerender();
          }
        } catch {
          setDialogError(ux.PERSIST_FAIL_ERROR);
          return;
        }
        closeDialog(true);
      },
    });
  }

  function showInlineTakenError(host, message) {
    let node = host.querySelector(".fitgen-taken-error");
    if (!node) {
      node = document.createElement("p");
      node.className = "form-message warning fitgen-taken-error";
      node.setAttribute("role", "alert");
      host.appendChild(node);
    }
    node.textContent = message;
    node.classList.remove("is-hidden");
  }

  function handleTaken(event) {
    const button = event.target.closest("[data-action='mark-taken']");
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    const dateKey = button.dataset.date || todayKey();
    const host = button.closest("article, .today-schedule-card, .calendar-item") || button.parentElement;
    const result = adapter().markTaken(button.dataset.id, dateKey);
    if (!result.ok) {
      showInlineTakenError(host, result.message || ux.PERSIST_FAIL_ERROR);
      return;
    }
    if (!result.noop) {
      showSnackbar(button.dataset.id, dateKey);
    }
    rerender();
  }

  function handleUndo(event) {
    const button = event.target.closest("[data-action='undo-taken']");
    if (!button && event.target.id !== "fitgen-undo-snackbar-btn") {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    const scheduleId = button?.dataset.id || snackbarUndo?.scheduleId;
    const dateKey = button?.dataset.date || snackbarUndo?.dateKey || todayKey();
    if (!scheduleId) {
      return;
    }
    const host = button?.closest("article, .today-schedule-card, .calendar-item") || document.getElementById("reminder-list");
    const result = adapter().undoTaken(scheduleId, dateKey);
    if (!result.ok) {
      if (host) {
        showInlineTakenError(host, result.message || ux.PERSIST_FAIL_ERROR);
      }
      return;
    }
    hideSnackbar();
    rerender();
  }

  document.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }
      handleWizardNext(event);
      handleWizardBack(event);
      handleWizardCancel(event);
      handleDeleteFill(event);
      handleTaken(event);
      handleUndo(event);
      if (event.target.closest("#export-data")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        confirmExportWarning();
        return;
      }
      if (event.target.closest("#restore-backup-btn")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        confirmRestore();
        return;
      }
      if (event.target.closest("#fitgen-import-replace")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (confirmState && confirmState.preview) {
          confirmReplaceAll(confirmState.preview);
        }
      }
    },
    true
  );

  document.addEventListener(
    "change",
    (event) => {
      if (!(event.target instanceof Element) || event.target.id !== "import-data-input") {
        return;
      }
      event.stopImmediatePropagation();
      const input = event.target;
      const file = input.files && input.files[0];
      input.value = "";
      if (file) {
        handleImportFile(file);
      }
    },
    true
  );

  const saveForm = document.getElementById("save-fill-form");
  saveForm?.addEventListener("submit", handleSaveSubmit, true);

  const dialogNodes = getDialogNodes();
  dialogNodes.primary?.addEventListener("click", () => {
    confirmState?.onPrimary?.();
  });
  dialogNodes.secondary?.addEventListener("click", () => {
    closeDialog(true);
  });
  document.getElementById("fitgen-confirm-backdrop")?.addEventListener("click", () => {
    if (confirmState?.allowEscape !== false) {
      closeDialog(true);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (!confirmState) {
      return;
    }
    if (ux.shouldCloseOnKey(event.key, confirmState.allowEscape !== false)) {
      event.preventDefault();
      closeDialog(true);
      return;
    }
    const items = focusables();
    const current = items.indexOf(document.activeElement);
    const trap = ux.trapTabKey(event.key, event.shiftKey, current < 0 ? 0 : current, items.length);
    if (trap.handled) {
      event.preventDefault();
      items[trap.nextIndex]?.focus();
    }
  });

  function persistState() {
    return ux.readGithubState(window.localStorage);
  }

  function setBackupStatus(message) {
    const node = document.getElementById("backup-status");
    if (node) {
      node.textContent = message || "";
    }
  }

  function refreshRestoreControl() {
    const button = document.getElementById("restore-backup-btn");
    if (!button || typeof ux.restoreAvailable !== "function") {
      return;
    }
    const available = ux.restoreAvailable(window.localStorage, Date.now());
    if (available) {
      button.removeAttribute("hidden");
      button.disabled = false;
    } else {
      button.setAttribute("hidden", "");
      button.disabled = true;
    }
  }

  function syncImportedState(next) {
    if (typeof state !== "undefined") {
      state.fills = next.fills;
      state.schedules = next.schedules;
      state.occurrences = next.occurrences;
      state.medications = next.medications;
    }
    rerender();
    refreshRestoreControl();
    if (typeof refreshNameChipHosts === "function") {
      refreshNameChipHosts();
    }
    if (typeof renderStage5Medications === "function") {
      renderStage5Medications();
    }
  }

  function filenameForExport() {
    return `fitgen-backup-${new Date().toISOString().split("T")[0]}.json`;
  }

  function downloadJsonFile(json, filename) {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function writeLocalExport(json, filename) {
    const native = window.FitGenNativeBackup;
    if (typeof ux.writeLocalBackup === "function") {
      return ux.writeLocalBackup(json, filename, {
        nativeExport:
          native && typeof native.exportBackup === "function"
            ? (text, name) => native.exportBackup(text, name)
            : undefined,
        download: downloadJsonFile,
      });
    }
    downloadJsonFile(json, filename);
    return "download";
  }

  function confirmExportWarning() {
    openDialog({
      kind: "export-warning",
      title: ux.EXPORT_CONFIRM_TITLE,
      bodyHtml: `<p>${ux.EXPORT_PLAINTEXT_WARNING}</p>`,
      primaryLabel: ux.EXPORT_CONFIRM_PRIMARY,
      secondaryLabel: ux.EXPORT_CONFIRM_CANCEL,
      allowEscape: true,
      onPrimary() {
        const json = ux.exportDocumentJson(persistState(), new Date().toISOString());
        try {
          writeLocalExport(json, filenameForExport());
          setBackupStatus("Plaintext JSON backup saved on this device.");
          closeDialog(true);
        } catch {
          setDialogError(ux.IMPORT_APPLY_ERROR);
        }
      },
    });
  }

  function applyPreview(preview, policy, confirmed) {
    try {
      const result = ux.applyImport(window.localStorage, preview, policy, Date.now(), confirmed);
      if (!result.ok) {
        setDialogError(result.message || ux.IMPORT_APPLY_ERROR);
        return false;
      }
      syncImportedState(persistState());
      setBackupStatus(
        result.noop ? "Nothing new to import." : policy === "replace-all" ? "Backup replaced." : "Backup imported (existing kept)."
      );
      closeDialog(true);
      return true;
    } catch {
      setDialogError(ux.IMPORT_APPLY_ERROR);
      return false;
    }
  }

  function openImportPreview(preview) {
    if (preview.applyBlocked) {
      openDialog({
        kind: "import-preview",
        title: ux.IMPORT_PREVIEW_TITLE,
        bodyHtml: ux.previewBodyHtml(preview),
        primaryLabel: ux.IMPORT_CLOSE,
        secondaryLabel: ux.IMPORT_CANCEL,
        allowEscape: true,
        onPrimary() {
          closeDialog(true);
        },
      });
      return;
    }
    openDialog({
      kind: "import-preview",
      title: ux.IMPORT_PREVIEW_TITLE,
      bodyHtml: ux.previewBodyHtml(preview),
      primaryLabel: ux.IMPORT_SKIP_PRIMARY,
      secondaryLabel: ux.IMPORT_CANCEL,
      allowEscape: true,
      preview,
      onPrimary() {
        applyPreview(preview, "skip-existing", false);
      },
    });
  }

  function confirmReplaceAll(preview) {
    const counts = preview.replaceAllWouldRemove;
    openDialog({
      kind: "import-replace",
      title: ux.IMPORT_REPLACE_TITLE,
      bodyHtml: `<p>This replaces ${counts.fills} fills, ${counts.schedules} schedules, ${counts.occurrences} occurrence records, and ${counts.medications} medications on this device. A recovery snapshot is saved first (168 hours). The rebuild envelope is not changed.</p>`,
      primaryLabel: ux.IMPORT_REPLACE_PRIMARY,
      secondaryLabel: ux.IMPORT_REPLACE_BACK,
      allowEscape: true,
      preview,
      onPrimary() {
        applyPreview(preview, "replace-all", true);
      },
    });
  }

  function handleImportFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const preview = ux.previewImportFromStorage(window.localStorage, text, ux.resolveTimeZone());
      openImportPreview(preview);
    };
    reader.onerror = () => {
      setBackupStatus(ux.IMPORT_BLOCKED_CORRUPT);
    };
    reader.readAsText(file);
  }

  function confirmRestore() {
    const inspect = ux.inspectRestore(window.localStorage, Date.now());
    if (!inspect || inspect.ok !== true || !inspect.snapshot) {
      setBackupStatus(inspect && inspect.message ? inspect.message : ux.RESTORE_UNAVAILABLE);
      refreshRestoreControl();
      return;
    }
    openDialog({
      kind: "import-restore",
      title: ux.RESTORE_TITLE,
      bodyHtml: `<p>Restore the snapshot from ${inspect.snapshot.createdAt}. It expires at ${inspect.snapshot.expiresAt}. This does not change the rebuild envelope.</p>`,
      primaryLabel: ux.RESTORE_PRIMARY,
      secondaryLabel: ux.RESTORE_CANCEL,
      allowEscape: true,
      onPrimary() {
        const result = ux.restoreFromSlot(window.localStorage, Date.now());
        if (!result.ok) {
          setDialogError(result.message || ux.RESTORE_CORRUPT);
          return;
        }
        syncImportedState(persistState());
        setBackupStatus("Previous backup restored.");
        closeDialog(true);
      },
    });
  }

  let editingMedId = null;
  let autocompleteIndex = -1;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function currentRecentNames() {
    return ux.recentUserNames(ux.readMedications(window.localStorage), readFills());
  }

  function resetMedForm() {
    const form = document.getElementById("add-medication-form");
    if (form && typeof form.reset === "function") {
      form.reset();
    }
    ["med-dose", "med-unit", "med-interval"].forEach((id) => {
      const node = document.getElementById(id);
      if (node) {
        node.value = "";
      }
    });
    editingMedId = null;
  }

  function writeLiveMedications(medications) {
    ux.writeMedicationsFromUi(window.localStorage, medications);
    if (typeof state !== "undefined") {
      state.medications = medications;
    }
  }

  function hideAutocomplete(list) {
    if (!list) {
      return;
    }
    list.classList.add("is-hidden");
    list.replaceChildren();
    autocompleteIndex = -1;
    const input = document.getElementById(list.dataset.inputId || "");
    if (input) {
      input.setAttribute("aria-expanded", "false");
    }
  }

  function renderChipRow(host, input) {
    if (!host || typeof ux.stage5NameChips !== "function") {
      return;
    }
    const chips = ux.stage5NameChips(currentRecentNames());
    host.replaceChildren();
    chips.forEach((chip) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "fitgen-chip fitgen-target-44";
      button.dataset.chipId = chip.id;
      button.dataset.chipSource = chip.source;
      button.dataset.chipClass = chip.class;
      button.dataset.chipField = chip.field;
      button.setAttribute("aria-pressed", "false");
      button.textContent = chip.copy;
      button.addEventListener("click", () => {
        if (!input) {
          return;
        }
        if (chip.source === "Custom") {
          input.focus();
          return;
        }
        input.value = chip.copy;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      });
      host.appendChild(button);
    });
  }

  function refreshNameChipHosts() {
    const medInput = document.getElementById("med-name");
    const fillInput = document.getElementById("save-fill-name");
    renderChipRow(document.getElementById("med-name-chips"), medInput);
    renderChipRow(document.getElementById("save-fill-name-chips"), fillInput);
  }

  function renderAutocomplete(input, list) {
    if (!input || !list || typeof ux.matchNameSuggestions !== "function") {
      return;
    }
    const matches = ux.matchNameSuggestions(input.value, currentRecentNames());
    if (!matches.length) {
      hideAutocomplete(list);
      return;
    }
    autocompleteIndex = -1;
    list.replaceChildren();
    matches.forEach((name) => {
      const item = document.createElement("li");
      item.setAttribute("role", "none");
      const option = document.createElement("button");
      option.type = "button";
      option.className = "fitgen-name-option";
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      option.textContent = name;
      option.addEventListener("mousedown", (event) => {
        event.preventDefault();
        input.value = name;
        hideAutocomplete(list);
        input.focus();
      });
      item.appendChild(option);
      list.appendChild(item);
    });
    list.classList.remove("is-hidden");
    input.setAttribute("aria-expanded", "true");
  }

  function onNameKeydown(event, input, list) {
    if (!list || list.classList.contains("is-hidden")) {
      return;
    }
    const options = Array.from(list.querySelectorAll(".fitgen-name-option"));
    if (event.key === "Escape") {
      hideAutocomplete(list);
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      autocompleteIndex = Math.min(options.length - 1, autocompleteIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      autocompleteIndex = Math.max(-1, autocompleteIndex - 1);
    } else if (event.key === "Enter" && autocompleteIndex >= 0) {
      event.preventDefault();
      const active = options[autocompleteIndex];
      if (active) {
        input.value = active.textContent || "";
        hideAutocomplete(list);
      }
      return;
    }
    options.forEach((option, index) => {
      const active = index === autocompleteIndex;
      option.classList.toggle("is-active", active);
      option.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function attachNameField(inputId, chipsId, listId) {
    const input = document.getElementById(inputId);
    const chips = document.getElementById(chipsId);
    const list = document.getElementById(listId);
    if (!input || input.dataset.stage5NameBound === "true") {
      return;
    }
    input.dataset.stage5NameBound = "true";
    if (list) {
      list.dataset.inputId = inputId;
    }
    renderChipRow(chips, input);
    input.addEventListener("input", () => renderAutocomplete(input, list));
    input.addEventListener("focus", () => {
      if (String(input.value || "").trim()) {
        renderAutocomplete(input, list);
      }
    });
    input.addEventListener("keydown", (event) => onNameKeydown(event, input, list));
    input.addEventListener("blur", () => {
      window.setTimeout(() => hideAutocomplete(list), 120);
    });
  }

  function renderStage5Medications() {
    const container = document.getElementById("medications-list");
    if (!container || typeof ux.medicationFromUnknown !== "function") {
      return;
    }
    const raw = ux.readMedications(window.localStorage);
    if (typeof state !== "undefined") {
      state.medications = raw;
    }
    const rows = raw.map((row) => ux.medicationFromUnknown(row)).filter(Boolean);
    if (!rows.length) {
      container.innerHTML = `<p class="empty-state">${ux.MED_EMPTY_LIST}</p>`;
      return;
    }
    container.innerHTML = rows
      .map((med) => {
        const meta = ux.formatMedicationMeta(med);
        return `<article class="med-card" data-stage5-med="1" data-name-state="${escapeHtml(med.nameState)}" data-id="${escapeHtml(med.id)}">
        <div class="med-info">
          <strong class="med-name">${escapeHtml(med.name)}</strong>
          <span class="med-meta">${escapeHtml(meta)}</span>
        </div>
        <div class="med-actions">
          <button class="mini-button fitgen-target-44" type="button" data-action="load-med" data-id="${escapeHtml(med.id)}">${ux.MED_LOAD_LABEL}</button>
          <button class="mini-button fitgen-target-44" type="button" data-action="edit-med" data-id="${escapeHtml(med.id)}">${ux.MED_EDIT_LABEL}</button>
          <button class="mini-button fitgen-target-44" type="button" data-action="delete-med" data-id="${escapeHtml(med.id)}">${ux.MED_REMOVE_LABEL}</button>
        </div>
      </article>`;
      })
      .join("");

    container.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const id = button.getAttribute("data-id");
        const med = rows.find((row) => row.id === id);
        const action = button.getAttribute("data-action");
        if (action === "load-med" && med) {
          loadMedication(med);
          return;
        }
        if (action === "edit-med" && med) {
          startEditMedication(med);
          return;
        }
        if (action === "delete-med" && id) {
          const next = ux.removeMedication(ux.readMedications(window.localStorage), id);
          writeLiveMedications(next);
          if (editingMedId === id) {
            resetMedForm();
          }
          renderStage5Medications();
          refreshNameChipHosts();
        }
      });
    });
  }

  function startEditMedication(med) {
    editingMedId = med.id;
    const nameInput = document.getElementById("med-name");
    const dose = document.getElementById("med-dose");
    const unit = document.getElementById("med-unit");
    const interval = document.getElementById("med-interval");
    if (nameInput) {
      nameInput.value = med.nameState === ux.UNKNOWN_NAME_STATE ? ux.UNKNOWN_NAME_DISPLAY : med.name;
    }
    if (dose) {
      const amount = ux.optionalPositiveNumber(med.dose);
      dose.value = amount === null ? "" : String(amount);
    }
    if (unit) {
      unit.value = ux.optionalUnitLabel(med.unit) || "";
    }
    if (interval) {
      const days = ux.optionalPositiveNumber(med.interval);
      interval.value = days === null ? "" : String(days);
    }
    nameInput?.focus();
  }

  function loadMedication(med) {
    const unit = ux.optionalUnitLabel(med.unit);
    const dose = ux.optionalPositiveNumber(med.dose);
    const unitEl = document.getElementById("dose-unit");
    const doseEl = document.getElementById("dose-mg");
    if (unit && unitEl) {
      unitEl.value = unit;
    }
    if (dose !== null && doseEl) {
      doseEl.value = String(dose);
    }
    if (typeof window.updateUnitLabels === "function") {
      window.updateUnitLabels();
    }
    if (typeof window.renderCalculator === "function") {
      window.renderCalculator();
    }
    if (typeof window.setActiveView === "function") {
      window.setActiveView("calculator-view");
    } else {
      document.querySelector('[data-view-target="calculator-view"]')?.click();
    }
    if (typeof window.goToWizardStep === "function") {
      window.goToWizardStep(1);
    }
  }

  function handleMedFormSubmit(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const nameInput = document.getElementById("med-name");
    const existingList = ux.readMedications(window.localStorage);
    const existing = editingMedId
      ? existingList.map((row) => ux.medicationFromUnknown(row)).find((row) => row && row.id === editingMedId)
      : null;
    const id =
      editingMedId ||
      (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `med-${Date.now()}`);
    const record = ux.buildMedicationRecord({
      id,
      name: nameInput ? nameInput.value : "",
      existing: existing || null,
      dose: document.getElementById("med-dose")?.value,
      unit: document.getElementById("med-unit")?.value,
      interval: document.getElementById("med-interval")?.value,
    });
    writeLiveMedications(ux.upsertMedication(existingList, record));
    resetMedForm();
    renderStage5Medications();
    refreshNameChipHosts();
  }

  function wrapRenderMedications() {
    if (typeof window.renderMedications !== "function" || window.renderMedications.__stage5) {
      return;
    }
    const original = window.renderMedications;
    const wrapped = function renderMedicationsStage5() {
      original.apply(this, arguments);
      renderStage5Medications();
    };
    wrapped.__stage5 = true;
    window.renderMedications = wrapped;
  }

  function revealMedicationsCard() {
    const card = document.getElementById("medications-card");
    if (!card) {
      return;
    }
    card.style.removeProperty("display");
    card.removeAttribute("hidden");
  }

  function installStage5Meds() {
    revealMedicationsCard();
    wrapRenderMedications();
    const form = document.getElementById("add-medication-form");
    if (form && form.dataset.stage5Bound !== "true") {
      form.dataset.stage5Bound = "true";
      form.addEventListener("submit", handleMedFormSubmit, true);
    }
    attachNameField("med-name", "med-name-chips", "med-name-autocomplete");
    attachNameField("save-fill-name", "save-fill-name-chips", "save-fill-name-autocomplete");
    renderStage5Medications();
    refreshNameChipHosts();
    window.setTimeout(revealMedicationsCard, 0);
    window.setTimeout(revealMedicationsCard, 50);
  }

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
      return;
    }
    fn();
  }

  refreshRestoreControl();
  if (typeof ux.installTabAriaSync === "function") {
    ux.installTabAriaSync(document);
  } else {
    syncTabAria();
  }
  onReady(installStage5Meds);

  window.FitGenP0UxBind = {
    adapter,
    isTaken(scheduleId, dateKey) {
      return adapter().isTaken(scheduleId, dateKey || todayKey());
    },
    canUndo(scheduleId, dateKey) {
      return adapter().canUndo(scheduleId, dateKey || todayKey());
    },
    todayKey,
    activeFills: ux.activeFills,
    activeSchedules: ux.activeSchedules,
    refreshRestoreControl,
    syncTabAria,
    renderStage5Medications,
    refreshNameChipHosts,
  };
})();
