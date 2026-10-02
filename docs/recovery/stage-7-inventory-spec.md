# Stage 7 inventory Spec — remaining work map

**Issue:** [#50](https://github.com/lotustemplar/peptide-calculator-v2/issues/50) (Stage 7 — inventory and specification only)  
**Status:** Binding **inventory Spec only**. Not an implement CLAIM.  
**Base (read-only):** `main` @ `007b4b44ae24504d30d66a295f7502898a3400b9` (PR #23 merge; authorized packaging tip `bdbc497bc73f32152d0fd49fad81983c973b831b`)  
**Risk:** Routine for this document (docs). Future Stage 7 slices remain Routine / Elevated / Serious per row.  
**Authorization:** Codex `[NEXT_STAGE_AUTHORIZED]` on Issue #34 comment [5648961867](https://github.com/lotustemplar/peptide-calculator-v2/issues/34#issuecomment-5648961867)

This document is the repo copy of the binding Stage 7 inventory Spec posted as Issue #50 comment [5648976068](https://github.com/lotustemplar/peptide-calculator-v2/issues/50#issuecomment-5648976068). It inventories remaining FitGen work after Stages 0–6b, 6c-B1…B6, and Issue #18 packaging, and separates independently reviewable routine/elevated slices from Serious / owner-only decisions.

Residual Stage 6c A/B/C row IDs are taken from `docs/recovery/stage-6c-inventory-spec-v2.md` (Issue #34 comment [5642634248](https://github.com/lotustemplar/peptide-calculator-v2/issues/34#issuecomment-5642634248)). **Do not invent RF-A / RF-B / RF-C IDs.**

## What this Spec authorizes

**Inventory-only.** This Spec does **not** authorize:

- production / runtime code (`app.js`, `runtime-fixes.js`, `src/`, allowlists, Android, workflows)
- an implement CLAIM for any Stage 7 or residual 6c A/B slice
- deletion, absorb, or allowlist shrink
- calculator formula, units, rounding, ranking, recommended-dose, dose/default, medication-safety, reminder/background, privacy/cloud/sync, or health-data behavior changes
- Mark missed (RF-X-002) behavior
- GitHub Release, signing, Play submission, deployment, publishing, or production release
- merge of this inventory PR (Codex inventory `APPROVED` only; no merge/implement auth)

`runtime-fixes.js` remains loaded and allowlisted until a later **authorized** slice actually removes live owners. Approval of **this inventory map alone** does not authorize implementation, deletion, allowlist changes, merge, packaging, Play, or deploy.

### Slice authorization (Issue #2 coordination lock)

Binding lock: Issue #2 comment [5643237028](https://github.com/lotustemplar/peptide-calculator-v2/issues/2#issuecomment-5643237028). Stage 7 inventory inherits the same gate as Stage 6c:

- **Routine / elevated** implementation slices stay unauthorized by this inventory PR. After this map is accepted, Codex may later authorize **one named slice at a time** with `[CODEX] [NEXT_STAGE_AUTHORIZED]`, after checking prerequisites, risk, dependencies, characterization/tests, and scope.
- Every **RF-C-*** slice, and every other Serious / owner-only row below, still requires `[CODEX] [OWNER_REQUIRED]` and Filipe’s Serious decision.
- Filipe is contacted only for Serious / owner-only matters. Codex authorizes routine/elevated work through `[CODEX] [NEXT_STAGE_AUTHORIZED]`.
- Do **not** bundle a Serious / owner-only item with a routine or elevated slice.

**Next owner after this document:** Codex `[CODEX] [REVIEW]` of this inventory Spec (docs PR + Issue #50 comment 5648976068). Eligible routine/elevated Stage 7 slices are authorized separately later.

## Source comments

| Role | Comment | URL |
| --- | --- | --- |
| Binding Stage 7 inventory Spec (this document) | [GROK] [SPEC] Stage 7 — inventory Spec only | https://github.com/lotustemplar/peptide-calculator-v2/issues/50#issuecomment-5648976068 |
| Stage 7 CLAIM | [GROK] [CLAIM] Atlas + Forge docs-only | https://github.com/lotustemplar/peptide-calculator-v2/issues/50#issuecomment-5648975984 |
| Codex Stage 7 inventory authorization | [CODEX] [NEXT_STAGE_AUTHORIZED] | https://github.com/lotustemplar/peptide-calculator-v2/issues/34#issuecomment-5648961867 |
| Residual 6c A/B/C map (IDs only) | Stage 6c inventory Spec v2 | https://github.com/lotustemplar/peptide-calculator-v2/issues/34#issuecomment-5642634248 |
| PR-first coordination lock | [GROK] [UPDATE] Filipe locked PR-first Codex handoffs | https://github.com/lotustemplar/peptide-calculator-v2/issues/2#issuecomment-5643237028 |
| Spec v1.2 Filipe baseline | [GROK] [COMPLETE] Approve Spec v1.2 Option A | https://github.com/lotustemplar/peptide-calculator-v2/issues/2#issuecomment-5590169938 |
| Filipe Stage-1 product direction | [GROK] [UPDATE] Stage-1 approval | https://github.com/lotustemplar/peptide-calculator-v2/issues/2#issuecomment-5595858549 |

Process note (not a work slice): Issue [#49](https://github.com/lotustemplar/peptide-calculator-v2/issues/49) is an unused duplicate of #50 (same title/body, no comments). Tracker for this inventory is **#50**.

## Hard locks (from Codex comment 5648961867)

Copied from the authorizing `[CODEX] [NEXT_STAGE_AUTHORIZED]`:

- no production/runtime implementation in this inventory slice
- no calculator formula, units, rounding, ranking, recommended-dose, dose/default, medication-safety, reminder/background, privacy/cloud/sync, or health-data behavior changes
- no GitHub Release, signing, Play submission, deployment, publishing, or production release
- mark every Serious item explicitly for owner decision and do not bundle it with routine work

### Standing locks (unchanged)

- No formula/unit/option-ranking/defaults changes without a Serious DEC
- RF calculator path **≠** frozen `app.js` (min draw / option limit / ranking diverge) — confirmed **C**
- No revision of reminder architecture (DEC-REM); no Mark missed implementation
- Play / submit-ready packaging remains **OFF** (Actions-artifact internal-test APK already landed via PR #23)
- Never mutate/delete `fitgen-peptide-rebuild-v1`
- Never add another runtime `*-fix.js`
- Default agent-merge off
- Do not undraft/merge this inventory PR unless a later exact-head `[CODEX] [MERGE_AUTHORIZED]` names this tip (this handoff asks inventory `APPROVED` only)

## B→C isolation rule (standing)

Restated from Stage 6c inventory Spec v2 (Codex #11 / standing):

A future **B** slice may **not** call, move, wrap, or alter a **C** function except through an **unchanged, characterized interface** that already exists at tip. If a candidate B needs to change C behavior, reclassify the work as **C** (or split off a C dependency first). Any RF-C-* dependency or slice then requires `[CODEX] [OWNER_REQUIRED]` and Filipe’s Serious decision — not a routine A/B authorization.

**Mixed-row rule:** No inventory row may be labeled `A/B`, `B/C`, or “B with C-adjacent note.” Split into atomic rows. Do not invent new RF IDs.

---

## 1. Completed baseline (on this tip)

Current `main` tip `007b4b44ae24504d30d66a295f7502898a3400b9` includes Stages 0–6b, authorized 6c-B1…B6, and Issue #18 packaging. Merge SHAs below are the merge commits on `main`.

### Recovery Stages 0–6b

| Stage | Issue | PR | Merge SHA | What landed |
| --- | --- | --- | --- | --- |
| **0** — evidence freeze | [#24](https://github.com/lotustemplar/peptide-calculator-v2/issues/24) | [#25](https://github.com/lotustemplar/peptide-calculator-v2/pull/25) | `9ee70a878aec1cefb85911e55e248184483a682b` | Sanitized hashes / allowlist / scan / formula-fork record. No runtime change. |
| **1** — product direction | [#2](https://github.com/lotustemplar/peptide-calculator-v2/issues/2) | *(decision, no code PR)* | comment [5595858549](https://github.com/lotustemplar/peptide-calculator-v2/issues/2#issuecomment-5595858549) | Filipe: baseline UI/IA on GitHub’s tested CI / OCC / Taken-Undo spine. Refine; do not replace the product. |
| **2** — chrome / assets | [#26](https://github.com/lotustemplar/peptide-calculator-v2/issues/26) | [#27](https://github.com/lotustemplar/peptide-calculator-v2/pull/27) | `ac45e98dec936b1f334ff0a99dc5d1b8ca11027b` | Baseline-derived chrome tokens + scanned PNG icons. Calc/persist/reminders untouched. |
| **3** — schema + import | [#28](https://github.com/lotustemplar/peptide-calculator-v2/issues/28) | [#29](https://github.com/lotustemplar/peptide-calculator-v2/pull/29) | `7cf83791b12cd7811c996cc3040fda95a6263c95` | Both-generation schema map + import safety. Never mutate/delete `fitgen-peptide-rebuild-v1`. |
| **4** — nav / UI shell | [#30](https://github.com/lotustemplar/peptide-calculator-v2/issues/30) | [#31](https://github.com/lotustemplar/peptide-calculator-v2/pull/31) | `5531fe131365008a2bfe5c2ec682dafbe062ed40` | Hero + tabbar IA; existing P0 Back/Cancel/Taken/Undo wired. No Mark missed. |
| **5** — names + safe chips | [#32](https://github.com/lotustemplar/peptide-calculator-v2/issues/32) | [#33](https://github.com/lotustemplar/peptide-calculator-v2/pull/33) | `47222436846dacd5731a4b8a1414d76cf8697ea7` | MED-FLAG names + Custom/recent/Unknown only. `escalate-Serious` chip families **not shipped**. |
| **6a** — orphan `*-fix.js` | [#34](https://github.com/lotustemplar/peptide-calculator-v2/issues/34) | [#35](https://github.com/lotustemplar/peptide-calculator-v2/pull/35) | `2e31c5f397ee1ff9f8227761354a231c4bf67899` | Unused unloaded patches retired. |
| **6b.1** — export-fix | #34 | [#36](https://github.com/lotustemplar/peptide-calculator-v2/pull/36) | `9a3f7754c1c336d41b711750ede1b51d189347c5` | Superseded export overlay retired. |
| **6b.2** — mobile-polish | #34 | [#37](https://github.com/lotustemplar/peptide-calculator-v2/pull/37) | `53d1016cb1cae9dfc7860445a31f73d7e2fc69b9` | Live mobile polish absorbed into `src/` + bind. |
| **6b.3** — ui-polish | #34 | [#38](https://github.com/lotustemplar/peptide-calculator-v2/pull/38) | `c575fce9b08f1bd6f01e246f89293dd74bb31246` | Accordion + Due Today banner removal. Reminder stubs **not** ported. |
| **6b.4** — native-backup | #34 | [#39](https://github.com/lotustemplar/peptide-calculator-v2/pull/39) | `d923fa9f28455237f08189676a8f5e2fabc6f979` | Native backup overlay retired; Stage 3 bind owns export. |

P0 spine already on `main` before Stage 0 (Stage-1 direction retains it): P0.0 CI ([#8](https://github.com/lotustemplar/peptide-calculator-v2/pull/8) `3c600b975e3ada97b451b17cbeafdb9db9c6a936`), P0.1 goldens ([#10](https://github.com/lotustemplar/peptide-calculator-v2/pull/10) `808230b5209db20cd5232a2af2cb397330170654`), typed ESLint ([#11](https://github.com/lotustemplar/peptide-calculator-v2/pull/11) `4efce68e7e037763e459b31763e94e25d146b25f`), P0.6 MED-FLAG copy ([#13](https://github.com/lotustemplar/peptide-calculator-v2/pull/13) `028c6948f592174a921773d655012fa86d41012a`), P0.OCC ([#16](https://github.com/lotustemplar/peptide-calculator-v2/pull/16) `591deafc0b2b95ddafb74f51d0d06fe2460e18aa`), P0.UX Taken/Undo ([#21](https://github.com/lotustemplar/peptide-calculator-v2/pull/21) `270e0eb8730fb95b650e911463affddae223d655`).

### Stage 6c inventory + authorized B1…B6

| Slice | RF IDs | PR | Merge SHA | Status |
| --- | --- | --- | --- | --- |
| 6c inventory Spec v2 | map only | [#41](https://github.com/lotustemplar/peptide-calculator-v2/pull/41) | `9e0286c409aab13e6b1c06fede0cfc76d75ebdf4` | Binding A/B/C IDs on `main` |
| **6c-B1** | RF-B-003 | [#43](https://github.com/lotustemplar/peptide-calculator-v2/pull/43) | `14b970fed5afdf6eeb6adc40f2bf62e7045eb17b` | **Done** — CSS injector → `styles.css` |
| **6c-B2** | RF-A-003 only | [#44](https://github.com/lotustemplar/peptide-calculator-v2/pull/44) | `3b6025e1962ed5f19bce0a1f7fefbbebc8c498b9` | **Done** — Cabinet Edit/Delete bubble listeners deleted after fail-closed proof. **RF-A-001 / RF-A-004 / RF-A-005 left unproven.** |
| **6c-B3** | RF-B-017 / RF-B-018 | [#45](https://github.com/lotustemplar/peptide-calculator-v2/pull/45) | `4faba60c9f5b71c6f5be86a23f4aa3d489e32f4d` | **Done** — Bridge `setView` / `closeSaveModal` chrome only. RF-C-021…023 not moved. |
| **6c-B4** | RF-B-016 | [#46](https://github.com/lotustemplar/peptide-calculator-v2/pull/46) | `122ff7f670d43a62c2530721c67597c6e952bd10` | **Done** — tabs/view chrome |
| **6c-B5** | RF-B-010 | [#47](https://github.com/lotustemplar/peptide-calculator-v2/pull/47) | `ef0c8f161f4924313d37602b103d2cfe787e583d` | **Done** — Cabinet shell stop-last-write; RF-C-015 fields frozen |
| **6c-B6** | RF-B-011 / RF-B-012 | [#48](https://github.com/lotustemplar/peptide-calculator-v2/pull/48) | `9a38e9394b2820d01db97e4e55f9754f69092f05` | **Done** — schedule/calendar chrome + banner-at-source; RF-C-016/017 frozen |

Issue [#34](https://github.com/lotustemplar/peptide-calculator-v2/issues/34) stays open for residual 6c A/B/C. `runtime-fixes.js` stays loaded and allowlisted.

### Issue #18 packaging (PR #23)

| Slice | Issue | PR | Authorized tip | Merge SHA | Status |
| --- | --- | --- | --- | --- | --- |
| Actions-artifact internal-test APK | [#18](https://github.com/lotustemplar/peptide-calculator-v2/issues/18) | [#23](https://github.com/lotustemplar/peptide-calculator-v2/pull/23) | `bdbc497bc73f32152d0fd49fad81983c973b831b` | `007b4b44ae24504d30d66a295f7502898a3400b9` | **Done** — Capacitor Android debug/internal-test APK as a GitHub Actions artifact. Issue #18 closed. |

**RF-X-003** (packaging) is complete for the authorized Actions-artifact slice only. Play / submit-ready / GitHub Release / signing-for-store remain **OFF** (owner-only). See §4.

---

## 2. Residual Stage 6c A/B rows still open after B6

Source: `docs/recovery/stage-6c-inventory-spec-v2.md`. B1–B6 are **done**. The rows below are still **candidate** routine/elevated slices. **None are authorized** by this inventory PR.

Prerequisites that apply to **every** residual A/B row:

1. Fresh characterization on current `main` (`007b4b44…`) — load order, live callers, and 6c-B1…B6 ownership changes can invalidate older notes.
2. Fail-closed tests before delete (A) or absorb (B).
3. **B→C isolation rule** (above). Do not call / move / wrap / alter a C function except through an unchanged characterized interface.
4. One named `[CODEX] [NEXT_STAGE_AUTHORIZED]` per slice after Codex accepts this map.
5. `runtime-fixes.js` remains loaded + allowlisted unless that named slice is explicitly authorized to retire a proven-dead owner.

### Remaining B candidates

| ID | Behavior | Bucket | Prerequisites / isolation |
| --- | --- | --- | --- |
| RF-B-001 | Storage key **map literals only** (no write behavior) | **B** | Keys already shared with Stage 3; no rebuild key. Must not add write/sync behavior (that is RF-C-004 / RF-C-005). |
| RF-B-002 | IIFE DOM boot/guard (early return if nodes missing) | **B** | Glue only. Must not pull C renderers or reminder timers into the boot body. |
| RF-B-004 | `hideLegacyScheduleEditor` **live hide call** | **B** | Codex #1: not A until proven dead. Stay B until RF-A-001 characterization. |
| RF-B-005 | `persistState` / bridge path that calls **existing** `commitAppState` / `readAppState` with parity tests | **B** | Envelope plumbing only. **Must not** invoke `syncRemindersToBackend` (RF-C-004) or revive legacy raw mirrors (RF-C-005). |
| RF-B-006 | Generic `escapeHtml`, date-key parse/format **without** dose semantics | **B** | Must not absorb `formatNumber` / `formatMl` / `formatDrawMl` / `formatDose` (RF-C-006). |
| RF-B-007 | Notification **label/class-only** rendering that does **not** call RF-C-009…011 | **B** | Only if split behind an unchanged interface; else stays C. Must not touch timers, permission steal, or daily prompt. |
| RF-B-008 | Pure `normalizeSchedule` field shaping **with zero due/taken rule change** | **B** | After live-path characterization. Must not change `isScheduleDueOnDate` / `getNextDue` / `isTakenToday` (RF-C-012). |
| RF-B-009 | Visual label/class rendering for schedule tab badge **only**, calling due-count via **unchanged** characterized interface | **B** | Must not embed RF-C-012 or RF-C-011. Due-count computation stays RF-C-014. |
| RF-B-013 | `renderAllFallback` **API shell** that only dispatches to already-split owners | **B** | **Only after** C renderers/timers are not invoked from this function body. Current whole-fn body is RF-C-018 until then. |
| RF-B-014 | Adapter delegation plumbing to `FitGenP0UxBind.adapter().markTaken` | **B** | No rule change. Must not touch legacy `takenDates` mutation (RF-C-019). |
| RF-B-015 | Modal open/close/cancel chrome only | **B** | Must not show/create dose/draw/water from `pendingOption` or call backend sync (RF-C-020 / RF-C-023). |

RF-B-003, RF-B-010, RF-B-011, RF-B-012, RF-B-016, RF-B-017, and RF-B-018 are **done** (B1 / B5 / B6 / B4 / B3).

### Remaining A candidates

| ID | Behavior | Bucket | Prerequisites / isolation |
| --- | --- | --- | --- |
| RF-A-001 | Proven-dead branch of schedule-form hide **if** characterization shows CSS-only ownership and RF call is no-op | **A** | Depends on RF-B-004 remaining live until proven. B2 explicitly left this **unproven**. |
| RF-A-002 | Proven-dead pure helpers with no live callers | **A** | After characterization only. Do not delete helpers that still feed RF-C-012 / RF-C-006. |
| RF-A-004 | Delete legacy `takenDates` branch **only after** RF-C-019 proven unreachable | **A** | Blocked on RF-C-019 (Serious). B2 left this **unproven**. Not a routine delete until C proof exists. |
| RF-A-005 | Save-form capture / `saveFallbackFill` **only if** event-order tests prove bind always wins and RF path unreachable | **A** | Default stays RF-C-020 until proven. B2 left this **unproven**. |

RF-A-003 is **done** (6c-B2).

### Absent / already owned (not residual A/B work)

| ID | Behavior | Notes |
| --- | --- | --- |
| RF-X-001 | Export/import/native backup | **A absent.** Owned by Stage 3 + 6b.1 / 6b.4. Not a Stage 7 implement slice. |
| RF-X-002 | Mark missed | Stage 7 **product residual** — Serious / owner-only. See §4. Unauthorized. |
| RF-X-003 | Packaging | Issue #18 / PR #23 Actions-artifact APK **landed**. Play/submit-ready remains owner-only OFF. See §4. |

---

## 3. All RF-C-* — Serious / owner-only

Every RF-C-* row is **Serious / owner-only**. Each requires `[CODEX] [OWNER_REQUIRED]` and Filipe’s Serious decision. **Never bundle with a routine or elevated A/B slice.** IDs are unchanged from Spec v2.

| ID | Behavior | Owner gate |
| --- | --- | --- |
| RF-C-001 | Formula constants (`MIN_DRAW_ML=0.1`, abs min 0.05, step, limit 18, default max water). Diverges from frozen `app.js`. | `[OWNER_REQUIRED]` / Filipe — formula fork DEC |
| RF-C-002 | `getPushExternalIdForSync` | `[OWNER_REQUIRED]` / Filipe — push/backend identity |
| RF-C-003 | `syncRemindersToBackend` POST `/reminders/sync` (incl. dose fields) | `[OWNER_REQUIRED]` / Filipe — DEC-REM / health payload |
| RF-C-004 | Any `persistState` path that **invokes** `syncRemindersToBackend` | `[OWNER_REQUIRED]` / Filipe — must not ride inside RF-B-005 |
| RF-C-005 | Legacy raw mirror `writeFills`/`writeSchedules` when envelope path absent/bypassable | `[OWNER_REQUIRED]` / Filipe — until proven unreachable |
| RF-C-006 | `formatNumber` / `formatMl` / `formatDrawMl` / `formatDose` (rounding + unit/draw presentation) | `[OWNER_REQUIRED]` / Filipe — Serious presentation |
| RF-C-007 | `getInputs`, builders, `scoreOption`, `computeOptions`, result grid render, form capture recompute | `[OWNER_REQUIRED]` / Filipe — live RF ≠ `app.js` |
| RF-C-008 | Water-line / draw guidance / precision copy strings | `[OWNER_REQUIRED]` / Filipe — dose-presentation |
| RF-C-009 | `fireBrowserNotification`, `getNextPendingReminder`, `queueUpcomingBrowserReminder` timers | `[OWNER_REQUIRED]` / Filipe — DEC-REM |
| RF-C-010 | Notification permission capture steal + status copy that gates prompts | `[OWNER_REQUIRED]` / Filipe |
| RF-C-011 | `maybeShowDailyBrowserPrompt` + daily-prompt LS | `[OWNER_REQUIRED]` / Filipe — DEC-REM |
| RF-C-012 | `isScheduleDueOnDate`, `getNextDue`, `isTakenToday`, due filtering in `getTodayDueSchedules` | `[OWNER_REQUIRED]` / Filipe — occurrence/reminder semantics |
| RF-C-013 | `getFillUsage` remaining amount/volume, doses-left, reorder≤4 threshold/copy | `[OWNER_REQUIRED]` / Filipe — medical-adjacent |
| RF-C-014 | Due-count computation + any call to `maybeShowDailyBrowserPrompt` from indicator path | `[OWNER_REQUIRED]` / Filipe |
| RF-C-015 | Cabinet fields: next-dose text, dose/draw/frequency, water-line, usage/reorder presentation | `[OWNER_REQUIRED]` / Filipe |
| RF-C-016 | Due/taken pills, next-due text, dose/draw/frequency copy, Mark Taken/Undo eligibility wiring semantics | `[OWNER_REQUIRED]` / Filipe |
| RF-C-017 | Calendar schedule semantics (next-due computation display rules) | `[OWNER_REQUIRED]` / Filipe |
| RF-C-018 | Current `renderAllFallback` body that calls C renderers + notification render + `queueUpcomingBrowserReminder` | `[OWNER_REQUIRED]` / Filipe — whole fn **C** until dependencies separated |
| RF-C-019 | Legacy `takenDates` mutation branch | `[OWNER_REQUIRED]` / Filipe — until fail-closed tests prove unreachable |
| RF-C-020 | Showing dose/draw/water from `pendingOption`; creating fill/schedule dose fields; legacy mirror writes; calling backend sync on save | `[OWNER_REQUIRED]` / Filipe |
| RF-C-021 | Bridge `persistAndRender` while it reaches backend sync / C persist | `[OWNER_REQUIRED]` / Filipe |
| RF-C-022 | Bridge `renderAll` while it reaches reminder timers / C dose renderers | `[OWNER_REQUIRED]` / Filipe |
| RF-C-023 | Bridge `getPendingOption` / save-modal coupling to RF-C-020 | `[OWNER_REQUIRED]` / Filipe |

---

## 4. Stage 7 product residuals

Non-exhaustive starters named by the binding Issue #50 Spec. These are **not** authorized here. Every Serious item is marked owner-only and must not be bundled with routine work.

| Residual | Existing ID / DEC | Class | Notes |
| --- | --- | --- | --- |
| Mark missed | **RF-X-002** / `REQ-MISSED` | **Serious / owner-only** | Baseline rebuild has a missed model; GitHub `main` quarantines `histories[] status=missed` (Stage 3) and has no Mark missed action (Stage 4/5/6c tests lock this). Implementing missed/skipped/snoozed/reschedule semantics is a Serious calendar/dose-state DEC. Unauthorized. |
| Wizard starting values | **DEC-DEFAULTS** | **Serious / owner-only** | Characterized wizard `<select>` / `<input value="…">` starting values (`mg`, `30`, `3`, `1`, `3`) are **not** chips and stay frozen. Changing them is a Serious DEC. Stage 5 residual: [CHIP_INVENTORY.md](../evidence/stage-5-chips/CHIP_INVENTORY.md). |
| Stage 5 escalate-Serious chip families | `escalate-Serious` rows in CHIP_INVENTORY | **Serious / owner-only** | Vial amount; BAC water / max water; syringe size; unit label; planned dose; medication dose; frequency/interval; route; save-fill interval; result ranking / “Easiest to measure” as a selectable default. Recent-user source does **not** make them safe. Re-inventory required before any ship. Also `out-of-stage-5`: static `PEPTIDE_LIST` name chips; reminder-time chips; DEC-NORM-REMOTE. |
| Formula fork | formula fork DEC / **DEC-FORMULA** / P0.2 | **Serious / owner-only** | Draw-first baseline rebuild vs water-first GitHub `app.js`, plus RF-C-001/007 divergence from frozen `app.js`. Recorded in [DIFF_SUMMARY.md](../evidence/baseline-rar-2026-08-16/DIFF_SUMMARY.md). Do not “fix” either path without Filipe. Goldens lock current `main` outputs; they are not clinical truth. |
| Reminder architecture | **DEC-REM** | **Serious / owner-only** | Web timers + permission steal + daily prompt + backend `/reminders/sync` + push identity (RF-C-002/003/009…011/014/018/022). Production reminders were out of M1 and out of Issue #18. No architecture revision without Filipe. |
| Play / submit-ready packaging | RF-X-003 follow-on | **Serious / owner-only** | Actions-artifact internal-test APK **already landed** (PR #23 / merge `007b4b44…`). Google Play, store listing, signing-for-release, GitHub Release, deploy, and production publish stay **OFF**. Separate owner track. Not bundled with residual 6c A/B. |

### Adjacent open gates (not invented IDs)

| Gate | Class | Notes |
| --- | --- | --- |
| Issue [#22](https://github.com/lotustemplar/peptide-calculator-v2/issues/22) P0.3 leftovers | Elevated (existing issue) | Still OPEN after Stage 3 import-safety. Any still-unmet FR-PERS / FR-IMP / FR-EXP rows need **fresh characterization** against this tip before a named CLAIM. This inventory does **not** authorize that CLAIM and does not invent leftover IDs. |
| Issue [#34](https://github.com/lotustemplar/peptide-calculator-v2/issues/34) | Tracker | Residual 6c A/B/C live here until separately authorized. Do not close #34 from this PR. |

---

## 5. Spec v1.2 / Issue #2 / draft PR #3 — separate open gate

| Object | Status | Why it stays separate |
| --- | --- | --- |
| Product Specification **v1.2** | Filipe approved as controlled implementation baseline (Option A) — Issue #2 comment [5590169938](https://github.com/lotustemplar/peptide-calculator-v2/issues/2#issuecomment-5590169938) | Binding product requirements (requirement IDs, Given/When/Then, Serious DEC-* list). |
| Issue [#2](https://github.com/lotustemplar/peptide-calculator-v2/issues/2) | **OPEN** (process / discovery home) | Auto-closed twice by docs PRs that used close-keyword phrasing; reopened. Do **not** use `Closes #2` from this PR. |
| Draft PR [#3](https://github.com/lotustemplar/peptide-calculator-v2/pull/3) | **OPEN draft** (`grok/2-spec-v1-docs`) — `docs: Product Spec v1.2 + Codex response matrix` | Spec v1.2 repo copy + Codex response matrix. **Not merged.** Docs merge of #3 is a separate routine docs gate and is **not** this Stage 7 inventory PR. |

This Stage 7 inventory **does not** absorb, amend, or merge Spec v1.2. DEC-DEFAULTS was already recorded as an open Serious item in the v1.2 amendment and is restated in §4. Draft PR #3 remains the Spec-document vehicle.

---

## 6. Recommended order (routine / elevated only — **not authorized**)

Recommended **A/B** order only. Still **not authorized** by this inventory PR. After Codex accepts this map, a named routine/elevated slice may start only when Codex posts `[CODEX] [NEXT_STAGE_AUTHORIZED]` for that **one** slice (prerequisites, risk, dependencies, characterization/tests, and scope checked).

Do **not** start a Stage 7 implement CLAIM from this list.

1. **RF-B-001** — storage key map literals only (no writes).
2. **RF-B-006** — generic `escapeHtml` / date-key helpers without dose semantics.
3. **RF-B-002** — IIFE DOM boot/guard (glue; no C renderers/timers).
4. **RF-B-015** — save-fill modal open/close/cancel chrome only.
5. **RF-B-004** — live `hideLegacyScheduleEditor` (stay B). Then **RF-A-001** only if fail-closed tests prove the RF call is a no-op.
6. **RF-B-008** — `normalizeSchedule` field shaping after live-path characterization (zero due/taken rule change).
7. **RF-B-009** — schedule tab badge label/class only, via unchanged due-count interface.
8. **RF-B-007** — notification label/class-only **iff** already split behind an unchanged interface; otherwise leave with RF-C-009…011.
9. **RF-B-014** — `markTaken` adapter delegation plumbing (no rule change).
10. **RF-B-005** — persist/bridge envelope plumbing to existing `commitAppState` / `readAppState` only (exclude RF-C-004 / RF-C-005).
11. **RF-A-002** — proven-dead pure helpers, after characterization.
12. **RF-B-013** — `renderAllFallback` API shell **only after** RF-C-018 body no longer invokes C renderers/timers (that split is itself C / owner-only).
13. **RF-A-004** / **RF-A-005** — only after RF-C-019 / RF-C-020 are proven unreachable (Serious proof first; not routine by default).

**Stop.** All RF-C-* and §4 Serious residuals remain owner-only. Spec v1.2 / draft PR #3 stays a separate docs gate. Play/submit-ready stays OFF.

Issue #22 (P0.3 leftovers) is **not** placed in this order: it needs a fresh leftover inventory against this tip before anyone names a slice.

---

## 7. What this PR is not

- Not a Stage 7 implement CLAIM
- Not merge authorization
- Not packaging / Play / deploy / production release
- Not a formula, defaults, reminder, privacy, or Mark missed change
- Not an amendment of Spec v1.2 and not a close of Issue #2, #22, #34, or #50

## Next owner

**Codex** — `[CODEX] [REVIEW]` **inventory Spec only** (this document + Issue #50 comment 5648976068). Challenge any remaining mixed coupling or any Serious item that is not labeled owner-only.

Decision requested from this inventory handoff: **`APPROVED` only**. No `[MERGE_AUTHORIZED]`, no `[NEXT_STAGE_AUTHORIZED]` for an implement slice, and no implement CLAIM.

A/B implementation remains unauthorized until a later `[CODEX] [NEXT_STAGE_AUTHORIZED]` names one slice. RF-C-* and §4 Serious residuals remain blocked pending `[CODEX] [OWNER_REQUIRED]` and Filipe’s Serious decision.
