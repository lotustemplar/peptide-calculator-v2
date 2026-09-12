# Stage 6c inventory Spec v2 — atomic A/B/C map

**Issue:** [#34](https://github.com/lotustemplar/peptide-calculator-v2/issues/34) (Recovery Stage 6 — last remaining allowlisted overlay `runtime-fixes.js`)  
**Status:** Binding **inventory Spec only**. Not an implement CLAIM.  
**Base (read-only):** `main` @ `d923fa9f28455237f08189676a8f5e2fabc6f979`  
**Risk:** Routine for this document (docs). Future 6c slices remain Routine / Elevated / Serious per row.  
**File characterized:** `runtime-fixes.js` — **stays loaded + allowlisted**.

This document is the repo copy of the binding Stage 6c inventory Spec v2 posted as Issue #34 comment [5642634248](https://github.com/lotustemplar/peptide-calculator-v2/issues/34#issuecomment-5642634248). It supersedes comments [5642322810](https://github.com/lotustemplar/peptide-calculator-v2/issues/34#issuecomment-5642322810) and [5642342379](https://github.com/lotustemplar/peptide-calculator-v2/issues/34#issuecomment-5642342379) for **authorization mapping**. Those comments stay as history. Codex `[CODEX] [REVIEW] — CHANGES REQUESTED` is [5642346546](https://github.com/lotustemplar/peptide-calculator-v2/issues/34#issuecomment-5642346546); this v2 map addresses findings 1–11.

## What this Spec authorizes

**Inventory-only.** This Spec does **not** authorize:

- production / runtime code
- an implement CLAIM, absorb slice, deletion, or allowlist shrink
- packaging / Stage 7 / Mark missed
- changes to `runtime-fixes.js`, `app.js`, `src/`, or allowlists

`runtime-fixes.js` remains loaded and allowlisted until a later **authorized** slice actually removes live owners. Approval of **this inventory map alone** does not authorize implementation, deletion, allowlist changes, merge, packaging, or Stage 7.

### Slice authorization (Issue #2 coordination lock)

Binding lock: Issue #2 comment [5643237028](https://github.com/lotustemplar/peptide-calculator-v2/issues/2#issuecomment-5643237028).

- **A and B** implementation slices stay unauthorized by this inventory PR. After this map is accepted, Codex may later authorize **one named slice at a time** with `[CODEX] [NEXT_STAGE_AUTHORIZED]`, after checking prerequisites, risk, dependencies, characterization/tests, and scope.
- Every **RF-C-*** slice still requires `[CODEX] [OWNER_REQUIRED]` and Filipe’s Serious decision.
- Filipe is contacted only for Serious / owner-only matters. Codex authorizes routine/elevated A/B work through `[CODEX] [NEXT_STAGE_AUTHORIZED]`.

**Next owner after this document:** Codex `[CODEX] [REVIEW]` of inventory Spec v2.

## Source comments

| Role | Comment | URL |
| --- | --- | --- |
| Binding Spec v2 (this document) | [GROK] [SPEC] Stage 6c inventory v2 — atomic A/B/C rows | https://github.com/lotustemplar/peptide-calculator-v2/issues/34#issuecomment-5642634248 |
| Superseded v1 inventory (history) | [GROK] [SPEC] Stage 6c — inventory-only decomposition | https://github.com/lotustemplar/peptide-calculator-v2/issues/34#issuecomment-5642322810 |
| Superseded v1 amendment (history) | [GROK] [SPEC] Stage 6c inventory — amendment | https://github.com/lotustemplar/peptide-calculator-v2/issues/34#issuecomment-5642342379 |
| Codex CHANGES addressed here | [CODEX] [REVIEW] — CHANGES REQUESTED | https://github.com/lotustemplar/peptide-calculator-v2/issues/34#issuecomment-5642346546 |
| PR-first coordination lock | [GROK] [UPDATE] Filipe locked PR-first Codex handoffs | https://github.com/lotustemplar/peptide-calculator-v2/issues/2#issuecomment-5643237028 |
| Governance correction trigger | [CODEX] [CHANGES_REQUIRED] on draft PR #41 | https://github.com/lotustemplar/peptide-calculator-v2/pull/41#issuecomment-5643262504 |

## Bucket rules (normative)

| Bucket | Meaning |
| --- | --- |
| **A** | Prove-and-delete only after fail-closed characterization shows the path is unreachable / already owned |
| **B** | Routine/elevated presentation or plumbing absorb — **one unambiguous product surface** |
| **C** | Serious / frozen — formula, dose/draw presentation, due/taken semantics, reminder/notification architecture, backend sync, medical-adjacent claims |

**B→C isolation rule (Codex #11 / standing):** A future **B** slice may **not** call, move, wrap, or alter a **C** function except through an **unchanged, characterized interface** that already exists at tip. If a candidate B needs to change C behavior, reclassify the work as **C** (or split off a C dependency first). Any RF-C-* dependency or slice then requires `[CODEX] [OWNER_REQUIRED]` and Filipe’s Serious decision — not a routine A/B authorization.

**Mixed-row rule:** No inventory row may be labeled `A/B`, `B/C`, or “B with C-adjacent note.” Split into atomic rows.

## Hard locks (unchanged)

- No formula/unit/option-ranking/defaults changes without Serious DEC
- RF calculator path **≠** frozen `app.js` (min draw / option limit / ranking diverge) — confirmed C
- No revision of reminder architecture (DEC-REM); no Mark missed; no packaging
- RF cabinet last-write can wipe 6b.3 `.fill-toggle` accordion — elevated ordering constraint for B UI slices
- Never mutate/delete `fitgen-peptide-rebuild-v1`
- Default agent-merge off

## Atomic inventory

### Constants / identity / sync

| ID | Behavior | Bucket | Notes |
| --- | --- | --- | --- |
| RF-C-001 | Formula constants (`MIN_DRAW_ML=0.1`, abs min 0.05, step, limit 18, default max water) | **C** | Diverges from frozen `app.js` |
| RF-C-002 | `getPushExternalIdForSync` | **C** | Push/backend identity |
| RF-C-003 | `syncRemindersToBackend` POST `/reminders/sync` (incl. dose fields) | **C** | DEC-REM / health payload |
| RF-B-001 | Storage key **map literals only** (no write behavior) | **B** | Keys already shared with Stage 3; no rebuild key |

### Boot / CSS / legacy hide

| ID | Behavior | Bucket | Notes |
| --- | --- | --- | --- |
| RF-B-002 | IIFE DOM boot/guard (early return if nodes missing) | **B** | Glue |
| RF-B-003 | `injectFallbackStyles` → move surviving CSS only | **B** | No JS behavior |
| RF-B-004 | `hideLegacyScheduleEditor` **live hide call** | **B** | Codex #1: not A until proven dead |
| RF-A-001 | Proven-dead branch of schedule-form hide **if** characterization shows CSS-only ownership and RF call is no-op | **A** | Only after tests; else stay RF-B-004 |

### Persistence bridge (Codex #2 split)

| ID | Behavior | Bucket | Notes |
| --- | --- | --- | --- |
| RF-B-005 | `persistState` / bridge path that calls **existing** `commitAppState` / `readAppState` with parity tests | **B** | Envelope plumbing only |
| RF-C-004 | Any `persistState` path that **invokes** `syncRemindersToBackend` | **C** | Must not ride inside a B persist slice |
| RF-C-005 | Legacy raw mirror `writeFills`/`writeSchedules` when envelope path absent/bypassable | **C** | Until proven unreachable |

### Format helpers (Codex #3 split)

| ID | Behavior | Bucket | Notes |
| --- | --- | --- | --- |
| RF-B-006 | Generic `escapeHtml`, date-key parse/format **without** dose semantics | **B** | |
| RF-C-006 | `formatNumber` / `formatMl` / `formatDrawMl` / `formatDose` (rounding + unit/draw presentation) | **C** | Serious presentation |

### Calculator / options (Serious)

| ID | Behavior | Bucket | Notes |
| --- | --- | --- | --- |
| RF-C-007 | `getInputs`, builders, `scoreOption`, `computeOptions`, result grid render, form capture recompute | **C** | Live RF ≠ app.js |
| RF-C-008 | Water-line / draw guidance / precision copy strings | **C** | Dose-presentation |

### Reminder / notification architecture (Serious)

| ID | Behavior | Bucket | Notes |
| --- | --- | --- | --- |
| RF-C-009 | `fireBrowserNotification`, `getNextPendingReminder`, `queueUpcomingBrowserReminder` timers | **C** | DEC-REM |
| RF-C-010 | Notification permission capture steal + status copy that gates prompts | **C** | |
| RF-C-011 | `maybeShowDailyBrowserPrompt` + daily-prompt LS | **C** | |
| RF-B-007 | Notification **label/class-only** rendering that does **not** call RF-C-009…011 | **B** | Only if split behind unchanged interface; else stays C |

### Due / taken semantics (Codex #4 split)

| ID | Behavior | Bucket | Notes |
| --- | --- | --- | --- |
| RF-C-012 | `isScheduleDueOnDate`, `getNextDue`, `isTakenToday`, due filtering in `getTodayDueSchedules` | **C** | Occurrence/reminder semantics |
| RF-B-008 | Pure `normalizeSchedule` field shaping **with zero due/taken rule change** | **B** | After live-path characterization |
| RF-A-002 | Proven-dead pure helpers with no live callers | **A** | After characterization only |
| RF-C-013 | `getFillUsage` remaining amount/volume, doses-left, reorder≤4 threshold/copy | **C** | Medical-adjacent |

### Schedule indicator (Codex #5 split)

| ID | Behavior | Bucket | Notes |
| --- | --- | --- | --- |
| RF-B-009 | Visual label/class rendering for schedule tab badge **only**, calling due-count via **unchanged** characterized interface | **B** | Must not embed RF-C-012 or RF-C-011 |
| RF-C-014 | Due-count computation + any call to `maybeShowDailyBrowserPrompt` from indicator path | **C** | |

### Cabinet UI (Codex #6 + accordion amendment)

| ID | Behavior | Bucket | Notes |
| --- | --- | --- | --- |
| RF-B-010 | Cabinet **container/card/action shell** markup only (Edit/Delete button hosts) | **B** | Elevated: currently last-writes and can wipe 6b.3 `.fill-toggle` |
| RF-C-015 | Cabinet fields: next-dose text, dose/draw/frequency, water-line, usage/reorder presentation | **C** | |
| RF-A-003 | Bubble listeners that only call prompt `editFillRecord` / guarded `deleteFillRecord` when bind capture already owns the actions | **A** | After load-order tests |

### Schedules / calendar lists (Codex #7 split)

| ID | Behavior | Bucket | Notes |
| --- | --- | --- | --- |
| RF-B-011 | Schedule/calendar **chrome/markup** only (card chrome, empty states) | **B** | |
| RF-B-012 | Stop emitting `.today-schedule-banner` at source **iff** visible result parity-locked to approved 6b.3 removal behavior | **B** | Narrow; no due-math change |
| RF-C-016 | Due/taken pills, next-due text, dose/draw/frequency copy, Mark Taken/Undo eligibility wiring semantics | **C** | Bind owns Taken/Undo clicks; RF must not change eligibility rules in a B slice |
| RF-C-017 | Calendar schedule semantics (next-due computation display rules) | **C** | |

### Orchestration (Codex #8 split)

| ID | Behavior | Bucket | Notes |
| --- | --- | --- | --- |
| RF-B-013 | `renderAllFallback` **API shell** that only dispatches to already-split owners | **B** | Only after C renderers/timers are not invoked from this function body |
| RF-C-018 | Current `renderAllFallback` body that calls C renderers + notification render + `queueUpcomingBrowserReminder` | **C** | Classify whole fn **C** until dependencies separated |

### Mark taken (Codex #9 split)

| ID | Behavior | Bucket | Notes |
| --- | --- | --- | --- |
| RF-B-014 | Adapter delegation plumbing to `FitGenP0UxBind.adapter().markTaken` | **B** | No rule change |
| RF-C-019 | Legacy `takenDates` mutation branch | **C** | Until fail-closed tests prove unreachable |
| RF-A-004 | Delete legacy `takenDates` branch **only after** RF-C-019 proven unreachable | **A** | |

### Save-fill modal (Codex #10 split)

| ID | Behavior | Bucket | Notes |
| --- | --- | --- | --- |
| RF-B-015 | Modal open/close/cancel chrome only | **B** | |
| RF-C-020 | Showing dose/draw/water from `pendingOption`; creating fill/schedule dose fields; legacy mirror writes; calling backend sync on save | **C** | |
| RF-A-005 | Save-form capture / `saveFallbackFill` **only if** event-order tests prove bind always wins and RF path unreachable | **A** | Default stays RF-C-020 until proven |

### Tabs / view

| ID | Behavior | Bucket | Notes |
| --- | --- | --- | --- |
| RF-B-016 | `setActiveViewFallback` + tab capture chrome (no reminder side effects) | **B** | |

### `FitGenRuntimeBridge` (Codex #11 split)

| ID | Behavior | Bucket | Notes |
| --- | --- | --- | --- |
| RF-B-017 | Bridge `setView` | **B** | |
| RF-B-018 | Bridge `closeSaveModal` chrome-only | **B** | |
| RF-C-021 | Bridge `persistAndRender` while it reaches backend sync / C persist | **C** | Until sync/C writes split out |
| RF-C-022 | Bridge `renderAll` while it reaches reminder timers / C dose renderers | **C** | |
| RF-C-023 | Bridge `getPendingOption` / save-modal coupling to RF-C-020 | **C** | |

### Absent / out of scope

| ID | Behavior | Bucket | Notes |
| --- | --- | --- | --- |
| RF-X-001 | Export/import/native backup | **A absent** | Owned by Stage 3 + 6b.1/6b.4 |
| RF-X-002 | Mark missed | Stage 7 | Unauthorized |
| RF-X-003 | Packaging | #18/#23 | Unauthorized |

## How this answers Codex findings

| Codex item | Resolution |
| --- | --- |
| #1 RF-004 | Split RF-B-004 (live hide) vs RF-A-001 (proven-dead only) |
| #2 RF-005 | Split RF-B-005 / RF-C-004 / RF-C-005 |
| #3 RF-006 | Split RF-B-006 vs RF-C-006 |
| #4 RF-009 | Split RF-C-012 / RF-B-008 / RF-A-002 (no B/C row) |
| #5 RF-012 | Split RF-B-009 vs RF-C-014 |
| #6 RF-013 | Split RF-B-010 vs RF-C-015 (+ RF-C-013 usage) |
| #7 RF-016/017 | Split RF-B-011/012 vs RF-C-016/017 |
| #8 RF-018 | RF-C-018 until split; RF-B-013 only after |
| #9 RF-019 | RF-B-014 / RF-C-019 / RF-A-004 |
| #10 RF-020 | RF-B-015 / RF-C-020 / RF-A-005 |
| #11 RF-023 | Per-method RF-B-017/018 vs RF-C-021…023 + B→C isolation rule |

## Revised future order (**still not authorized**)

Recommended **A/B** order only. Still **not authorized** by this inventory PR. After Codex accepts this v2 map, a named A/B slice may start only when Codex posts `[CODEX] [NEXT_STAGE_AUTHORIZED]` for that **one** slice (prerequisites, risk, dependencies, characterization/tests, and scope checked):

1. **6c-B1** — RF-B-003 CSS injector → `styles.css`
2. **6c-B2** — RF-A-003 (+ RF-A-001/004/005 only if proven) dead-path deletion tests
3. **6c-B3** — Bridge method retarget **only** for RF-B-017/018; do not move RF-C-021…023 in the same tip
4. **6c-B4** — RF-B-016 tabs/view
5. **6c-B5** — RF-B-010 cabinet shell stop-last-write / restore 6b.3 accordion hosts (screenshots); **no** RF-C-015 fields
6. **6c-B6** — RF-B-011/012 schedule chrome + banner-at-source parity with 6b.3

**Stop.** All RF-C-* remain allowlisted until `[CODEX] [OWNER_REQUIRED]` and Filipe’s Serious decision. Approval of this inventory map alone does not authorize implementation, deletion, allowlist changes, merge, packaging, or Stage 7.

## Next owner

**Codex** — `[CODEX] [REVIEW]` **inventory Spec v2** (this document + Issue comment 5642634248). Challenge any remaining mixed coupling.

A/B implementation remains unauthorized until a later `[CODEX] [NEXT_STAGE_AUTHORIZED]` names one slice. RF-C-* remains blocked pending `[CODEX] [OWNER_REQUIRED]` and Filipe’s Serious decision.
