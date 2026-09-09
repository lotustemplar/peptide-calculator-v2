# STAGE5 — Issue #32 med names + classified chips

**Issue:** [#32](https://github.com/lotustemplar/peptide-calculator-v2/issues/32)  
**Branch:** `grok/32-recovery-stage-5-chips`  
**Base:** `main` @ `5531fe131365008a2bfe5c2ec682dafbe062ed40`  
**Risk:** Elevated (UX) — calc/dose chips classified Serious and **not shipped**  
**Gate 0:** [CHIP_INVENTORY.md](./CHIP_INVENTORY.md)

5a (name CRUD + local normalize/autocomplete + unknown-state) and **safe 5b only** (Custom + recent-user + Unknown on name fields). Escalated chip families are inventory-only.

## What changed

| Surface | After |
|---------|--------|
| Medications form | Name-only add/edit/remove. Dose / unit / interval stay optional hidden passthrough (no `7` default). |
| Unknown-state | Empty / `unknown` ⇒ display `Unknown`, `nameState: "unknown"`. Never coerced onto `PEPTIDE_LIST`. |
| Autocomplete | Recent-user names on this device only. No first-item preselect. |
| Chips | `Custom` (focus only), `Unknown`, recent-user labels. `aria-pressed="false"`. No recommended/best. |
| Persistence | `writeMedicationsFromUi` → Stage 3 envelope. No legacy-only med writes. |

## File ownership (source → target)

| Source (reference only) | Target (this PR) | Notes |
|-------------------------|------------------|-------|
| Gate 0 inventory | `docs/evidence/stage-5-chips/CHIP_INVENTORY.md` | First commit; required before chip UI |
| MED-FLAG / SAF-UNK | `src/ux/med-names.ts` | Local normalize, unknown-state, recent-user dictionary |
| UX-CHIP | `src/ux/chips.ts` | Custom + recent + Unknown model; `selected: false` |
| Copy | `src/ux/copy.ts` | Name helper / Save name / Edit name / Remove |
| Bind | `p0-ux-bind.js` | Form intercept, list render, chips, autocomplete |
| Chrome | `index.html`, `styles.css` | Name field, chip hosts, hidden dose/interval |
| Bundle | `src/ux/p0-ux.browser.js` | Generated from `src/ux` + `src/occ` |
| Tests | `scripts/ux/stage5-meds-test.js`, `scripts/ci/stage5-chips-test.js` | Unit + inventory/golden freeze |
| Frozen | `app.js`, calc goldens, `src/occ/*` writers | Zero formula/OCC edits |

## Screenshots

Synthetic names **Demo Vial A** / **Unknown** only. PNG metadata: none intended (CDP PNG).

| State | Desktop | Narrow mobile |
|-------|---------|---------------|
| Meds list (before) | `before-desktop-meds.png` | `before-mobile-meds.png` |
| Meds list (after) | `after-desktop-meds.png` | `after-mobile-meds.png` |
| Name chips (after) | `after-desktop-chips.png` | `after-mobile-chips.png` |

Capture helper (not part of `npm test`): `node scripts/ux/stage5-chips-capture.js --shots before|after`.

## Golden / behavior freeze

Unchanged vs `main` @ `5531fe1`:

| Path | SHA-256 |
|------|---------|
| `scripts/calc/fixtures/legacy-evidence-goldens.json` | `659c1865da95c3197395c931e154c4267c802d8aaf7842aee83345962d013acd` |
| `app.js` | `489cd7b88b90e00bd2a700518312577cf5a65cf12cacc003d9a181422606a537` |

Rollback = revert this PR. Both storage generations remain loadable (Stage 3 envelope rules hold). Never mutate/delete `fitgen-peptide-rebuild-v1`.

## Residual risks

1. Vial / BAC water / syringe / unit / dose / frequency chip families are **escalate-Serious** and were not implemented. A later stage must re-inventory before any of those ship.
2. Characterized wizard starting values (`30` / `3` / `1` / `3` / `mg`) are unchanged and are not chips (Stage 7 / DEC-DEFAULTS).
3. `peptide-list.js` and unloaded `fill-name-suggestions-fix.js` still exist. Stage 5 does not surface them.
4. Optional stored dose/interval on older medication rows still display as user-entered values. Load is omitted unless the row already stores a complete user-entered dose+unit. Name-only / Unknown rows show `No saved dose` and cannot navigate or reuse a stale calculator value.
5. Save-fill interval / reminder time defaults (`7`, `09:00`) are pre-existing and out of Stage 5.
6. `ui-polish-fix.js` still sets `medications-card` to `display: none`. Stage 5 overrides that with CSS `!important` plus a bind reveal so name CRUD is visible. The patch file is not retired.
