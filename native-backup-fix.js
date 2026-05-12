(function attachNativeBackupFix() {
  const exportButton = document.getElementById("export-data");
  const backupStatus = document.getElementById("backup-status");

  if (!exportButton) return;

  function setStatus(message, tone) {
    if (!backupStatus) return;
    backupStatus.textContent = message || "";
    backupStatus.style.color =
      tone === "success"
        ? "var(--teal)"
        : tone === "error"
          ? "var(--rose)"
          : "var(--muted)";
  }

  function safeParse(json, fallback) {
    try {
      return JSON.parse(json);
    } catch {
      return fallback;
    }
  }

  function buildBackup() {
    const read = (key, fallback) => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    };

    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      userId: read("peptide-calculator-v2-user-id", null),
      medications: read("peptide-calculator-v2-medications", []),
      fills: read("peptide-calculator-v2-fills", []),
      schedules: read("peptide-calculator-v2-schedules", []),
    };
  }

  function tryNativeSave() {
    if (!window.FitGenNativeBackup || typeof window.FitGenNativeBackup.exportBackup !== "function") {
      return false;
    }

    const json = JSON.stringify(buildBackup(), null, 2);
    const filename = `fitgen-backup-${new Date().toISOString().split("T")[0]}.json`;
    const result = safeParse(window.FitGenNativeBackup.exportBackup(json, filename), { ok: true });

    if (result && result.ok) {
      setStatus("Save picker opened. Choose Files, Dropbox, or another folder location for the .json backup.", "success");
      return true;
    }

    setStatus(`Native export failed${result && result.error ? `: ${result.error}` : "."}`, "error");
    return true;
  }

  const freshButton = exportButton.cloneNode(true);
  exportButton.replaceWith(freshButton);
  freshButton.addEventListener("click", (event) => {
    if (tryNativeSave()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    if (typeof window.exportData === "function") {
      window.exportData();
      return;
    }

    setStatus("Backup export is not available right now.", "error");
  }, true);
})();
