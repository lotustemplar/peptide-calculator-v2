# STAGE6B3 — Issue #34 `ui-polish-fix.js` absorb evidence

**Issue:** [#34](https://github.com/lotustemplar/peptide-calculator-v2/issues/34) (Stage **6b.3 only**)  
**PR:** [#38](https://github.com/lotustemplar/peptide-calculator-v2/pull/38)  
**Branch:** `grok/34-recovery-stage-6b-ui-polish`  
**Reviewed implementation tip:** `79033be893aa6565b1880c5d70c88a50317cb877`  
**Risk:** Elevated (UX chrome absorb) — no Serious DEC  
**Gate:** [ALLOWLIST.md](../baseline-rar-2026-08-16/ALLOWLIST.md)

This is **after-state evidence only**. `ui-polish-fix.js` is already retired on this branch, so a practical overlay-before capture is not available. Shots show the live UI after accordion + duplicate-banner absorb (no app-behavior change in the evidence commit).

## Privacy

Fixtures use synthetic names **Demo Vial A** / **Demo Vial B** only. There is **no real health data**, personal dosing history, credentials, or PHI in these screenshots or in the capture seed.

PNG metadata: none intended (CDP PNG).

Shots are **viewport-sized** (mobile 390×844 @2x, desktop 1280×800). The capture helper does **not** use `captureBeyondViewport` — oversized dumps preview on GitHub as an empty dark frame. After write, `scripts/ci/png-evidence.js` rejects uniform/blank or too-tall artifacts. Same check is part of `npm test` via `stage6b3-ui-polish-test.js`.

## What the shots show

| Surface (Codex finding #1) | After |
|----------------------------|--------|
| Cabinet after startup collapse | Accordion keeps the fill header; extra usage / vial rows stay hidden |
| Expanded Cabinet fill | Additional usage-grid + vial-row + actions visible on Demo Vial A |
| Medications card + authored order | `#backup-card` → `#medications-card` → `#cabinet-card`; meds remain visible |
| Schedule / Today | `.today-schedule-banner` duplicate chrome absent; Demo Vial A schedule row remains |
| Restored hide-not-ported chrome | `#selected-fill` on Add; `#notif-setup-card` / Enable Native Alerts on Schedule |

## Screenshots

| State | Desktop | Narrow mobile |
|-------|---------|---------------|
| Cabinet collapsed (intended startup accordion) | `after-desktop-cabinet-collapsed.png` | `after-mobile-cabinet-collapsed.png` |
| Cabinet expanded (extra rows visible) | `after-desktop-cabinet-expanded.png` | `after-mobile-cabinet-expanded.png` |
| Backup → Medications → Cabinet order | `after-desktop-cabinet-order.png` | `after-mobile-cabinet-order.png` |
| Schedule row without duplicate Due Today banner | `after-desktop-schedule.png` | `after-mobile-schedule.png` |
| Selected-fill chrome visible | `after-desktop-selected-fill.png` | `after-mobile-selected-fill.png` |
| Notification setup chrome visible | `after-desktop-notif-setup.png` | `after-mobile-notif-setup.png` |

Capture helper (not part of `npm test`): `node scripts/ux/stage6b3-ui-polish-capture.js --shots after`. Inspect the written PNG pixels after generation; do not rely on DOM assertions alone.

`runtime-fixes.js` (Stage 6c, not this slice) last-writes a fallback cabinet without `.fill-toggle`. The collapsed / expanded shots re-render `app.js` cabinet markup and apply the absorbed `collapseCabinetAtStartup` / accordion layout so the 6b.3 accordion is visible. Order, schedule, selected-fill, and notification shots are the as-loaded live chrome.

## Golden / behavior freeze

Unchanged vs implementation tip `79033be` / `main` @ `53d1016`:

| Path | SHA-256 |
|------|---------|
| `scripts/calc/fixtures/legacy-evidence-goldens.json` | `659c1865da95c3197395c931e154c4267c802d8aaf7842aee83345962d013acd` |
| `app.js` | `489cd7b88b90e00bd2a700518312577cf5a65cf12cacc003d9a181422606a537` |

Rollback of the 6b.3 absorb = revert PR #38. This evidence commit adds docs + an unused-by-CI capture helper only. Never mutate/delete `fitgen-peptide-rebuild-v1`.

## Residual risks

1. Duplicate banner absorb remains necessary while `runtime-fixes.js` `renderFallbackSchedules` still concatenates a Due Today banner with mark-taken rows (6c).
2. Fallback cabinet markup without `.fill-toggle` is 6c territory; 6b.3 accordion is proven on the `app.js` `.fill-toggle` cards the overlay originally targeted.
3. Notification / selected-fill chrome reappear because hide was prove-and-delete, not product chrome to keep.
4. Stage 6b.4 (`native-backup-fix.js`) / 6c / packaging are not started.
