# STAGE6CB5 — Issue #34 RF-B-010 Cabinet shell stop-last-write evidence

**Issue:** [#34](https://github.com/lotustemplar/peptide-calculator-v2/issues/34) (Stage **6c-B5 only**)  
**Branch:** `grok/34-stage-6c-b5-cabinet-shell`  
**Base:** `main` @ `122ff7f670d43a62c2530721c67597c6e952bd10` (post–6c-B4)  
**Binding:** Codex [NEXT_STAGE_AUTHORIZED](https://github.com/lotustemplar/peptide-calculator-v2/issues/34#issuecomment-5647470771); standing continuation [5646357576](https://github.com/lotustemplar/peptide-calculator-v2/issues/34#issuecomment-5646357576); Spec v2 `docs/recovery/stage-6c-inventory-spec-v2.md` (RF-B-010); Stage 6b.3 accordion hosts [PR #38](https://github.com/lotustemplar/peptide-calculator-v2/pull/38)  
**Risk:** Elevated (Cabinet shell last-write can wipe 6b.3 `.fill-toggle`) — no Serious DEC. Routine for merge class once Codex authorizes the exact head.  
**Gate:** [ALLOWLIST.md](../baseline-rar-2026-08-16/ALLOWLIST.md)

This is **before/after Cabinet shell ownership** evidence. When maintained `app.js` `renderCurrentPeptides` is present, overlay `renderFallbackCabinet` no longer last-writes `#current-peptides`. The approved Stage 6b.3 accordion host / toggle / panel / Delete action-host markup survives. Bind/app-absent fallback still emits the frozen RF-C-015 field template and Edit/Delete hosts. `runtime-fixes.js` stays loaded and allowlisted.

## Privacy

Fixtures use synthetic names **Demo Vial A** / **Demo Vial B** only. There is **no real health data**, personal dosing history, credentials, or PHI in these screenshots or in the capture seed.

PNG metadata: none intended (CDP PNG).

Shots are **viewport-sized** (mobile 390×844 @2x, desktop 1280×800). The capture helper does **not** use `captureBeyondViewport`. After write, `scripts/ci/png-evidence.js` rejects uniform/blank or too-tall artifacts. The same check is part of `npm test` via `stage6c-b5-cabinet-shell-test.js`.

## What the shots show

| Surface | Before (RF last-write on main) | After (maintained owner) |
| --- | --- | --- |
| Empty Cabinet | RF empty shell: `No fills saved yet.` | Maintained empty shell (app.js copy). No `.fill-toggle` (no cards). |
| Populated Cabinet | RF cards, **no** `.fill-toggle`. `.cabinet-actions-fallback` Edit/Delete last-write. | 6b.3 accordion hosts restored. Cards start collapsed (`▸`, `.is-collapsed`, usage `display:none`). |
| Accordion collapsed | Accordion hosts absent (wiped). Same as populated RF cards. | Header + caret only; usage / vial / actions hidden. |
| Accordion expanded | Accordion hosts absent (wiped). | `▾` caret, usage-grid + vial-row + `.peptide-fill-list` + Rename/Delete visible. |
| Action controls | Overlay Edit + Delete hosts. | Maintained Use Fill / Add Dosage / Rename / Delete hosts. Bind capture still owns `delete-fill`. |
| Keyboard / focus | Not captured (no accordion host to focus). | Focus lands on `.fill-toggle` (`data-action="toggle-fill"`) and Delete (`data-action="delete-fill"`). |

Machine-readable record: `cabinet-state.json` (after) and `cabinet-state-before.json` (before).

## Screenshots

| State | Desktop | Narrow mobile |
| --- | --- | --- |
| Empty (before) | `before-desktop-empty.png` | `before-mobile-empty.png` |
| Populated RF last-write (before) | `before-desktop-populated.png` | `before-mobile-populated.png` |
| RF Edit/Delete hosts (before) | `before-desktop-actions.png` | `before-mobile-actions.png` |
| Empty (after) | `after-desktop-empty.png` | `after-mobile-empty.png` |
| Populated accordion (after) | `after-desktop-populated.png` | `after-mobile-populated.png` |
| Accordion collapsed (after) | `after-desktop-collapsed.png` | `after-mobile-collapsed.png` |
| Accordion expanded (after) | `after-desktop-expanded.png` | `after-mobile-expanded.png` |
| Action hosts (after) | `after-desktop-actions.png` | `after-mobile-actions.png` |
| Focus on `.fill-toggle` (after) | `after-desktop-focus-toggle.png` | `after-mobile-focus-toggle.png` |
| Focus on Delete (after) | `after-desktop-focus-delete.png` | `after-mobile-focus-delete.png` |

Capture helper (not part of `npm test`): `node scripts/ux/stage6c-b5-cabinet-shell-capture.js --shots before|after`.

## Keyboard / ARIA / current-state

Characterized live contract after B5 (preserved 6b.3 hosts, not new ARIA invented here):

- Accordion host: `button.fill-toggle[type="button"][data-action="toggle-fill"]`
- Caret: `▸` collapsed / `▾` expanded (`FitGenP0Ux.UI_POLISH_EXPANDED_CARET`)
- Card class: `.cabinet-card.is-collapsed` when collapsed
- Panel host: `.peptide-fill-list` (+ `.is-collapsed` when collapsed)
- Delete host: `[data-action="delete-fill"]` inside `.card-actions`
- Bind still capture-owns `edit-fill` / `delete-fill`. Overlay still attaches no per-button listeners (B2).
- `aria-expanded` / `aria-controls` remain unset on the 6b.3 toggle (same as PR #38). Collapse state is the caret + `.is-collapsed` + sibling `display` from `applyCabinetAccordionLayout`.
- Keyboard: existing `type="button"` hosts are tabbable; `:focus-visible` uses the Stage 4 2px green outline.

## Golden / behavior freeze

Unchanged vs `main` @ `122ff7f670d43a62c2530721c67597c6e952bd10`:

| Path | SHA-256 |
| --- | --- |
| `scripts/calc/fixtures/legacy-evidence-goldens.json` | `659c1865da95c3197395c931e154c4267c802d8aaf7842aee83345962d013acd` |
| `app.js` | `489cd7b88b90e00bd2a700518312577cf5a65cf12cacc003d9a181422606a537` |
| RF-C-015 fallback field template (body of `renderFallbackCabinet` after the owner guard) | `6cc5043d0df998c32626ae8605149f25126ae0fa2c934fb2d8a770d93fc493ed` |
| RF-C-013 `getFillUsage` | `b6fb2b0c1681a22f10b231543c1ecc66d9c307dff62a05c25a040ecf02113d7f` |
| RF-C-015 `buildWaterLine` | `a495e845ff5a972f1dd48b57072a1054ee434d793ff4c9d6f90ccb0f32e2608d` |
| RF-C-018 `renderAllFallback` | `058119c308cce97265223d43e481011b9359b16e0cb8872fef3d744482983a89` |

## Rollback / accessibility / privacy

Rollback of the 6c-B5 retarget = revert this PR (restores overlay last-write of `#current-peptides` even when `app.js` `renderCurrentPeptides` is present). No storage schema change. Never mutate/delete `fitgen-peptide-rebuild-v1`.

No new interactive controls were invented. Tab order returns to the already-approved 6b.3 accordion button + card-action hosts. Bind capture ownership of Delete is unchanged. Screenshots use synthetic names only.

## Residual risks

1. Missing-owner / bind-absent load still last-writes RF cabinet HTML without `.fill-toggle`. That is the characterized safe fallback, not the live-path owner.
2. Live Cabinet fields after this slice are the maintained `app.js` / 6b.3 presentation. Overlay RF-C-015 field generation is frozen and still used only when the maintained renderer is absent. This slice does not move, recalculate, or rewrite those overlay fields.
3. 6b.3 toggles still omit `aria-expanded` / `aria-controls`. Adding that relationship would be a later a11y slice, not B5.
4. 6c-B6+, RF-C-*, packaging, Stage 7, merge, and deploy are not authorized by this slice.
