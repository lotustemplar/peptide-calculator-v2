(function () {
  "use strict";

  const MAX_SUGGESTIONS = 6;
  const EXPANDED_FILL_KEY = "peptide-calculator-v2-expanded-fill";
  let collapsedOnce = false;

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
      return;
    }
    fn();
  }

  function hideNotificationUi() {
    const notificationCard = document.getElementById("enable-notifications")?.closest(".card");
    if (notificationCard instanceof HTMLElement) {
      notificationCard.style.display = "none";
    }

    const settingsButton = Array.from(document.querySelectorAll("button")).find((button) => {
      return (button.textContent || "").trim().toLowerCase() === "settings";
    });
    if (settingsButton instanceof HTMLElement) {
      settingsButton.style.display = "none";
    }

    const themeToggle = document.getElementById("theme-toggle");
    if (themeToggle instanceof HTMLElement) {
      themeToggle.style.display = "none";
    }
  }

  function removeUnusedSections() {
    const selectedFill = document.getElementById("selected-fill");
    if (selectedFill instanceof HTMLElement) {
      selectedFill.style.display = "none";
    }

    const medicationsCard = document.getElementById("medications-card");
    if (medicationsCard instanceof HTMLElement) {
      medicationsCard.style.display = "none";
    }

    const backupCard = document.getElementById("backup-card");
    const cabinetCard = document.getElementById("cabinet-card");
    if (backupCard instanceof HTMLElement && cabinetCard instanceof HTMLElement && cabinetCard.parentElement) {
      cabinetCard.parentElement.appendChild(backupCard);
    }
  }

  function disableReminderFunctions() {
    window.maybeRegisterNativePushIdentity = function () {};
    window.queueNextReminder = function () {};
    window.renderNotificationState = function () {};
    window.updateNotifSetupCard = async function () {};
    window.sendTestPush = async function () {};
    window.syncRemindersToBackend = async function () {
      return { ok: false, disabled: true };
    };
  }

  function applyCabinetAccordionLayout() {
    const container = document.getElementById("current-peptides");
    if (!container) return;

    container.querySelectorAll(".cabinet-card").forEach((card) => {
      const toggle = card.querySelector(".fill-toggle");
      if (!(toggle instanceof HTMLElement)) {
        return;
      }

      const caret = toggle.querySelector(".caret");
      const expanded = Boolean(caret && (caret.textContent || "").includes("▾"));
      const topRow = toggle.closest(".fill-header, .list-topline, .card-topline") || toggle.parentElement;

      Array.from(card.children).forEach((child) => {
        if (!(child instanceof HTMLElement)) return;
        if (child === topRow) {
          child.style.display = "";
          return;
        }
        child.style.display = expanded ? "" : "none";
      });
    });
  }

  function collapseCabinetAtStartup() {
    if (collapsedOnce) {
      applyCabinetAccordionLayout();
      return;
    }

    const container = document.getElementById("current-peptides");
    if (!container) return;

    const openToggle = Array.from(container.querySelectorAll(".fill-toggle")).find((button) => {
      const caret = button.querySelector(".caret");
      return caret && (caret.textContent || "").includes("▾");
    });

    if (openToggle instanceof HTMLButtonElement) {
      localStorage.removeItem(EXPANDED_FILL_KEY);
      openToggle.click();
      collapsedOnce = true;
      window.setTimeout(applyCabinetAccordionLayout, 0);
      return;
    }

    if (container.querySelector(".cabinet-card")) {
      localStorage.removeItem(EXPANDED_FILL_KEY);
      collapsedOnce = true;
      applyCabinetAccordionLayout();
    }
  }

  function watchCabinet() {
    const container = document.getElementById("current-peptides");
    if (!container) return;

    container.addEventListener("click", (event) => {
      const toggle = event.target instanceof Element ? event.target.closest(".fill-toggle") : null;
      if (toggle) {
        window.setTimeout(applyCabinetAccordionLayout, 0);
      }
    });

    const observer = new MutationObserver(() => {
      removeUnusedSections();
      collapseCabinetAtStartup();
      applyCabinetAccordionLayout();
    });
    observer.observe(container, { childList: true, subtree: true });
    removeUnusedSections();
    collapseCabinetAtStartup();
    applyCabinetAccordionLayout();
  }

  function removeDuplicateScheduleBanner() {
    const reminderList = document.getElementById("reminder-list");
    if (!reminderList) return;

    const cards = Array.from(reminderList.children).filter((child) => child instanceof HTMLElement);
    if (cards.length < 2) return;

    const dueTodayCard = cards.find((card) => /due today/i.test(card.textContent || ""));
    const markButtons = reminderList.querySelectorAll('[data-action="mark-taken"]');
    if (dueTodayCard instanceof HTMLElement && markButtons.length > 1) {
      dueTodayCard.remove();
    }
  }

  function watchScheduleList() {
    const reminderList = document.getElementById("reminder-list");
    if (!reminderList) return;

    const observer = new MutationObserver(() => {
      removeDuplicateScheduleBanner();
    });
    observer.observe(reminderList, { childList: true, subtree: true });
    removeDuplicateScheduleBanner();
  }

  function attachSuggestionDropdown(input, names) {
    if (!(input instanceof HTMLInputElement) || input.dataset.suggestBound === "true") {
      return;
    }
    input.dataset.suggestBound = "true";
    input.removeAttribute("list");

    const dropdown = document.createElement("div");
    dropdown.style.cssText = [
      "position:absolute",
      "z-index:9999",
      "display:none",
      "max-height:252px",
      "overflow-y:auto",
      "border-radius:14px",
      "padding:6px",
      "background:rgba(15,23,32,0.98)",
      "border:1px solid rgba(255,255,255,0.10)",
      "box-shadow:0 16px 40px rgba(0,0,0,0.35)"
    ].join(";");
    document.body.appendChild(dropdown);

    function reposition() {
      const rect = input.getBoundingClientRect();
      dropdown.style.left = `${window.scrollX + rect.left}px`;
      dropdown.style.top = `${window.scrollY + rect.bottom + 8}px`;
      dropdown.style.width = `${rect.width}px`;
    }

    function hide() {
      dropdown.style.display = "none";
    }

    function show(query) {
      const value = (query || "").trim().toLowerCase();
      const matches = names
        .filter((name) => !value || name.toLowerCase().includes(value))
        .slice(0, MAX_SUGGESTIONS);

      dropdown.innerHTML = "";
      if (!matches.length) {
        hide();
        return;
      }

      matches.forEach((name) => {
        const row = document.createElement("button");
        row.type = "button";
        row.textContent = name;
        row.style.cssText = [
          "display:block",
          "width:100%",
          "text-align:left",
          "border:none",
          "border-radius:10px",
          "padding:12px 14px",
          "background:rgba(255,255,255,0.03)",
          "color:#f7f8fb",
          "font:inherit",
          "margin:0 0 4px 0"
        ].join(";");
        row.addEventListener("mousedown", (event) => {
          event.preventDefault();
          input.value = name;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          hide();
        });
        dropdown.appendChild(row);
      });

      reposition();
      dropdown.style.display = "block";
    }

    input.addEventListener("focus", () => show(input.value));
    input.addEventListener("input", () => show(input.value));
    input.addEventListener("blur", () => window.setTimeout(hide, 120));
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
  }

  function attachPeptideSuggestions() {
    const names = Array.isArray(window.PEPTIDE_LIST)
      ? window.PEPTIDE_LIST.slice().sort((a, b) => a.localeCompare(b))
      : [];
    if (!names.length) return;

    const bind = () => {
      attachSuggestionDropdown(document.getElementById("save-fill-name"), names);
      attachSuggestionDropdown(document.getElementById("med-name"), names);
    };

    bind();
    const observer = new MutationObserver(bind);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  onReady(function () {
    disableReminderFunctions();
    hideNotificationUi();
    removeUnusedSections();
    watchCabinet();
    watchScheduleList();
    attachPeptideSuggestions();
  });
})();
