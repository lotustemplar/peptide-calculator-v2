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
        display: grid;
        grid-auto-flow: row;
        gap: 0.45rem;
        margin-top: 0.7rem;
        max-height: 12.75rem;
        overflow-y: auto;
        padding-right: 0.15rem;
        scrollbar-width: thin;
      }

      .fitgen-suggestion-wrap.is-typing {
        display: none;
      }

      .fitgen-suggestion-chip {
        border: 1px solid rgba(98, 211, 198, 0.18);
        background: rgba(255, 255, 255, 0.04);
        color: var(--text, #eef7f7);
        border-radius: 1rem;
        padding: 0.68rem 0.9rem;
        font: inherit;
        font-size: 0.92rem;
        cursor: pointer;
        text-align: left;
        width: 100%;
      }

      .fitgen-suggestion-chip:hover {
        border-color: rgba(98, 211, 198, 0.44);
        background: rgba(98, 211, 198, 0.1);
      }

      .fitgen-suggestion-hint {
        margin-top: 0.45rem;
        color: var(--muted, rgba(226, 232, 240, 0.72));
        font-size: 0.8rem;
      }
    `;
    document.head.appendChild(style);
  }

  function getSuggestions() {
    const list = Array.isArray(window.PEPTIDE_LIST) ? window.PEPTIDE_LIST.slice(0, 7) : [];
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

    const hint = document.createElement("p");
    hint.className = "fitgen-suggestion-hint";
    hint.textContent = "Tap a suggestion or type your own name.";

    input.insertAdjacentElement("afterend", wrap);
    wrap.insertAdjacentElement("afterend", hint);

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
