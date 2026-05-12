(function attachFillNameSuggestionsFix() {
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
      return;
    }
    fn();
  }

  function injectStyles() {
    if (document.getElementById("fitgen-name-suggestion-styles")) return;
    const style = document.createElement("style");
    style.id = "fitgen-name-suggestion-styles";
    style.textContent = `
      .fitgen-suggestion-wrap {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 0.7rem;
      }

      .fitgen-suggestion-chip {
        border: 1px solid rgba(98, 211, 198, 0.18);
        background: rgba(255, 255, 255, 0.04);
        color: var(--text, #eef7f7);
        border-radius: 999px;
        padding: 0.42rem 0.78rem;
        font: inherit;
        font-size: 0.82rem;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  function getSuggestions() {
    const list = Array.isArray(window.PEPTIDE_LIST) ? window.PEPTIDE_LIST.slice(0, 12) : [];
    return list;
  }

  function attachChips(inputId) {
    const input = document.getElementById(inputId);
    if (!input || input.dataset.fitgenSuggestionsAttached === "true") return;

    const suggestions = getSuggestions();
    if (!suggestions.length) return;

    input.dataset.fitgenSuggestionsAttached = "true";

    const wrap = document.createElement("div");
    wrap.className = "fitgen-suggestion-wrap";
    wrap.setAttribute("aria-label", "Suggested peptide names");
    wrap.innerHTML = suggestions
      .map((name) => `<button type="button" class="fitgen-suggestion-chip" data-name="${String(name).replace(/"/g, "&quot;")}">${name}</button>`)
      .join("");

    input.insertAdjacentElement("afterend", wrap);
    wrap.querySelectorAll("[data-name]").forEach((button) => {
      button.addEventListener("click", () => {
        input.value = button.dataset.name || "";
        input.focus();
      });
    });
  }

  ready(() => {
    injectStyles();
    attachChips("save-fill-name");
    attachChips("med-name");
  });
})();
