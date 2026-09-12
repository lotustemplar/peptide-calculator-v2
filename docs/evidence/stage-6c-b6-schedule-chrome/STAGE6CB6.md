# STAGE6CB6 — Issue #34 RF-B-011/012 schedule/calendar chrome + banner-at-source evidence

**Issue:** [#34](https://github.com/lotustemplar/peptide-calculator-v2/issues/34) (Stage **6c-B6 only**)  
**Branch:** `grok/34-stage-6c-b6-schedule-chrome`  
**Base:** `main` @ `ef0c8f161f4924313d37602b103d2cfe787e583d` (post–6c-B5)  
**Binding:** Codex [NEXT_STAGE_AUTHORIZED](https://github.com/lotustemplar/peptide-calculator-v2/issues/34#issuecomment-5648096793); standing continuation [5646357576](https://github.com/lotustemplar/peptide-calculator-v2/issues/34#issuecomment-5646357576); Spec v2 `docs/recovery/stage-6c-inventory-spec-v2.md` (RF-B-011 / RF-B-012); Stage 6b.3 banner removal [PR #38](https://github.com/lotustemplar/peptide-calculator-v2/pull/38)  
**Risk:** Elevated (schedule/calendar last-write + banner ownership) — no Serious DEC. Routine for merge class once Codex authorizes the exact head.  
**Gate:** [ALLOWLIST.md](../baseline-rar-2026-08-16/ALLOWLIST.md)

This is **before/after schedule and calendar chrome ownership** evidence. When maintained `app.js` `renderSchedules` / `renderCalendar` are present, overlay `renderFallbackSchedules` / `renderFallbackCalendar` no longer last-write `#reminder-list` / `#calendar-list`. The Due Today banner class is no longer emitted at source (RF-B-012), matching the approved Stage 6b.3 visible result (banner absent; schedule row remains). Bind/app-absent fallback still emits the frozen RF-C-016 / RF-C-017 field templates without the banner class. `runtime-fixes.js` stays loaded and allowlisted.

## Privacy

Fixtures use synthetic names **Demo Vial A** / **Demo Vial B** only. There is **no real health data**, personal dosing history, credentials, or PHI in these screenshots or in the capture seed.

PNG metadata: none intended (CDP PNG).

Shots are **viewport-sized** (mobile 390×844 @2x, desktop 1280×800). The capture helper does **not** use `captureBeyondViewport`. After write, `scripts/ci/png-evidence.js` rejects uniform/blank or too-tall artifacts. The same check is part of `npm test` via `stage6c-b6-schedule-chrome-test.js`.

## Characterization (before ownership change)

Live load order: `p0-ux-bind.js` → `app.js` → `runtime-fixes.js` last-write.

| Surface | Before (RF last-write on main) | 6b.3 visible result |
| --- | --- | --- |
| Empty Schedule | RF empty chrome: `No peptides are due today.` + `No schedules saved yet. Save a fill first.` | Unchanged (no banner class). |
| Populated Schedule | RF `.list-card` last-write. Overlay still concatenated a Due Today banner at source; bind `removeDuplicateScheduleBanner` stripped it because due rows also emit mark-taken. Live `bannerCount` is already **0**. | Banner absent; Demo Vial A row remains. |
| Empty Calendar | RF empty chrome: `No calendar items yet.` | Unchanged. |
| Populated Calendar | RF flat `.calendar-day` (next-due / frequency / draw). No Past/Upcoming sections. | 6b.3 did not touch calendar. |

Re-render entry points that dispatch both overlay renderers: boot `renderAllFallback`, `persistState` (save/edit/delete), `markScheduleTaken`, `saveFallbackFill`, `FitGenRuntimeBridge.renderAll` / `persistAndRender`. Date navigation is the maintained calendar Past Doses / Upcoming grouping (no month-picker control exists).

## What the shots show

| Surface | Before (RF last-write on main) | After (maintained owner) |
| --- | --- | --- |
| Empty Schedule | RF empty chrome (two empty-states). | Maintained empty chrome (`No dosage plans yet…`). No banner. |
| Populated Schedule | RF card, 6b.3 already stripped the banner. One mark-taken host. | Maintained card chrome (`card-actions`, Test Alert). Banner still absent. |
| Empty Calendar | RF `No calendar items yet.` | Maintained empty chrome (`Your calendar is empty right now…`). |
| Populated Calendar | RF flat next-due card. No section headers. | Maintained date-section chrome (`Upcoming` / `.calendar-item`). |
| Date navigation | RF flat card (same as populated). | Maintained Past Doses + Upcoming sections for a 14-day-back start. |
| Keyboard / focus | Not captured (banner already gone; RF hosts only). | Focus lands on Mark as taken / calendar mark-taken host. |

Machine-readable record: `schedule-state.json` (after) and `schedule-state-before.json` (before).

## Screenshots

| State | Desktop | Narrow mobile |
| --- | --- | --- |
| Schedule empty (before) | `before-desktop-schedule-empty.png` | `before-mobile-schedule-empty.png` |
| Schedule populated (before) | `before-desktop-schedule-populated.png` | `before-mobile-schedule-populated.png` |
| Calendar empty (before) | `before-desktop-calendar-empty.png` | `before-mobile-calendar-empty.png` |
| Calendar populated (before) | `before-desktop-calendar-populated.png` | `before-mobile-calendar-populated.png` |
| Calendar dates (before) | `before-desktop-calendar-dates.png` | `before-mobile-calendar-dates.png` |
| Schedule empty (after) | `after-desktop-schedule-empty.png` | `after-mobile-schedule-empty.png` |
| Schedule populated (after) | `after-desktop-schedule-populated.png` | `after-mobile-schedule-populated.png` |
| Calendar empty (after) | `after-desktop-calendar-empty.png` | `after-mobile-calendar-empty.png` |
| Calendar populated (after) | `after-desktop-calendar-populated.png` | `after-mobile-calendar-populated.png` |
| Calendar date navigation (after) | `after-desktop-calendar-dates.png` | `after-mobile-calendar-dates.png` |
| Focus on Mark as taken (after) | `after-desktop-focus-mark-taken.png` | `after-mobile-focus-mark-taken.png` |
| Focus on calendar host (after) | `after-desktop-focus-calendar.png` | `after-mobile-focus-calendar.png` |

Capture helper (not part of `npm test`): `node scripts/ux/stage6c-b6-schedule-chrome-capture.js --shots before|after`.

## Keyboard / ARIA / current-state

Characterized live contract after B6 (preserved maintained hosts, not new ARIA invented here):

- Schedule card: `article.list-card` with `.schedule-status-pill` and `.card-actions`
- Schedule actions: `[data-action="mark-taken"]`, `[data-action="test-reminder"]`, `[data-action="delete-reminder"]`
- Calendar sections: `.calendar-section-header` (`Past Doses` / `Upcoming`)
- Calendar items: `.calendar-item` (+ `.is-today` / `.is-taken`)
- Calendar actions: `[data-action="mark-taken"]` / `[data-action="undo-taken"]` on the occurrence date
- Bind still owns Taken/Undo clicks. Overlay attaches mark-taken listeners only on the missing-owner fallback.
- Keyboard: existing `type="button"` hosts are tabbable; `:focus-visible` uses the Stage 4 2px green outline.

## Golden / behavior freeze

Unchanged vs `main` @ `ef0c8f161f4924313d37602b103d2cfe787e583d`:

| Path | SHA-256 |
| --- | --- |
| `scripts/calc/fixtures/legacy-evidence-goldens.json` | `659c1865da95c3197395c931e154c4267c802d8aaf7842aee83345962d013acd` |
| `app.js` | `489cd7b88b90e00bd2a700518312577cf5a65cf12cacc003d9a181422606a537` |
| RF-C-012 `getTodayDueSchedules` | `4913881b2ea84ddea6c15e4084a14f7c5605ac600a264fcae1fb94c12fa2c1d9` |
| RF-C-012 `isScheduleDueOnDate` | `2fd2b9398c1f58d7fdde754f9951ea75690e1365db347026f75b2303c2ab39a8` |
| RF-C-012 `getNextDue` | `f1bd4eb20320c8e62ebd657d1bed8e19753a10d7e084fb9654d8db6c65e07517` |
| RF-C-012 `isTakenToday` | `3e6ce6284261fd61a26b02d7cff20e9f997a8bf545d54df1beeb810e4d776f22` |
| RF-C-014 `renderScheduleIndicator` | `0488c419aae55796df2f48dd031ba83f8c20f7d21bd331bbc7c3223c2cbb4e10` |
| RF-C-018 `renderAllFallback` | `058119c308cce97265223d43e481011b9359b16e0cb8872fef3d744482983a89` |
| RF-C-015 cabinet fallback fields | `6cc5043d0df998c32626ae8605149f25126ae0fa2c934fb2d8a770d93fc493ed` |

Authorized chrome-only change (fallback still last-writes these only when owners are absent):

| Path | SHA-256 |
| --- | --- |
| RF-C-016 fallback field template (body of `renderFallbackSchedules` after the owner guard; banner emit removed) | `64f71f6d4838744560ae6cc1cd70d6529e8108da115ff9160a788ae09b41f2b5` |
| RF-C-017 fallback field template (body of `renderFallbackCalendar` after the owner guard) | `e71e647540ca99539338bf2a1de78ff8a5047cdc03b9c61864c693c3917399c9` |

## Rollback / accessibility / privacy

Rollback of the 6c-B6 retarget = revert this PR (restores overlay last-write of `#reminder-list` / `#calendar-list` and the Due Today banner emit even when `app.js` owners are present). No storage schema change. Never mutate/delete `fitgen-peptide-rebuild-v1`.

No new interactive controls were invented. Tab order returns to the already-approved schedule / calendar action hosts. Bind capture ownership of Mark Taken / Undo is unchanged. Screenshots use synthetic names only.

## Residual risks

1. Missing-owner / bind-absent load still last-writes RF schedule/calendar HTML. That is the characterized safe fallback, not the live-path owner. The fallback no longer emits the Due Today banner class (RF-B-012).
2. Live schedule/calendar fields after this slice are the maintained `app.js` presentation. Overlay RF-C-016 / RF-C-017 field generation is frozen and still used only when the maintained renderer is absent. This slice does not move, recalculate, or rewrite those overlay due/taken/dose rules.
3. 6b.3 `removeDuplicateScheduleBanner` remains as belt-and-braces for leftover injected DOM. It is a no-op on the live path because the banner class is no longer written.
4. 6c-B7+, RF-C-*, packaging, Stage 7, merge, and deploy are not authorized by this slice.
