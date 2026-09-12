# STAGE6CB4 — Issue #34 RF-B-016 tabs/view chrome evidence

**Issue:** [#34](https://github.com/lotustemplar/peptide-calculator-v2/issues/34) (Stage **6c-B4 only**)  
**Branch:** `grok/34-stage-6c-b4-tabs-view`  
**Base:** `main` @ `4faba60c9f5b71c6f5be86a23f4aa3d489e32f4d` (post–6c-B3)  
**Binding:** Codex [NEXT_STAGE_AUTHORIZED](https://github.com/lotustemplar/peptide-calculator-v2/issues/34#issuecomment-5647362529); standing continuation [5646357576](https://github.com/lotustemplar/peptide-calculator-v2/issues/34#issuecomment-5646357576); Spec v2 `docs/recovery/stage-6c-inventory-spec-v2.md` (RF-B-016)  
**Risk:** Routine — navigation chrome ownership only. No Serious DEC.  
**Gate:** [ALLOWLIST.md](../baseline-rar-2026-08-16/ALLOWLIST.md)

This is **before/after visual parity** for the tabbar and four app views. The overlay-owned `bindFallbackTabs` capture steal and boot `setActiveViewFallback` stand down when maintained `app.js` `setActiveView` is present. Bind/app-absent fallbacks remain. `runtime-fixes.js` stays loaded and allowlisted.

## Privacy

Shots use the empty live `index.html` shell (no fills, no schedules, no names). There is **no real health data**, personal dosing history, credentials, or PHI in these screenshots or in the capture seed.

PNG metadata: none intended (CDP PNG).

Shots are **viewport-sized** (mobile 390×844 @2x, desktop 1280×800). The capture helper does **not** use `captureBeyondViewport`. After write, `scripts/ci/png-evidence.js` rejects uniform/blank or too-tall artifacts. The same check is part of `npm test` via `stage6c-b4-tabs-view-test.js`.

## What the shots show

| Surface | Before (overlay capture still live on main) | After (app.js owner) |
| --- | --- | --- |
| Add / calculator | default `is-active` + `aria-current="page"` | same chrome, owner is `setActiveView` |
| Schedule | tab click activates schedule-view | same chrome + keyboard focus ring |
| Calendar | tab click activates calendar-view | same chrome |
| Cabinet | tab click activates cabinet-view | same chrome |

Before/after PNGs for the same viewport + view are **byte-identical** (SHA-256 match). Ownership changed; pixels did not.

| Pair | SHA-256 |
| --- | --- |
| desktop calculator | `88194b613d4b07e082a8fa32e9f697b596dd8ca38bf64881d9505bbcc167e923` |
| mobile calculator | `b55ab8c78565c74aa3ef435f8c08fcb6137cde0f1837c794896a27c0da451839` |
| desktop schedule | `419e043181975c4fc7ee05a7fae31564233b74bfe688523604e91615bd8f2836` |
| mobile schedule | `cf4e7754f973c3daa1d1dfb4bc3a41f0aec98ce2bf68f0c22453734507aa22e4` |
| desktop calendar | `58bfc493bc24d63e390d3a1247d0a041f1a9dfe1b2a503a0d9274432cd1326c3` |
| mobile calendar | `204f14a6007c8b2d2d16b030116839ba83af6c7eb606b7c20718963a256fd7e5` |
| desktop cabinet | `af973a29e6e8ead147a0ad641ea5783bf4b44b8c787991be2c2eb7db153f376e` |
| mobile cabinet | `a6eed3d44eb7c63c24addc9ec64cdfff172e83502b3d2203f4f6cc5a793299e0` |

## Screenshots

| State | Desktop | Narrow mobile |
| --- | --- | --- |
| Calculator (before) | `before-desktop-calculator.png` | `before-mobile-calculator.png` |
| Schedule (before) | `before-desktop-schedule.png` | `before-mobile-schedule.png` |
| Calendar (before) | `before-desktop-calendar.png` | `before-mobile-calendar.png` |
| Cabinet (before) | `before-desktop-cabinet.png` | `before-mobile-cabinet.png` |
| Calculator (after) | `after-desktop-calculator.png` | `after-mobile-calculator.png` |
| Schedule (after) | `after-desktop-schedule.png` | `after-mobile-schedule.png` |
| Calendar (after) | `after-desktop-calendar.png` | `after-mobile-calendar.png` |
| Cabinet (after) | `after-desktop-cabinet.png` | `after-mobile-cabinet.png` |
| Schedule keyboard focus (after) | `after-desktop-schedule-focus.png` | `after-mobile-schedule-focus.png` |

## Keyboard / ARIA / current-state

Machine-readable record: `chrome-state.json` (after) and `chrome-state-before.json` (before).

Characterized live contract, unchanged by this slice:

- Storage key: `peptide-calculator-v2-active-view`
- Stored format: `JSON.stringify(viewId)` (quoted JSON string, e.g. `"schedule-view"`)
- Default / missing: `calculator-view`
- Active chrome: `.is-active` on matching `[data-view]` and `[data-view-target]`
- Current tab: `aria-current="page"` via bind `installTabAriaSync` (class observer)
- Keyboard: tab buttons are `type="button"`; Enter activates the focused tab; `:focus-visible` uses a 2px green outline (`styles.css`)

After B4, a real tab `.click()` and a Tab+Enter path both land on the maintained `window.setActiveView` owner. Overlay capture no longer calls `preventDefault` / `stopImmediatePropagation` when that owner is present.

## Golden / behavior freeze

Unchanged vs `main` @ `4faba60c9f5b71c6f5be86a23f4aa3d489e32f4d`:

| Path | SHA-256 |
| --- | --- |
| `scripts/calc/fixtures/legacy-evidence-goldens.json` | `659c1865da95c3197395c931e154c4267c802d8aaf7842aee83345962d013acd` |
| `app.js` | `489cd7b88b90e00bd2a700518312577cf5a65cf12cacc003d9a181422606a537` |

## Rollback / accessibility

Rollback of the 6c-B4 retarget = revert this PR (restores overlay capture steal and boot `setActiveViewFallback` even when `app.js` is present). No storage schema change. Never mutate/delete `fitgen-peptide-rebuild-v1`.

No new interactive controls. Tab order, labels, and `aria-current` names are unchanged. Focus-visible outline is the existing Stage 4 token.

## Residual risks

1. `setActiveViewFallback` remains for B3 `FitGenRuntimeBridge.setView` bind/app-absent fallback and for RF-C-020 `saveFallbackFill("cabinet-view")`. Those callers were not retargeted.
2. Bind/app-absent load still attaches capture-phase tab steal. That is the characterized safe fallback, not a live-path owner.
3. 6c-B5+, RF-C-*, packaging, Stage 7, merge, and deploy are not authorized by this slice.
