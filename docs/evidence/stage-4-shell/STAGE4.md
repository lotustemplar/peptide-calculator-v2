# STAGE4 — Issue #30 shell / nav / IA evidence

**Issue:** [#30](https://github.com/lotustemplar/peptide-calculator-v2/issues/30)  
**Branch:** `grok/30-recovery-stage-4-shell`  
**Base:** `main` @ `7cf83791b12cd7811c996cc3040fda95a6263c95`  
**Risk:** Elevated (UI shell) — no Serious DEC  
**Gate:** [ALLOWLIST.md](../baseline-rar-2026-08-16/ALLOWLIST.md)

This is **chrome / IA + existing P0 wiring only**. Calculator form/results, formulas, Mark missed, Stage 5 chips, packaging, and `fitgen-peptide-rebuild-v1` are untouched.

## What changed

| Surface | After |
|---------|--------|
| Hero | `.app-header.app-hero` with FitGen eyebrow, display title, planner lead |
| Tabbar | Fixed to viewport bottom on all widths; order **Add · Schedule · Calendar · Cabinet** |
| View chrome | `.view-chrome` kicker + title on Add / Schedule / Calendar / Cabinet |
| P0 controls | Existing dialog / snackbar / 44px targets restyled only (green chrome, snackbar above tabbar) |

## File ownership (source → target)

| Source (reference only) | Target (this PR) | Notes |
|-------------------------|------------------|-------|
| Baseline IA (extract outside git; Stage 0 hashes) | `index.html` hero, tab order/labels, view-chrome, tabbar after `main` | Do not load baseline `app.js` |
| Stage 2 tokens (PR #27) | `styles.css` hero / fixed tabbar / view-chrome / snackbar placement | Tokens unchanged (`--bg` `#030504`, `--green` `#8ff11d`, tabbar 94/24) |
| Existing P0 | `p0-ux-bind.js` (`handleWizardBack`, `syncTabAria`) | Writers stay in `src/ux/*` / `src/occ/*` |
| Schedule badge | `runtime-fixes.js` `renderScheduleIndicator` writes `.tab-label` | Prevents wiping tab icons |
| Frozen | `app.js`, calc goldens, `src/occ/*`, `src/ux/*.ts` modules | Zero builder/formula/OCC edits |

## Screenshots

Synthetic name **Demo Vial A** only. PNG metadata: none intended (CDP PNG).

| State | Desktop | Narrow mobile |
|-------|---------|---------------|
| Shell / nav (before) | `before-desktop-shell.png` | `before-mobile-shell.png` |
| Shell / nav (after) | `after-desktop-shell.png` | `after-mobile-shell.png` |
| Dirty Cancel (before) | `before-desktop-dirty-cancel.png` | `before-mobile-dirty-cancel.png` |
| Dirty Cancel (after) | `after-desktop-dirty-cancel.png` | `after-mobile-dirty-cancel.png` |
| Taken / Undo (before) | `before-desktop-taken-undo.png` | `before-mobile-taken-undo.png` |
| Taken / Undo (after) | `after-desktop-taken-undo.png` | `after-mobile-taken-undo.png` |

Capture helper (not part of `npm test`): `node scripts/ux/stage4-shell-capture.js --shots before|after`.

## Golden / behavior freeze

Unchanged vs `main` @ `7cf8379`:

| Path | SHA-256 |
|------|---------|
| `scripts/calc/fixtures/legacy-evidence-goldens.json` | `659c1865da95c3197395c931e154c4267c802d8aaf7842aee83345962d013acd` |
| `app.js` | `489cd7b88b90e00bd2a700518312577cf5a65cf12cacc003d9a181422606a537` |

Rollback = revert this PR. Both storage generations remain loadable (Stage 3 envelope rules hold).

## Residual risks

1. Baseline extract is still outside git; hero/tab IA is direction-matched, not a byte-port of baseline `index.html`.
2. Typography remains IBM Plex / Sora (Manrope / Space Grotesk still deferred).
3. Calculator form, results cards, and wizard step art stay on the GitHub path.
4. Schedule due-count badge now writes `.tab-label` so icon markup survives.
