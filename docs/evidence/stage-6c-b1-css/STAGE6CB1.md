# STAGE6CB1 — Issue #34 `injectFallbackStyles` CSS absorb evidence

**Issue:** [#34](https://github.com/lotustemplar/peptide-calculator-v2/issues/34) (Stage **6c-B1 only**)  
**Branch:** `grok/34-stage-6c-b1-css`  
**Base:** `main` @ `6fe7cc1c1b4209ca078df04db67740604d5b7554`  
**Binding:** Codex [NEXT_STAGE_AUTHORIZED](https://github.com/lotustemplar/peptide-calculator-v2/issues/34#issuecomment-5645707739); Spec v2 `docs/recovery/stage-6c-inventory-spec-v2.md`  
**Risk:** Routine / Elevated (CSS absorb) — no Serious DEC  
**Gate:** [ALLOWLIST.md](../baseline-rar-2026-08-16/ALLOWLIST.md)

This is **after-state evidence**. `runtime-fixes.js::injectFallbackStyles` is removed on this branch. Shots prove the former late-injected rules now live in `styles.css` with the same selectors, responsive rule, and light/dark behavior.

## Privacy

Fixtures use synthetic names **Demo Vial A** / **Demo Vial B** only. There is **no real health data**, personal dosing history, credentials, or PHI in these screenshots or in the capture seed.

PNG metadata: none intended (CDP PNG).

Shots are **viewport-sized** (mobile 390×844 @2x, desktop 1280×800). The capture helper does **not** use `captureBeyondViewport`. After write, `scripts/ci/png-evidence.js` rejects uniform/blank or too-tall artifacts. The same check is part of `npm test` via `stage6c-b1-css-test.js`.

## What the shots show

| Surface | After |
| --- | --- |
| Cabinet fixture | `.water-amount-emphasis`, `.vial-row-fallback` / shell / liquid / threshold, `.cabinet-actions-fallback` |
| Cabinet light | `body[data-theme="light"] .vial-shell-fallback` |
| Schedule fixture | `.today-schedule-banner` / card / actions, `.schedule-status-pill`, `.tab-button.has-alert` |
| Schedule light | `body[data-theme="light"] .today-schedule-card` |
| Notification fixture | `.notification-actions` row on the Native Reminders card |
| Live cabinet | Seeded `index.html` after RF last-write; no `#runtime-fixes-style` tag |

## Screenshots

| State | Desktop | Narrow mobile |
| --- | --- | --- |
| Cabinet fixture (dark) | `after-desktop-cabinet-dark.png` | `after-mobile-cabinet-dark.png` |
| Cabinet fixture (light) | `after-desktop-cabinet-light.png` | `after-mobile-cabinet-light.png` |
| Schedule fixture (dark) | `after-desktop-schedule-dark.png` | `after-mobile-schedule-dark.png` |
| Schedule fixture (light) | `after-desktop-schedule-light.png` | `after-mobile-schedule-light.png` |
| Notification fixture (dark) | `after-desktop-notif-dark.png` | `after-mobile-notif-dark.png` |
| Live Cabinet (dark, RF markup) | `after-live-desktop-cabinet-dark.png` | `after-live-mobile-cabinet-dark.png` |

Notification CSS has no light-theme override. Light coverage is the two rules that differ: vial shell and today-schedule card.

Capture helper (not part of `npm test`): `node scripts/ux/stage6c-b1-css-capture.js --shots after`.

## Golden / behavior freeze

Unchanged vs `main` @ `6fe7cc1c1b4209ca078df04db67740604d5b7554`:

| Path | SHA-256 |
| --- | --- |
| `scripts/calc/fixtures/legacy-evidence-goldens.json` | `659c1865da95c3197395c931e154c4267c802d8aaf7842aee83345962d013acd` |
| `app.js` | `489cd7b88b90e00bd2a700518312577cf5a65cf12cacc003d9a181422606a537` |

## Rollback / accessibility

Rollback of the 6c-B1 absorb = revert this PR (restores `injectFallbackStyles` and leaves `styles.css` without the appended block, or keep both briefly). No storage mutation. Never mutate/delete `fitgen-peptide-rebuild-v1`.

Moved rules keep existing contrast tokens (`--teal`, `--mint`, `#ff8a80` alert, light-theme vial/card borders). No new interactive controls. Tab alert color remains the same as the former injector.

## Residual risks

1. `.notification-actions` is still unused by live `index.html` (notif card uses `.notif-step-actions`). The class is preserved for exact CSS parity.
2. 6b.3 bind still strips `.today-schedule-banner` from the live reminder list. Banner CSS is kept because RF still emits the class (RF-B-012 is later).
3. RF still last-writes cabinet markup without `.fill-toggle` (RF-B-010 / later 6c). This slice does not change that markup.
4. 6c-B2+, packaging, Stage 7, merge, and deploy are not authorized by this slice.
