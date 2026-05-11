(function attachExportFix() {
  const STORAGE_KEYS = {
    fills: "peptide-calculator-v2-fills",
    schedules: "peptide-calculator-v2-schedules",
    medications: "peptide-calculator-v2-medications",
    userId: "peptide-calculator-v2-user-id",
  };

  const exportButton = document.getElementById("export-data");
  const backupStatus = document.getElementById("backup-status");

  if (!exportButton) {
    return;
  }

  function setStatus(message, tone) {
    if (!backupStatus) {
      return;
    }
    backupStatus.textContent = message || "";
    backupStatus.style.color =
      tone === "success"
        ? "var(--teal)"
        : tone === "error"
          ? "var(--rose)"
          : "var(--muted)";
  }

  function readStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function getArrayStateOrStorage(key, stateKey) {
    if (typeof state !== "undefined" && Array.isArray(state?.[stateKey])) {
      return state[stateKey];
    }
    return readStorage(key, []);
  }

  function buildBackup() {
    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      userId: readStorage(STORAGE_KEYS.userId, null),
      medications: getArrayStateOrStorage(STORAGE_KEYS.medications, "medications"),
      fills: getArrayStateOrStorage(STORAGE_KEYS.fills, "fills"),
      schedules: getArrayStateOrStorage(STORAGE_KEYS.schedules, "schedules"),
    };
  }

  function isNativeLikeEnvironment() {
    return Boolean(window.median || window.gonative || /Android|iPhone|iPad/i.test(navigator.userAgent || ""));
  }

  async function tryShareFile(json, filename) {
    if (!navigator.share || !navigator.canShare) {
      return false;
    }

    const file = new File([json], filename, { type: "application/json" });
    if (!navigator.canShare({ files: [file] })) {
      return false;
    }

    await navigator.share({
      files: [file],
      title: "FitGen Backup",
      text: "Save this backup JSON file so you can import it later.",
    });
    return true;
  }

  async function tryFileSystemSave(json, filename) {
    if (typeof window.showSaveFilePicker !== "function") {
      return false;
    }

    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: "FitGen backup JSON",
          accept: { "application/json": [".json"] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(json);
    await writable.close();
    return true;
  }

  function tryDownloadLink(json, filename) {
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

  function showExportFallbackModal(json, filename) {
    const existing = document.getElementById("export-fallback-modal");
    if (existing) {
      existing.remove();
    }

    const modal = document.createElement("div");
    modal.id = "export-fallback-modal";
    modal.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:9999",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "padding:16px",
      "background:rgba(3,10,18,0.78)",
    ].join(";");

    modal.innerHTML = `
      <div style="width:min(760px,100%);max-height:90vh;overflow:auto;background:#0f1d2b;color:#eef5fb;border:1px solid rgba(255,255,255,0.12);border-radius:24px;padding:20px;box-shadow:0 24px 56px rgba(0,0,0,0.28)">
        <h3 style="margin:0 0 8px;font-family:Sora,sans-serif">Backup JSON ready</h3>
        <p style="margin:0 0 14px;color:#9cb0c6;line-height:1.5">This app restores from a JSON backup file, not CSV. If your phone did not open a save prompt, use one of the options below and keep this file somewhere safe.</p>
        <textarea readonly style="width:100%;min-height:260px;border-radius:16px;border:1px solid rgba(255,255,255,0.12);background:#09131d;color:#eef5fb;padding:14px;font:12px/1.4 monospace">${json.replaceAll("<", "&lt;")}</textarea>
        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px">
          <button type="button" id="export-copy-btn" style="min-height:44px;padding:0 16px;border:none;border-radius:999px;background:linear-gradient(135deg,#3fd6c5 0%,#7fe4d8 100%);color:#041015;font-weight:700;cursor:pointer">Copy JSON Backup</button>
          <button type="button" id="export-download-btn" style="min-height:44px;padding:0 16px;border:1px solid rgba(255,255,255,0.12);border-radius:999px;background:rgba(255,255,255,0.06);color:#eef5fb;font-weight:600;cursor:pointer">Download .json File</button>
          <button type="button" id="export-close-btn" style="min-height:44px;padding:0 16px;border:1px solid rgba(255,255,255,0.12);border-radius:999px;background:rgba(255,255,255,0.06);color:#eef5fb;font-weight:600;cursor:pointer">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const textarea = modal.querySelector("textarea");
    const copyButton = document.getElementById("export-copy-btn");
    const downloadButton = document.getElementById("export-download-btn");
    const closeButton = document.getElementById("export-close-btn");

    copyButton?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(json);
        copyButton.textContent = "Copied!";
        setStatus("Backup copied to clipboard.", "success");
      } catch {
        textarea?.select();
        copyButton.textContent = "Select and Copy";
        setStatus("Clipboard blocked. Select the JSON and copy it manually.", "error");
      }
    });

    downloadButton?.addEventListener("click", () => {
      tryDownloadLink(json, filename);
      setStatus("Download started. If your phone still opens another app, use Copy JSON Backup instead.", null);
    });

    closeButton?.addEventListener("click", () => modal.remove());
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        modal.remove();
      }
    });
  }

  async function exportDataFixed() {
    const backup = buildBackup();
    const json = JSON.stringify(backup, null, 2);
    const filename = `fitgen-backup-${new Date().toISOString().split("T")[0]}.json`;

    setStatus("Preparing backup JSON…", null);

    try {
      if (await tryShareFile(json, filename)) {
        setStatus("Backup file ready. Save the .json file somewhere safe so you can import it later.", "success");
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        setStatus("Export cancelled.", null);
        return;
      }
    }

    try {
      if (await tryFileSystemSave(json, filename)) {
        setStatus("Backup saved as a .json file.", "success");
        return;
      }
    } catch {
      // Fall through to the next export option.
    }

    try {
      if (!isNativeLikeEnvironment()) {
        tryDownloadLink(json, filename);
        setStatus("Download started. If it did not appear, use the JSON popup fallback.", "success");
        return;
      }
    } catch {
      // Fall through to fallback modal.
    }

    showExportFallbackModal(json, filename);
    setStatus("Backup JSON is ready below. Copy it or download the .json file from the popup.", "success");
  }

  window.exportData = exportDataFixed;

  const freshButton = exportButton.cloneNode(true);
  exportButton.replaceWith(freshButton);
  freshButton.addEventListener("click", exportDataFixed);
})();
