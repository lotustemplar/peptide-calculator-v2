# FitGen Product Specification v1.1

## 1. Document control

| Field | Value |
| --- | --- |
| **Title** | FitGen (peptide-calculator-v2) Product Specification v1.1 |
| **Date** | 2026-09-08 |
| **Issue** | [#2](https://github.com/lotustemplar/peptide-calculator-v2/issues/2) |
| **Evidence SHA** | `4741e6f227676ff5c0f511edf173ecc03bc298df` (`main`) |
| **Authors** | **Atlas** consolidates; sources: **Mira** (UX), **Sage** (architecture), **Sentinel** (QA/security), **Aegis** (med-safety), **CoS** (discovery inventory) |
| **Status** | Revised for Codex re-review |
| **Spec revision** | **v1.1** (resolves Codex blocking findings 1–8 on Spec v1) |
| **Prior gist rev (Codex-reviewed)** | `7963e44e0ee0757c13f51d554250db2aa8e46b2b` |
| **Current gist rev (v1.1)** | `4a801d7702857203161960f7fd6691013ffa431b` |
| **Mode** | Read-only discovery synthesis — markdown under `/workspace/fitgen-issue2/` only; **no** application code, git remotes, or GitHub mutations from this deliverable |

**Versioning notes**

- Spec **v1** (gist rev `7963e44…`) was reviewed by Codex with **changes requested** (`CODEX_REVIEW_SPEC_V1.md`).
- Spec **v1.1** addresses all eight blocking findings via new/changed requirement IDs (see `CODEX_RESPONSE_MATRIX.md`).
- After Codex re-approval, the approved specification should become a versioned repository artifact under `docs/` (docs-only PR; no application-code changes). Gist: https://gist.github.com/lotustemplar/6b7c927411da24208219cd1dba53e599 (rev `4a801d7702857203161960f7fd6691013ffa431b`).

**How to read tags**

| Tag | Meaning |
| --- | --- |
| **FACT** | Confirmed in repo at evidence SHA (or Mira §10 runtime wiring) |
| **REQ** | Product requirement in this Spec (stable ID) |
| **HYP** | Plausible but not executed / not decided |

**Field lifecycle marks** (Canonical data model §6)

| Mark | Meaning |
| --- | --- |
| **authoritative** | Source of truth; writers must persist |
| **derived** | Computed from authoritative fields; may be recomputed |
| **optional** | May be absent; consumers must tolerate null/missing |
| **migrated** | Introduced by schema migration; dual-read until cutover |
| **prohibited from leaving device** | Must not leave the device without a **Serious** decision (DEC-REM / DEC-NORM-REMOTE / DEC-CLOUD / encryption) |

---

## 2. Product intent

FitGen is a **planner and measurement calculator** for **user-entered** peptide reconstitutions and schedules.

### 2.1 Intended user

**Intended user:** a person managing **their own** reconstitution and draw planning (self-managed measurement planner). FitGen is **not** clinician CDS, not a pharmacist tool, and not a care-team product.

### 2.2 Supported platform matrix (v1 baseline)

| Surface | Spec v1.1 status |
| --- | --- |
| **Static web app** (current SPA as served) | **Supported baseline** — primary characterization and test target |
| **Median-wrapped Android** APK (as investigated at evidence SHA) | **Supported investigated target** — file export/import, install, offline, and permission AC judged against this path when native bridges are present |
| **iOS** (native or wrapper) | **Unsupported / uncommitted** unless separately approved |
| Cloud / backend reminder DB | **Not promised** until **DEC-REM** / **DEC-CLOUD** |
| Reminder delivery paths (web foreground, native APK, server push) | **Final platform reminder promise tied to DEC-REM** — do **not** imply all reminder paths are supported in v1 |

Acceptance criteria for notification, file export/import, install, offline, and permission flows must state which of the supported surfaces they apply to. Forge must not treat “native” or “iOS” as in-scope without an explicit decision.

### 2.3 Helps users

- Record vial contents, a dose **they already decided outside the app**, syringe/BAC ceilings
- Compare **water / draw / concentration / (optional U-100 mark)** options for **measurement ease and vial fit**
- Save fills, manage a cabinet, plan schedules, and (when a reminder port is chosen via **DEC-REM**) get on-device or consented reminders

### 2.4 FitGen is not

- A clinician, pharmacist, or care team
- A source of therapeutic dose recommendations, titration, injection technique, or stack advice
- An interaction / allergy / duplicate-therapy / organ-impairment screening product **in the near term** (Aegis posture **B**)

All ranking and copy use **measurement framing** (“easiest to measure”, “vial fit limit”), never clinical recommendation language.

---

## 3. Facts vs hypotheses

### 3.1 Top CONFIRMED defects

| ID | Defect (FACT) | Primary sources |
| --- | --- | --- |
| **C1** | Two calculators in one load: `app.js` water-step / min-draw **0.05** / 12 cards on first paint; live Generate captured by `runtime-fixes.js` draw-target / min-draw **0.10** / 18 cards | `SAGE_AUDIT_FULL.md` C1; `SAGE_AUDIT_SUMMARY.md`; `COS_DISCOVERY_INVENTORY.md` #5; Sentinel §2 |
| **C2** | Draw-target path stores `waterMl.toFixed(2)` but concentration from **unrounded** water | Sage C2; Sentinel math matrix |
| **C3** | Reminder/sync globals armed then **no-op’d**; native reminder scripts **not loaded**; Schedule copy contradicts runtime | Sage C3; Mira §10.3; CoS #2/#4 |
| **C4** | Backend parses datetimes as UTC (`…Z`); frontend local; DST-unsafe `DAY_MS`; default start date via UTC `toISOString` | Sage C4; Sentinel §3; CoS #6 |
| **C5** | Import merge-skip-by-id, unversioned, non-atomic, no preview | Sage C5; Sentinel §4; CoS #7 |
| **C6** | Native export `{ok:false}` still blocks web fallback | Sage C6 |
| **C7** | Dual writers to same `localStorage` keys; `window.state` ≠ lexical `state` | Sage C7 |
| **C8** | Cabinet/schedule/calendar rendered twice with different models | Sage C8; Sentinel smoke journeys |
| **C9** | Taken-count fallback invents history when `takenDates` absent | Sage C9 |
| **C10** | `setupOneSignalPlayerIdCapture` never called; `playerId` vs `subscriptionId` mismatch | Sage C10; CoS #4; Sentinel §3 |
| **C11** | Unauthenticated backend: open CORS, `/reminders/sync`, `/test-push`, `/debug/:userId` | Sage C11/S1–S3; CoS #1; Sentinel §5 |
| **C12** | `mg`/`IU` labels only; **no mcg**; U-100 assumed (`doseMl*100`) unconditionally | Sage C12; Mira FACT; Sentinel §2 |
| **C13** | No tests, no lockfiles; CI is keep-alive ping only | Sage C13; Sentinel §6–§7; CoS #8 |
| **C14** | Dead UI: missing `#peptide-suggestions`; meds card hidden; theme hidden | Sage C14; Mira §10.1–§10.2 |
| **Mira §10** | Name **chips** file unloaded; live name UX is weak dropdown; Reset does not return to step 1; edit-fill overlay largely unwired | `MIRA_UX_SPEC_V1.md` §10 (authoritative over earlier “chips active” implications) |
| **UX gaps** | No wizard Cancel; Next does not validate; results badge **“Recommended”** (MED-FLAG); Delete often without confirm (path-dependent); Taken only — no Skip/Snooze/Undo/occurrence|series | Mira §1; Sentinel journeys |
| **Med-safety gap** | No RxCUI, unknown-state, provenance, or DDI engine; free-text + `PEPTIDE_LIST` with research names treated as equal suggestions | Aegis brief; Sentinel §5.1; handoff |
| **Defaults FACT** | First-run HTML defaults `value="30"` / `value="3"` (and related 1/3 syringe/BAC) — live production characterization only; **not** approved Spec target (see **DEC-DEFAULTS**) | Sentinel §1; Codex finding 4 |

### 3.2 HYPOTHESIS items (not treated as proven bugs)

| ID | Hypothesis | Sources |
| --- | --- | --- |
| H1 | Web `setTimeout` reminders silent when tab/APK backgrounded | Sage H1; CoS H1; Sentinel |
| H2 | Duplicate alerts if unloaded native scripts re-added alongside web/backend | Sage H2; CoS |
| H3 | Mark-taken dual paths desync `state` vs storage | Sage H3 |
| H4 | Edit-fill overwrites **all** linked schedules | Sage H4; Sentinel Edit journey |
| H5 | OneSignal 26-occurrence horizon then silence | Sage H5 |
| H6 | Render spin-down / process death vs keep-alive narrative | Sage H6 |
| H7 | Shared-device localStorage / export disclosure | Sage H7; Sentinel threat model |
| H8 | XSS if `fill-name-suggestions-fix.js` re-enabled (`innerHTML`) | Sage H8; CoS option.guidance XSS theme |
| — | Cold-start races; medical/regulatory **perception** risk from MED-FLAG copy | CoS H1–H5 |

---

## 4. Architecture decision (ADR)

**Decision:** Incremental **TypeScript / ES modules** behind the existing **DOM / CSS**. **Reject** a React/Vue/Svelte (or similar) framework rewrite for Spec v1.1.

**Citation:** Sage `SAGE_AUDIT_FULL.md` §4; `SAGE_AUDIT_SUMMARY.md` ADR; aligns with AGENTS.md (no new `*-fix.js`, preserve visual identity).

| | A. Incremental modules (**adopt**) | B. Framework rewrite (**reject**) | C. More `*-fix.js` (**forbidden**) |
| --- | --- | --- | --- |
| UI identity | Preserved | High reset risk | Preserved but chaotic |
| Defect pattern fit | Fixes duplicated logic | Delays P0 | Deepens last-write-wins |
| Testability | Pure cores first | After rewrite cost | Near-zero |
| Policy | Matches AGENTS.md | Serious Filipe gate | Explicitly forbidden |

**Rollback notes (Sage §4):**

1. Keep `app.js` until last consumer gone; do not delete in first extraction PR
2. Feature-flag via `index.html` script tags; fallback to classic stack
3. Tag `pre-modules` on `main` before first extraction merge
4. localStorage keys unchanged in early P0; additive `schemaVersion` with dual-read

**Safe default while waiting:** no framework app; no new `*-fix.js`; next implementation after Spec approval starts at characterization tests + CI/lockfiles (P0.0 / P0.1).

---

## 5. Hard constraints / non-goals

| Constraint | Source |
| --- | --- |
| **No** therapeutic dose recommendations, titration, injection technique, or peptide-stack advice | Product intent; Aegis hard constraints; Mira principles |
| **No** interaction screening, allergy engines, duplicate-therapy, or DDI severity **near-term** (posture **B**) | Aegis §9; handoff; Sentinel §5.1 |
| **Never** infer safety from missing data; **unknown-state is mandatory** | Aegis §4/§6; Sentinel rule 1 |
| **No** new `*-fix.js` | AGENTS.md; Sage; CoS |
| **No** merge to `main` / deploy from discovery | Issue #2 discovery mode; Sage handoff |
| **Preserve** visual identity (dark theme, Sora/IBM Plex, teal/gold, card/tabbar) | Mira; AGENTS.md |
| **Do not** encode clinical DDI/allergy/dose rules as implementable product behavior in this Spec | Aegis; this Spec |
| Prefer **measurement framing** in all user-visible ranking and reminders copy | Mira; Aegis §7; Sentinel MED-FLAG |
| **Do not** ship mg↔mcg conversion or invent IU↔mass conversion until **DEC-UNIT** | Codex finding 3; FR-UNIT-001 |
| **Do not** show U-100 “units” marks unless U-100 syringe calibration is explicitly selected (**DEC-SYRINGE** / FR-SYRINGE-001) | Codex finding 3 |
| **Do not** approve live first-run 30/3/1/3 as Spec target (**DEC-DEFAULTS**) | Codex finding 4 |
| Reminder / leave-device promises only after **DEC-REM** (and **DEC-CLOUD** / **DEC-NORM-REMOTE** as applicable) | Codex findings 5, 7 |

---

## 6. Canonical data model

Plain-language + typed-contract fields Forge must implement against. Marks: **authoritative** | **derived** | **optional** | **migrated** | **prohibited from leaving device** (without Serious decision).

### 6.1 BackupEnvelope

Top-level export/import document.

| Field | Type (contract) | Marks | Notes |
| --- | --- | --- | --- |
| `schemaVersion` | `number` (integer ≥ 1; target additive ≥ 3) | authoritative | Gates migrations; dual-read during cutover |
| `exportedAt` | `string` (ISO-8601 timestamp) | authoritative | Wall-clock of export |
| `userId` | `string \| null` | optional; **prohibited from leaving device** without Serious | Prefer omit; if present, treat as install-local opaque id |
| `entities` | `BackupEntities` | authoritative | Bundle of fills, schedules/occurrences, settings, notification port state, med identities |

```text
BackupEnvelope = {
  schemaVersion: number,          // authoritative
  exportedAt: string,             // authoritative ISO-8601
  userId?: string | null,         // optional; prohibited off-device w/o Serious
  entities: BackupEntities        // authoritative
}
BackupEntities = {
  fills: FillRecord[],
  schedules: ScheduleSeries[],
  occurrences: OccurrenceRecord[],  // P0 minimal set per FR-SCH-000
  medications?: MedicationIdentity[], // optional until Spec B UI
  settings: SettingsRecord,
  notificationPort?: NotificationPortState  // optional until DEC-REM
}
```

**Deletion / lifecycle:** Export is a snapshot. Import never mutates until after validate+preview and user confirm (FR-IMP-002). Replace All requires pre-import recovery snapshot (FR-IMP-003).

### 6.2 Fill / reconstitution record (`FillRecord`)

| Field | Type | Marks | Notes |
| --- | --- | --- | --- |
| `id` | `string` (stable UUID) | authoritative | Stable across export/import |
| `displayName` | `string` | authoritative | User-entered peptide/fill name |
| `medicationId` | `string \| null` | optional; migrated | Link to MedicationIdentity when Spec B ships |
| `vialAmount` | `number` (finite > 0) | authoritative | Same shared unit as desired dose (FR-UNIT-001) |
| `desiredDose` | `number` (finite > 0) **or** empty at first-run per DEC-DEFAULTS | authoritative | Therapeutic amount is user-owned |
| `unit` | `"mg" \| "mcg" \| "IU"` | authoritative | **Single shared unit** for vialAmount and desiredDose (Spec recommendation) |
| `waterMl` | `number` | authoritative | Selected reconstitution water |
| `drawMl` | `number` | derived or authoritative once saved | Must match displayed rounding policy after DEC-FORMULA |
| `concentration` | `number` | derived | From vial/water under approved formula |
| `syringeCapacityMl` | `number` | authoritative | Packaging convenience |
| `syringeCalibration` | `"none" \| "U-100" \| …` | authoritative; migrated | Gates U-100 mark display (FR-SYRINGE-001) |
| `bacWaterMl` | `number \| null` | optional | Non-therapeutic convenience |
| `createdAt` / `updatedAt` | ISO-8601 strings | authoritative | |
| `lifecycle` | `"active" \| "archived"` | authoritative | Soft-archive preferred over hard delete when schedules remain |
| `depletionRemaining` | `number \| null` | derived | Updated on Taken per FR-SCH-000 |

**Deletion behavior:** Delete fill with confirm (UX-CAB-001). Cascade: archive or delete linked schedule series + future pending occurrences; retain historical taken/skipped logs unless user chooses purge. Hard delete removes IDs from subsequent exports.

**Unit fields:** Do **not** store separate vialUnit vs doseUnit in the target model. Same-unit invariant is mandatory (FR-UNIT-001).

### 6.3 Medication / peptide identity (`MedicationIdentity`)

| Field | Type | Marks | Notes |
| --- | --- | --- | --- |
| `id` | `string` (stable UUID) | authoritative | |
| `userText` | `string` | authoritative | Exactly what the user typed/selected |
| `normalizedConcept` | `string \| null` | optional; migrated | Display name from local dictionary (default path) |
| `rxCui` | `string \| null` | optional; migrated | Present only when local (or approved remote) match succeeds |
| `matchStatus` | `"unresolved" \| "matched" \| "quarantined" \| "unknown"` | derived | SAF-UNK-001 / SAF-GATE-001 |
| `provenance` | `{ source, kbVersion, lookedUpAt } \| null` | optional; migrated | Required when showing identity UI (SAF-CONTRACT-001) |
| `lifecycle` | `"active" \| "archived"` | authoritative | |

**Privacy:** `userText`, `rxCui`, and med-list contents are health-adjacent. Default normalization is **offline/local** (bundled/subset dictionary). Remote RxNorm/API requires **DEC-NORM-REMOTE** (Serious). These fields are **prohibited from leaving device** without that (or DEC-REM/DEC-CLOUD) decision. **No** batch send of full med list by default.

### 6.4 Schedule series (`ScheduleSeries`)

| Field | Type | Marks | Notes |
| --- | --- | --- | --- |
| `id` | `string` (stable UUID) | authoritative | |
| `fillId` | `string` | authoritative | FK to FillRecord |
| `timeZone` | `string` (IANA) | authoritative | Civil-local scheduling; not UTC-Z wall times |
| `startCivilDate` | `string` (`YYYY-MM-DD`) | authoritative | Local civil date in `timeZone` |
| `timeOfDay` | `string` (`HH:mm`) | authoritative | Local |
| `recurrence` | structured rule (e.g. daily/intervalDays) | authoritative | DST-safe generation — no bare `DAY_MS` addition |
| `lifecycle` | `"active" \| "archived"` | authoritative | |
| `createdAt` / `updatedAt` | ISO-8601 | authoritative | |
| `takenDates` | `string[]` | migrated (legacy) | FACT defect path; migrate into OccurrenceRecord; stop inventing history (C9) |

**Deletion:** Deleting series archives/cancels future pending occurrences; does not invent taken history.

### 6.5 Occurrence / dose-log state (`OccurrenceRecord`) — **P0 minimal**

Prerequisite to UX-SCH-001 / UX-SCH-004 (see **FR-SCH-000**).

| Field | Type | Marks | Notes |
| --- | --- | --- | --- |
| `id` | `string` (stable UUID) | authoritative | One-occurrence identity |
| `scheduleId` | `string` | authoritative | FK to ScheduleSeries |
| `localCivilDate` | `string` (`YYYY-MM-DD`) | authoritative | In series `timeZone` |
| `timeZone` | `string` (IANA) | authoritative | Copied/resolved at materialization |
| `status` | `"pending" \| "taken" \| "skipped" \| "snoozed" \| "rescheduled"` | authoritative | P0 requires pending/taken (+ undo→pending); skip/snooze/reschedule are P1 |
| `takenAt` | ISO-8601 \| null | optional | Set when status=taken |
| `depletionApplied` | `boolean` | authoritative | True only if Taken decremented fill depletion |
| `snoozeUntil` | ISO-8601 \| null | optional; P1 | |
| `note` | `string \| null` | optional | |
| `updatedAt` | ISO-8601 | authoritative | Supports Undo after restart |

**Idempotency:** Mark-taken on already-taken occurrence is a **no-op** (double-tap safe). Undo restores `pending`, clears `takenAt`, and reverses depletion iff `depletionApplied` was true. Persistence must survive app restart (not snackbar-only).

**Deletion:** Soft-cancel pending future occurrences when series archived; do not delete historical taken/skipped without explicit purge.

### 6.6 Notification registration / port state (`NotificationPortState`)

| Field | Type | Marks | Notes |
| --- | --- | --- | --- |
| `activePort` | `"none" \| "web-foreground" \| "native-android" \| "server"` | authoritative | Exactly one live port after DEC-REM |
| `enabled` | `boolean` | authoritative | |
| `registrationToken` | `string \| null` | optional; **prohibited from leaving device** without Serious | playerId/subscriptionId class |
| `lastRegisteredAt` | ISO-8601 \| null | optional | |
| `permissionState` | `"unknown" \| "granted" \| "denied" \| "prompt"` | derived/optional | Platform-specific |
| `platform` | `"web" \| "median-android" \| "unsupported"` | authoritative | Aligns with §2.2 matrix |

iOS and multi-port simultaneous delivery are out of scope until separately approved. Final reminder promise is **DEC-REM**-gated.

### 6.7 Settings / time zone (`SettingsRecord`)

| Field | Type | Marks | Notes |
| --- | --- | --- | --- |
| `timeZone` | `string` (IANA) | authoritative | Default scheduling TZ; civil dates |
| `theme` | `string \| null` | optional | |
| `firstRunDefaultsMode` | `"empty-dose" \| "legacy-demo"` | migrated | Target after DEC-DEFAULTS = empty desired-dose; legacy-demo is characterization-only |
| `unitPreference` | shared unit enum | optional | Mirrors FillRecord.unit default |
| `syringeCalibrationDefault` | `"none" \| "U-100"` | optional | Default **none** until DEC-SYRINGE |
| `updatedAt` | ISO-8601 | authoritative | |

Settings may contain health-adjacent preferences; treat export as sensitive plaintext (FR-IMP-003 disclosure).

### 6.8 Cross-cutting rules

1. **Stable IDs:** UUIDs for fills, schedules, occurrences, medication identities; import collision policy per FR-IMP-002.
2. **Timestamps:** Prefer ISO-8601 with explicit offset or UTC `Z` for event times; civil `YYYY-MM-DD` + IANA TZ for schedule identity (never UTC `toISOString` date for “today”).
3. **Units:** One shared unit field on the fill; never silent cross-unit conversion; never IU↔mass.
4. **Active/archived:** Soft-archive by default; hard delete is explicit and cascading with confirm.
5. **Prohibited off-device without Serious:** medication/peptide names and doses, RxCUI/normalized concepts, full med lists, notification tokens, `userId` if identifying, unencrypted backup contents shared externally — require DEC-REM / DEC-NORM-REMOTE / DEC-CLOUD / encryption decision as applicable.
6. **Unknown fields:** Quarantine/passthrough on import (FR-IMP-002); do not silently strip future identity fields (SR-SCHEMA-001).

---

## 7. Requirements with stable IDs

Priority: **P0** = safety-relevant usability, security, or correctness gates before meaningful feature work; **P1** = core product completion; **P2** = polish.

Acceptance criteria use Given / When / Then.

### 7.1 Mira UX requirements (kept IDs)

#### Wizard

**UX-WIZ-001 Back preserves values** — P0 — Mira
- Given values on steps 1–3; When Back; Then values unchanged and progress moves to prior step.

**UX-WIZ-002 Cancel discards with confirm when dirty** — P0 — Mira
- Given unsaved wizard edits; When Cancel; Then confirm “Discard this peptide setup?” (Keep editing / Discard); Discard clears draft to defaults and returns to step 1 (or prior tab).
- **Defaults:** “defaults” means Spec-target defaults after **DEC-DEFAULTS** (empty desired-dose); until decided, Discard returns to **characterization** live values but those values are **not** approved target design.

**UX-WIZ-003 Next validates current step** — P0 — Mira / FR-CALC-010
- Given empty or non-positive required fields; When Next; Then first invalid field focused, inline error shown, step does not advance.

**UX-WIZ-004 Progress accessible** — P1 — Mira
- Given any wizard step; When SR focuses progress; Then announces “Step X of 3: {step title}”.

**UX-WIZ-005 Tab leave preserves draft** — P1 — Mira
- Given in-progress draft; When user leaves Add Peptide tab and returns; Then draft and step index restored until Cancel/Reset/successful Save.

**UX-WIZ-010 mcg unit** — P1 — Mira / Sage C12 / **DEC-UNIT** / **FR-UNIT-001**
- Given unit select; When options render; Then mg, mcg, and IU **may** be listed as labels under the **same shared unit** invariant.
- **REQ:** Do **not** ship mg↔mcg numeric conversion until DEC-UNIT specifies rules + tests. Never IU↔mass conversion. mcg as a selectable label without conversion is still gated by DEC-UNIT clarity; safe default while waiting = characterize production mg/IU only.

**UX-WIZ-020 No therapeutic suggestion framing** — P0 — Mira MED-FLAG
- Given step 2 chips; When chip group label read; Then Common amounts or Recently used — never Recommended dose.
- Helper: Enter the dose you already planned. FitGen does not suggest therapeutic doses.
- **DEC-DEFAULTS:** Recommended target = **no therapeutic amount chips** at first-run; packaging/syringe/BAC convenience presets OK if non-therapeutic.

**UX-WIZ-030 Generate produces options** — P1 — Mira
- Given valid steps 1–3; When Generate; Then results aria-live updates and focus moves to results heading or first row.

#### Chips

**UX-CHIP-001 Common / recent + Custom** — P1 — Mira / DEC-DEFAULTS
- Given vial / dose / syringe / BAC fields; When chips render; Then common **packaging** sizes for unit + Recent + Custom; never recommended-dose captions; **no therapeutic amount chips** as Spec target first-run (DEC-DEFAULTS).

#### Results

**UX-RES-001 Compact comparison rows** — P1 — Mira
- Given at least one option on ~390px viewport; When results render; Then Water / Draw / Conc visible as compact rows without horizontal scroll.
- U-100 column only if FR-SYRINGE-001 calibration selected; otherwise show **mL only**.

**UX-RES-002 Ranking copy (Easiest to measure)** — P0 — Mira MED-FLAG / Sentinel
- Given highest-scored option; When badge renders; Then Easiest to measure (or Best mark alignment) — never Recommended.

**UX-RES-003 Empty state** — P1 — Mira / FR-CALC-010
- Given no fitting option (impossible config or no option after rounding); When results render; Then geometry constraint explanation + Edit syringe and water jumps to step 3; **no** fabricated options.

#### Name

**UX-NAME-001 Alias match** — P1 — Mira
- Given canonical entry with alias (e.g. TB-500 / TB500); When user types alias; Then canonical suggestion appears.

**UX-NAME-002 No dose in name suggestions** — P0 — Mira / Aegis
- Given name suggestions; When shown; Then names only — never dose amounts.

#### Save

**UX-SAVE-001 Confirm before persist** — P0 — Mira
- Given selected water option; When proceeding to save; Then confirmation summary shown; nothing written until Save succeeds.
- Disclaimer: You entered this dose. FitGen only calculates water and draw volume.

**UX-SAVE-002 Cancel preserves selection** — P0 — Mira
- Given confirmation open; When Cancel; Then modal closes; results selection + wizard draft intact.

#### Cabinet

**UX-CAB-001 Destructive confirm** — P0 — Mira / Sentinel path variance
- Given fill with schedules; When Delete; Then confirm names cascade (e.g. Deletes N dosage plans) and requires explicit confirm.

**UX-CAB-002 Load preserves units** — P1 — Mira / FR-UNIT-001
- Given saved fill; When Load; Then wizard opens with vial/dose/**shared unit** populated and chips reflecting those values.

#### Schedule / Calendar

**UX-SCH-001 Taken** — P0 — Mira — **requires FR-SCH-000**
- Given due today, not taken; When Mark taken; Then Taken status; Undo snackbar >=8s; depletion updates via occurrence model (FR-SCH-000).
- **Blocked:** Cannot ship before FR-SCH-000.

**UX-SCH-002 Skip** — P1 — Mira — extends FR-SCH-000 via FR-SCH-001
- Given due occurrence; When Skip; Then marked skipped (not counted as taken for depletion).

**UX-SCH-003 Snooze** — P1 — Mira — extends FR-SCH-000 via FR-SCH-001
- Given due occurrence; When Snooze (preset); Then next reminder time shifts for that occurrence only; calendar reflects it.

**UX-SCH-004 Undo taken** — P0 — Mira — **requires FR-SCH-000**
- Given just marked taken; When Undo; Then occurrence returns to pending; depletion reversed if applied; survives restart.
- **Blocked:** Cannot ship before FR-SCH-000. (Legacy “remove date from takenDates” is insufficient alone.)

**UX-SCH-005 Edit occurrence vs series** — P1 — Mira
- Given Reschedule; When prompted; Then Only this time | This and future with clear consequence copy.

**UX-CAL-001 Status parity** — P1 — Mira
- Given Schedule and Calendar; When occurrence updated in one; Then the other reflects same Taken/Skipped/Snoozed/Rescheduled state after re-render.

**UX-CAL-002 Empty** — P2 — Mira
- Given no schedules; When Calendar opens; Then empty CTA routes to Add Peptide.

#### System

**UX-SYS-001 No alert for validation** — P0 — Mira
- Given validation failure; When shown; Then inline or in-modal — not window.alert for routine errors.

**UX-SYS-002 Import preview** — P0 — Mira / Sage C5 / Sentinel / **FR-IMP-002**
- Given valid backup file; When Import; Then **validate + preview counts without mutation**; Cancel leaves state unchanged; duplicate/ID collision policy selectable per entity (Skip existing default / Replace all with destructive confirm).
- Unknown fields: show quarantine/passthrough summary in preview (do not silently strip).

**UX-SYS-003 Import atomicity + rollback** — P0 — Mira / Sage / **FR-IMP-003**
- Given confirmed import; When apply runs; Then all accepted records apply or none on hard failure; **and** a pre-import recovery snapshot exists so the user can restore prior state after a successful but unwanted Replace All (rollback ≠ only “atomic apply”).
- Before export/share: explicit **plaintext sensitive-data warning** (health-adjacent JSON may include peptide/med names and doses).

#### Accessibility

**UX-A11Y-001** Labels on every input (or aria-label if icon-only) — P1 — Mira
**UX-A11Y-002** Tap targets >=44x44 CSS px — P0 — Mira
**UX-A11Y-003** :focus-visible >=2px, contrast >=3:1; no outline removal without replacement — P0 — Mira
**UX-A11Y-004** Modal focus trap, initial focus, Escape, restore focus, aria-modal — P0 — Mira
**UX-A11Y-005** Polite live regions for results/status; assertive sparingly — P1 — Mira
**UX-A11Y-006** Honor prefers-reduced-motion: reduce — P2 — Mira
**UX-A11Y-007** WCAG AA contrast (body >=4.5:1; large >=3:1) — P1 — Mira
**UX-A11Y-008** Keyboard operability for wizard, results, save, cabinet — P1 — Mira
**UX-A11Y-009** Status chips not color-only — P1 — Mira
**UX-A11Y-010** Decorative wizard images empty alt when title conveys meaning — P2 — Mira

AC pattern for A11Y: Given the relevant control/surface; When used with keyboard/SR/reduced-motion/contrast check; Then the requirement holds.

#### MED-FLAG copy (cross-cutting REQ)

**UX-COPY-001 MED-FLAG replacements** — P0 — Mira section 5 / Sentinel section 5.1 / Aegis section 7
- Given live strings; When Spec B / P0.6 ships; Then replace at minimum: Recommended badge to Easiest to measure; vial usually-preferred to physical fit framing; Saved prescriptions to Saved peptides/plans; how much to take to measurement phrasing; reminder Take dose phrasing to planned-draw framing if reminders remain; marketing safety-first dose math removed or reworded to measurement planner language.

---

### 7.2 Functional requirements (FR-*)

**FR-CALC-001 Golden tests for both calculator paths (legacy evidence)** — P0 — Sage P0.1 / Sentinel section 2
- Given fixture matrix (mg/IU, min-draw 0.05 vs 0.10, water/syringe cases); When CI runs; Then both app.js water-step and runtime-fixes draw-target outputs are locked as **legacy evidence snapshots** — **not** target correctness oracles.
- Given Filipe has not picked a winner; When tests land; Then production math is unchanged.
- Label in test names/docs: `legacy-evidence` (Codex finding 8).

**FR-CALC-002 Single calculator path after formula decision** — P0 (after DEC-FORMULA) — Sage P0.2
- Given approved canonical formula; When Generate and first paint run; Then one adapter produces options; runtime-fixes no longer intercepts submit for alternate math; first paint matches Generate.

**FR-CALC-003 Rounding identity** — P1 (Serious if changing live numbers) — Sage C2 / FR-CALC-010
- Given displayed water mL; When concentration and draw are shown; Then displayed values are internally consistent (no unrounded concentration vs rounded water mismatch) per approved formula.
- **Target design:** show consistent rounded values; no unrounded/rounded mismatch. Legacy C2 remains a **FACT defect**, not a target oracle.

**FR-CALC-010 Calculator input-domain safety** — P0 — Codex finding 8
- Normative validation/display **without** choosing the disputed formula (DEC-FORMULA):
  1. **Finite positive numbers required** for vial amount, desired dose (when provided), water ceilings, syringe capacity — reject NaN/Infinity/≤0 with inline error (UX-SYS-001).
  2. **Dose ≤ vial content** in the **same shared unit** (FR-UNIT-001); else inline error; no options generated.
  3. **Impossible configs** (e.g. syringe capacity cannot fit any legal draw under current constraints) → inline error / UX-RES-003 empty state; **no** fabricated options.
  4. **Minimum non-zero draw after rounding** policy is **TBD** pending DEC-FORMULA; until then, when no option fits, follow UX-RES-003 display behavior.
  5. **Precision/display policy (target):** consistent rounded values in UI; forbid unrounded/rounded mismatch in target design (C2 is FACT defect only).
- Given invalid domain; When Generate/Next; Then no options list is shown as success.

**FR-PERS-001 Single persistence writer** — P0 — Sage P0.3 / C7
- Given any save/delete/import/mark-taken; When storage updates; Then one writer path with try/catch (quota UI); stop dual window.state / patch writers for the same keys.

**FR-IMP-001 Versioned import schema** — P0 — Sage section 6 / Sentinel section 4
- Given export/import; When schema evolves; Then schemaVersion (target >=3 additive) gated; unknown fields (e.g. future RxCUI) preserved or migrated — not silently stripped without policy.

**FR-IMP-002 Validate, preview, collision, quarantine** — P0 — Codex finding 6 / expands UX-SYS-002
- Given a backup file; When user chooses Import; Then:
  1. Parse + schema validate **without mutating** app state.
  2. Show preview: counts per entity, duplicate/ID collisions, unknown-field quarantine list.
  3. **Duplicate/ID collision per entity:** default Skip existing (keep local); optional Replace All (destructive confirm enumerating entities).
  4. **Unknown-field quarantine/passthrough:** preserve opaque fields keyed by entity id for round-trip; never silently drop future identity fields.
  5. Cancel / dismiss preview → zero writes.
- Tests: Cancel; corrupt file; partial entities; collision Skip vs Replace.

**FR-IMP-003 Pre-import recovery snapshot, restore, disclosure** — P0 — Codex finding 6 / expands UX-SYS-003
- Given user confirms Replace All (or any full apply); When apply begins; Then:
  1. Create **pre-import recovery snapshot** of current authoritative state before mutation.
  2. Apply is all-or-none on hard failure; on failure restore from snapshot automatically.
  3. After successful unwanted Replace All, user can **Restore previous backup** from the recovery snapshot.
  4. **Retention TTL:** retain recovery snapshot ≥ 7 days or until superseded by a newer successful import snapshot (whichever policy is documented in Settings); show expiry in restore UI.
  5. **Quota failure:** if snapshot cannot be written, **abort import** with inline error; no mutation.
  6. **Corrupt snapshot:** restore path fails closed with message; do not partially apply.
  7. **App restart:** snapshot and restore affordance survive restart within TTL.
  8. **Export/share disclosure:** before export or share, show explicit warning that the JSON is **plaintext** and may contain **sensitive health-adjacent data** (names, doses, schedules).
- Tests required: Cancel; quota failure; corrupt snapshot; successful rollback; app restart then restore.

**FR-REM-001 Reminder architecture freeze (one port)** — P0 (after DEC-REM) — Sage P0.4
- Given Filipe chooses native-android XOR authed server XOR web-foreground-only; When implemented; Then exactly one reminder port is live; others removed or feature-flagged off; Schedule copy matches code; TZ uses civil local dates consistently.
- Scope limited to §2.2 supported surfaces; iOS unsupported unless separately approved.

**FR-SCH-000 Minimal occurrence identity/state (P0 prerequisite)** — P0 — Codex finding 2
- Given schedules due today; When Taken/Undo are offered; Then persistence uses OccurrenceRecord (§6.5) with at least:
  - stable `id`
  - `localCivilDate` + `timeZone`
  - `status` including Taken
  - **idempotent mark-taken** (double-tap / repeat → no-op)
  - **depletion semantics** (`depletionApplied` once; Undo reverses iff applied)
  - **Undo after restart** (not session-only)
- Skip/Snooze/Reschedule remain **P1** extensions on the same model (FR-SCH-001).
- **Backlog gate:** UX-SCH-001 / UX-SCH-004 / P0.UX Taken+Undo **cannot ship** before FR-SCH-000.

**FR-SCH-001 Occurrence model extensions** — P1 — Mira / Sentinel missing states
- Given FR-SCH-000 in place; When Skip/Snooze/Reschedule/series-edit used; Then persistence stores occurrence-level extensions sufficient for UX-SCH-002/003/005 and UX-CAL-001.

**FR-UNIT-001 Shared unit invariant** — P0 (policy) / P1 (mcg label UI) — Codex finding 3 / **DEC-UNIT**
- **Spec recommendation:** vial amount and desired dose **MUST share one unit field** (same-unit invariant). Do **not** use separate unit fields with silent conversion.
- Do **not** ship mg↔mcg conversion until DEC-UNIT specifies arithmetic + tests.
- **Never** attempt IU↔mass conversion.
- Boundary/golden tests required for every **permitted** unit combination (initially: characterize production mg and IU as labels-only).
- Safe default while waiting: characterize current production only; do **not** approve new mcg conversion or mixed-unit behavior as target.

**FR-SYRINGE-001 Syringe calibration gates U-100 marks** — P0 (policy) — Codex finding 3 / **DEC-SYRINGE**
- Show **U-100 marks** only after U-100 syringe calibration is **explicitly selected/confirmed**.
- Otherwise show **mL only** (no “units” column implied as U-100).
- Safe default while waiting: characterize unconditional `doseMl*100` as FACT (C12); do **not** approve unconditional U-100 as target behavior.
- Boundary tests: calibration=none → mL only; calibration=U-100 → marks shown and documented.

**FR-UI-001 Patch retirement order** — P1 — Sage section 8
- Given replacement modules + tests; When retiring loaded patches; Then order starts with runtime-fixes.js after calc tests; do not reload the six unloaded *-fix.js files.

### 7.3 System / non-functional (SR-*)

**SR-CI-001 PR CI quality gates** — P0 — Sage P0.0 / Sentinel section 6
- Given a PR; When checks run; Then required ci.yml (not keep-alive) runs: lockfiles present, test runner exists, lint, fail if new *-fix.js added.

**SR-CI-002 Forbidden-copy grep** — P0 — Sentinel section 6 / Aegis section 7
- Given PR diff; When CI runs; Then fail on new clearance/clinical strings and clinical Recommended / treatment-directive copy outside allowlist.

**SR-SEC-001 Backend auth / CORS lockdown** — P0 — Sage P0.5 / C11 / Sentinel section 5
- Given backend deploy; When endpoints reachable; Then CORS allowlist; /debug and /test-push deleted or auth-gated; /reminders/sync requires per-install token; rate-limit; no PHI text in logs.

**SR-SEC-002 No unauthenticated sync re-enable** — P0 — Sage / CoS
- Given DEC-REM pending; When interim change ships; Then do not re-enable unauthenticated sync or expand push payload fields.

**SR-PRIV-001 Health-adjacent data minimization** — P0 policy / P1 optional encryption — Sage S4-S5 / Aegis
- Given reminders/export/normalization; When data leaves device; Then only after applicable Serious decision (DEC-REM / DEC-NORM-REMOTE / DEC-CLOUD); prefer on-device; no false encrypted badge; passphrase encryption Elevated/Serious — not P0.
- Default RxNorm path is **local** (SAF-NORM-001); remote is opt-in Serious.

**SR-SCHEMA-001 Additive schemaVersion** — P0 with FR-IMP-001 — Sage section 6
- Given migrations; When applied; Then non-destructive dual-read; do not drop new identity fields once Spec B ships; align with Canonical data model §6.

**SR-ARCH-001 No framework rewrite without override** — P0 process — ADR section 4
- Given implementation PRs; When scoped; Then incremental modules only unless Filipe overrides DEC-FW.

**SR-A11Y-001 Accessibility regression gates** — P1 — Mira / Sentinel
- Given UX-A11Y-001..010; When matrix runs; Then P0 a11y items checked before merge of wizard/modal UI PRs.

**SR-PLAT-001 Platform matrix enforcement** — P0 process — Codex finding 7
- Given implementation PRs; When claiming notification/file/offline/permission AC; Then AC must cite §2.2 surfaces (static web + Median Android). Do not imply iOS or all reminder paths without DEC-REM / separate approval.

### 7.4 Safety requirements (SAF-*) — Aegis posture B

**SAF-SCOPE-001 Near-term scope = B only** — P0 — Aegis section 9 / handoff
- Given Spec v1.1; When features proposed; Then interaction screening, allergy/duplicate engines, and dose advice are out of scope. C-prerequisites are release blockers if scope expands.

**SAF-MEDLIST-001 Personal med list (logging/display)** — P1 — Aegis section 1
- Given user-entered meds; When stored/displayed; Then list/chart semantics only — no automated clinical conclusions.

**SAF-NORM-001 RxNorm name normalization (local default)** — P1 — Aegis B / handoff / Codex finding 5
- **Default path:** offline/local normalization dictionary (bundled or curated subset) matching free-text / brand / generic to optional RxCUI / normalized concept for **identity only**.
- Unresolved maps to SAF-UNK-001; never imply identified-therefore-safe.
- **Remote RxNorm/API is not the default** and is **Serious** → requires **DEC-NORM-REMOTE** (or folded privacy decision) before any off-device lookup.
- If remote ever approved: data minimization (query string only, no batch full med list by default), consent/privacy copy, retention/logging assumptions, timeout/offline → unknown, and no silent fallback that looks like clearance.
- **Filipe?:** identity-only **local** = No (elevated engineering); **remote** = **Yes** (Serious privacy).

**SAF-LABEL-001 Optional label reference + provenance** — P2 optional — Aegis sections 1/6
- Given matched concept with SPL available; When label shown; Then reference framing + provenance; not interaction clearance.

**SAF-UNK-001 Unknown-state mandatory** — P0 when B UI ships — Aegis section 6 / Sentinel
- Given missing RxCUI, empty label, research/compounded/supplement/unresolved alias, or incomplete inputs; When UI renders; Then first-class unavailable/unknown — never all-clear or safe-to-combine.

**SAF-COPY-001 Forbidden / allowed copy** — P0 — Aegis section 7 / Sentinel
- Given identity/label/reminder UI; When copy ships; Then allowed match-confirm + clinician referral + unknown; forbidden safe-to-combine / stop-start-increase dose / inject-as-follows / clearing research peptides.

**SAF-CONTRACT-001 Data contract fields** — P1 when identity API ships — Aegis section 6 / Sentinel
- Given identity/label result; When shown; Then provenance, last-updated, KB version IDs; missing maps to unknown.

**SAF-GATE-001 Coverage quarantine** — P1 with SAF-NORM — Aegis section 4 / Sentinel
- Given PEPTIDE_LIST / aliases; When normalization runs; Then research/compounded/unapproved/supplements hard-gate to unknown.

**SAF-C-BLOCK-001 Interaction prototype blockers** — P0 process — Aegis section 9 / Sentinel
- Given PR proposing DDI/allergy screening; When reviewed; Then block unless evidenced: patient-facing license, counsel, clinical reviewer, hard-gate unknowns, audit+kill-switch, no-alert-is-not-safe UX, quarantine, no dose features.

---

## 8. Prioritized backlog

Merged Sage P0.0–P0.6 with Mira / Sentinel / Aegis P0s. Owner **Forge** = later implementation; **Spec** = this document / Codex review. Risk: routine / elevated / serious.

### P0

| # | Item | ID refs | Owner | Risk | Filipe? |
| --- | --- | --- | --- | --- | --- |
| P0.0 | CI + lockfiles + no-new-*-fix.js + forbidden-copy grep | SR-CI-001, SR-CI-002, SAF-COPY-001 | Forge | routine | No |
| P0.1 | Golden tests both calculator paths as **legacy evidence** (not target oracles) + FR-CALC-010 domain fixtures | FR-CALC-001, FR-CALC-010 | Forge | routine tests | No (pick winner later) |
| P0.2 | Single Generate path | FR-CALC-002, FR-CALC-003 | Forge | serious (math) | **Yes** (DEC-FORMULA) |
| P0.3 | Single persistence writer; versioned import preview + recovery snapshot/rollback + plaintext disclosure | FR-PERS-001, FR-IMP-001/002/003, UX-SYS-002/003, SR-SCHEMA-001, §6 model | Forge | elevated | Prefer no visible math change |
| P0.4 | One reminder port; copy/TZ match; no unauth sync; platform matrix | FR-REM-001, SR-SEC-002, SR-PLAT-001, UX-COPY-001 | Forge | serious | **Yes** (DEC-REM, DEC-CLOUD) |
| P0.5 | Backend CORS allowlist; kill/auth debug+test-push; rate-limit; no PHI logs | SR-SEC-001 | Forge | serious | **Yes** (auth/PHI) |
| P0.6 | Docs/copy match code; MED-FLAG replacements | UX-COPY-001, UX-RES-002, UX-WIZ-020 | Forge | routine | No if measurement-only |
| P0.OCC | **Minimal occurrence model** before Taken/Undo | **FR-SCH-000**, §6.5 | Forge | elevated | No |
| P0.UX | Wizard Back/Cancel/validate; Save confirm; Cabinet delete confirm; Taken+Undo (**after P0.OCC**); a11y focus/targets/modals; no validation alerts | UX-WIZ-001..003, UX-SAVE-001/002, UX-CAB-001, UX-SCH-001/004, UX-SYS-001, UX-A11Y-002..004 | Forge | elevated (UX) | No |
| P0.UNIT | Unit/syringe policy gates (shared unit; mL-only unless U-100 selected); characterize-only until DEC | FR-UNIT-001, FR-SYRINGE-001 | Spec→Forge | serious if converting | **Yes** before conversion / U-100 target (DEC-UNIT, DEC-SYRINGE) |
| P0.SAF | Lock posture B; unknown-state + forbidden-copy gates; no DDI/dose PRs | SAF-SCOPE-001, SAF-UNK-001, SAF-COPY-001, SAF-C-BLOCK-001 | Spec then Forge | serious if violated | Counsel before leaving B |
| P0.DEF | Do not change live 30/3/1/3; do **not** approve as target; empty desired-dose target pending DEC-DEFAULTS | DEC-DEFAULTS, UX-WIZ-020, UX-CHIP-001 | Spec | serious (dose presentation) | **Yes** (DEC-DEFAULTS) |

**Gate:** Taken/Undo (UX-SCH-001/004) **cannot ship** before FR-SCH-000 (P0.OCC).

### P1

| Item | ID refs | Owner | Risk | Filipe? |
| --- | --- | --- | --- | --- |
| Chips packaging/recent+Custom (no therapeutic first-run chips); mcg **label** only if DEC-UNIT allows; name aliases | UX-CHIP-001, UX-WIZ-010, UX-NAME-*, FR-UNIT-001 | Forge | elevated (units Serious if converting) | DEC-UNIT if converting |
| Compact results; Skip/Snooze/Reschedule/occurrence\|series; Schedule-Calendar parity | UX-RES-001, UX-SCH-002/003/005, UX-CAL-001, FR-SCH-001 | Forge | elevated | No if measurement-only |
| Draft across tabs; offline banner; permission recovery (web + Median Android) | UX-WIZ-005, Mira section 3.11, SR-PLAT-001 | Forge | routine | No |
| Personal med list + **local** RxNorm dictionary + quarantine; data contract | SAF-MEDLIST-001, SAF-NORM-001, SAF-GATE-001, SAF-CONTRACT-001 | Forge | elevated | **No** for local identity-only; **Yes** if remote (DEC-NORM-REMOTE) |
| Patch retirement after tests; a11y keyboard/contrast/live regions | FR-UI-001, UX-A11Y-001/005/007/008/009 | Forge | elevated | No |
| Privacy minimization for any approved leave-device path | SR-PRIV-001 | Forge | serious if syncing dose text | Tied to DEC-REM / DEC-NORM-REMOTE |

### P2

| Item | ID refs | Owner | Risk | Filipe? |
| --- | --- | --- | --- | --- |
| Reduced motion; decorative alt; Calendar empty polish | UX-A11Y-006/010, UX-CAL-002 | Forge | routine | No |
| Optional label reference viewer with provenance | SAF-LABEL-001 | Forge | elevated | Counsel if interpretive |
| Medications IA collapse; density polish | Mira P2 / HYP | Forge | routine | No |
| Passphrase-encrypted export | Sage section 6.4 | Forge | elevated/serious | **Yes** if marketed as protected health export |

**Do not combine** P0.2 (math) with P0.4 (reminders) or P0.5 (auth) in one PR. Do not delete loaded *-fix.js until replacement tests pass (runtime-fixes.js first). Do not reload unloaded patches. Do not ship Taken/Undo before FR-SCH-000.

---

## 9. Release definition of done (DoD)

### 9.1 Spec v1.1 approval (this document)

- [ ] Codex re-reviews Spec v1.1; FACT/REQ/HYP separation intact
- [ ] Blocking findings 1–8 mapped in `CODEX_RESPONSE_MATRIX.md` and addressed
- [ ] Canonical data model §6 present with field marks
- [ ] ADR accepted (incremental TS/ES modules; no framework rewrite)
- [ ] Aegis posture **B** locked; no DDI/dose implementable requirements; local-default normalization
- [ ] Mira UX IDs preserved; FR/SR/SAF IDs unique and traced (incl. FR-SCH-000, FR-CALC-010, FR-UNIT-001, FR-SYRINGE-001, FR-IMP-002/003)
- [ ] Platform matrix + intended user in product intent; reminder promise tied to DEC-REM
- [ ] P0 backlog coherent (incl. P0.OCC before Taken/Undo; P0.DEF / P0.UNIT gates)
- [ ] Serious decision stubs listed (section 11) — **not** yet posted as [DECISION REQUIRED] from this file alone
- [ ] Discovery remains read-only: no app code / merge / deploy from Issue #2 discovery work
- [ ] After approval: docs-only PR under `docs/` recording gist rev + evidence SHA (Codex artifact requirement)

### 9.2 First post-Spec merge gates (Sentinel section 6 + Sage P0.0)

Before any implementation merge to `main`:

- [ ] ci.yml on pull_request (do **not** require keep-alive)
- [ ] Lockfiles for root and backend
- [ ] Test runner script exists; calculator golden tests labeled **legacy evidence** for **both** paths (FR-CALC-001); input-domain tests (FR-CALC-010)
- [ ] Import tests: preview-without-mutation; recovery snapshot; Cancel; quota failure; corrupt snapshot; rollback; restart (FR-IMP-002/003)
- [ ] Reminder/TZ tests: local vs Z, UTC setDefaultDates, occurrence Taken/Undo idempotency (FR-SCH-000); playerId drop
- [ ] Unit/syringe characterization tests; no approved unconditional U-100 target without DEC-SYRINGE
- [ ] Forbidden-copy grep (SR-CI-002) — P0 **now** even without med engine
- [ ] CI fails on new *-fix.js
- [ ] No therapeutic-dose oracles in calc tests
- [ ] If Spec B UI ships: unknown-state tests + peptide/compound fixtures; local dictionary path
- [ ] If any PR moves past B: SAF-C-BLOCK-001 evidence on the issue — else **block**
- [ ] No dose-feature PRs; no remote RxNorm without DEC-NORM-REMOTE

---

## 10. Open questions

### Elevated

1. Snooze preset list (15m / 1h / tomorrow) — confirm exact set.
2. Alias source of truth: curated map vs parse parentheticals in peptide-list.js.
3. My Medications section collapsed-by-default IA when >=1 fill exists.
4. Whether optional DailyMed/openFDA label viewer (SAF-LABEL-001) ships in the same milestone as RxNorm chips or later.
5. Recovery snapshot TTL exact duration / Settings UX copy (FR-IMP-003 baseline ≥ 7 days).

### Serious (see also section 11 — do not implement until decided)

1. Canonical formula / min-draw / rounding (C1/C2) — **DEC-FORMULA**.
2. Reminder architecture + whether dose text may leave the device — **DEC-REM**.
3. Whether cloud reminder DB should exist at all — **DEC-CLOUD**.
4. Unit conversions beyond labels (mg/mcg/IU) — **DEC-UNIT**; syringe U-100 calibration — **DEC-SYRINGE**.
5. First-run defaults / therapeutic amount presentation — **DEC-DEFAULTS**.
6. Remote RxNorm/API privacy — **DEC-NORM-REMOTE**.
7. Licensed interaction data / patient-facing CDS / counsel timing / vendor outreach / population gates / product boundary (Aegis section 10).

---

## 11. Serious decisions for Filipe (Spec stubs)

**Not posting [DECISION REQUIRED] issues in this file.** Safe defaults apply until separate [DECISION] issues are filed and answered.

| Stub ID | Decision | Recommended option | Safe default while waiting |
| --- | --- | --- | --- |
| **DEC-FORMULA** | Canonical reconstitution formula / min-draw / rounding | Pick **one** documented path after golden tests; prefer internal consistency (fix C2) | Do **not** change live numbers; lock **both** paths as **legacy evidence** (P0.1); enforce FR-CALC-010 domain rules without picking formula |
| **DEC-REM** | Reminder architecture + dose text off-device | Prefer **native Median Android only** *or* **web-foreground with honest limits**; if cloud, require auth + minimize payload. Final platform reminder promise tied here. | Keep current hidden UI + no-op sync; do **not** re-enable unauthenticated sync; do **not** imply all reminder paths supported |
| **DEC-CLOUD** | Whether cloud reminder DB should exist | Prefer **no** long-lived health schedule DB until auth/PHI model exists; if yes, retention + debug policy required | Treat backend as pre-production; do not expand payload fields |
| **DEC-FW** | Framework rewrite | **No** — ADR section 4 incremental modules | Do not start React/Vue/Svelte |
| **DEC-UNIT** | mg/mcg/IU conversions (labels vs arithmetic) | **Same shared unit** for vial + desired dose; add mcg as label only with explicit rules; **no** mg↔mcg conversion until specified + tested; **never** IU↔mass | Characterize production mg/IU labels only; do **not** approve mixed-unit or new mcg conversion as target |
| **DEC-SYRINGE** | Syringe calibration / U-100 marks | Require explicit U-100 calibration selection before showing U-100 marks; otherwise **mL only** | Characterize unconditional `doseMl*100` as FACT only; do **not** approve unconditional U-100 as target |
| **DEC-DEFAULTS** | First-run / Reset field defaults (dose presentation) | **Empty desired-dose**; **no therapeutic amount chips**; packaging/syringe/BAC convenience presets OK if non-therapeutic | Do **not** change live 30/3/1/3 values yet; do **not** approve them as Spec target design |
| **DEC-NORM-REMOTE** | Remote RxNorm / terminology API | Prefer **stay local** (bundled/subset dictionary). If remote: minimization, consent, retention/logging, timeout→unknown, **no** batch full med list | Local-only normalization; no remote calls |
| **DEC-DDI** | Licensed interaction data at all? | **Not near-term**; revisit only after B ships and coverage fit is assessed | Stay on posture **B**; no vendor-dependent DDI UI |
| **DEC-CDS** | Patient-facing CDS vs reference-only | Prefer **reference-only** labeling + identity; avoid patient recommendation software | No patient DDI alerts; no treatment directives |
| **DEC-COUNSEL** | When to engage regulatory counsel | **Before** any interpretive alert / CDS design (recommended before leaving B) | No interpretive screening features until counsel memo exists |
| **DEC-VENDOR** | Vendor outreach timing | **After** counsel + intended-use clarity; sales-mediated pricing | No production academic keys; no premature license assumption |
| **DEC-BOUNDARY** | Fitness/planner vs medication-safety product boundary | Keep FitGen as **measurement planner**; med identity as optional hygiene on personal list | Do not market as clinical safety checker |
| **DEC-POP** | Population gates (pregnancy, pediatrics, organ impairment) | **Exclude** until clinical/regulatory review | No population-specific screening UI; incomplete inputs map to unknown/suppress |

---

## 12. Traceability

| Requirement IDs | Source artifacts | Planned test class (Sentinel) |
| --- | --- | --- |
| §6 Canonical data model | Sage schema notes; Sentinel import; Codex finding 1 | Schema/round-trip; migration dual-read; prohibited-field egress checks |
| UX-WIZ-*, UX-CHIP-*, UX-RES-*, UX-NAME-*, UX-SAVE-*, UX-CAB-*, UX-SCH-*, UX-CAL-*, UX-SYS-*, UX-A11Y-*, UX-COPY-001 | MIRA_UX_SPEC_V1.md (+ section 10 errata) | Smoke journeys section 1; MED-FLAG copy section 5.1; a11y manual/CI |
| FR-CALC-001/002/003/010 | Sage C1–C2, P0.1–P0.2; Sentinel section 2; Codex finding 8 | Calculator math matrix; dual-path **legacy evidence**; input-domain; no therapeutic oracles |
| FR-UNIT-001, FR-SYRINGE-001 | Sage C12; Codex finding 3 | Permitted unit combinations; U-100 gated vs mL-only |
| FR-PERS-001, FR-IMP-001/002/003, FR-UI-001 | Sage C5–C8, sections 6–8; CoS #7; Codex finding 6 | Backup/import section 4; preview; snapshot/rollback; disclosure |
| FR-REM-001, FR-SCH-000, FR-SCH-001 | Sage C3–C4, P0.4; Mira schedule; Sentinel section 3; Codex finding 2 | Scheduling matrix; TZ/DST; occurrence Taken/Undo idempotency; one-port assertion |
| SR-CI-*, SR-SEC-*, SR-PRIV-*, SR-SCHEMA-*, SR-ARCH-*, SR-A11Y-*, SR-PLAT-001 | Sage P0.0/P0.5, section 3; Sentinel sections 5–6; CoS #1; Codex finding 7 | CI gates section 6; threat model section 5; platform AC tags |
| SAF-* (incl. SAF-NORM-001 local default) | Aegis brief + handoff; Sentinel section 5.1; Codex finding 5 | Forbidden-copy; unknown-state; local dictionary; remote blocked without DEC-NORM-REMOTE |
| DEC-DEFAULTS / DEC-UNIT / DEC-SYRINGE / DEC-NORM-REMOTE | Codex findings 3–5 | Decision stubs only until [DECISION] issues filed |

---

## 13. Deliverable index

### Durable GitHub anchors (canonical for Codex)

| Artifact | URL |
| --- | --- |
| **Spec v1.1 (gist)** | *(placeholder — re-publish revised gist after this revision; prior Codex-reviewed rev `7963e44e0ee0757c13f51d554250db2aa8e46b2b` at https://gist.github.com/lotustemplar/6b7c927411da24208219cd1dba53e599 )* |
| Mira UX Spec (+ §10 errata) | https://gist.github.com/lotustemplar/53412d64afc1ab3e521e3917dd44e1be |
| Sage audit summary | https://github.com/lotustemplar/peptide-calculator-v2/issues/2#issuecomment-5588482865 |
| Sage audit full (8 sections) | https://github.com/lotustemplar/peptide-calculator-v2/issues/2#issuecomment-5588483125 |
| Sentinel tagged handoff | https://github.com/lotustemplar/peptide-calculator-v2/issues/2#issuecomment-5588573710 |
| Sentinel full QA/security baseline | https://github.com/lotustemplar/peptide-calculator-v2/issues/2#issuecomment-5588551535 |
| Aegis medication-safety brief | https://github.com/lotustemplar/peptide-calculator-v2/issues/2#issuecomment-5588456913 |
| CoS discovery inventory | https://github.com/lotustemplar/peptide-calculator-v2/issues/2#issuecomment-5588412542 |
| Issue #2 | https://github.com/lotustemplar/peptide-calculator-v2/issues/2 |

### Shared-box working copies (agents)

| Artifact | Path |
| --- | --- |
| **This Spec v1.1** | `/workspace/fitgen-issue2/PRODUCT_SPEC_V1.md` |
| Spec summary (GitHub comment) | `/workspace/fitgen-issue2/PRODUCT_SPEC_V1_SUMMARY.md` |
| Codex response matrix | `/workspace/fitgen-issue2/CODEX_RESPONSE_MATRIX.md` |
| Codex review (input) | `/workspace/fitgen-issue2/CODEX_REVIEW_SPEC_V1.md` |
| Mira / Sage / Sentinel / CoS / Aegis packs | under `/workspace/fitgen-issue2/` |

### Atlas notes (updated for v1.1)

1. **First-run defaults:** Prior “elevated reversible assumption” that kept 30/3/1/3 as Spec target is **removed/reclassified**. Live values = characterization only; Spec target pending **DEC-DEFAULTS** (empty desired-dose; no therapeutic chips).
2. **Snooze presets:** Default to 15m / 1h / tomorrow if P1 snooze ships.
3. **Alias source of truth:** Prefer curated alias map over parsing parentheticals alone.
4. **SAF-LABEL-001:** Ships **after** SAF-NORM-001 / unknown-state, not same milestone.
5. **P0 sequencing:** P0.0 + P0.1 first; **P0.OCC (FR-SCH-000)** before Taken/Undo in P0.UX; **P0.SAF (copy gates)** may run in parallel with P0.0/P0.1; do **not** combine P0.2 + P0.4 + P0.5.
6. **Units/syringe:** Split DEC-UNIT / DEC-SYRINGE; characterize-only until decided.
7. **Normalization:** Local dictionary default; remote needs DEC-NORM-REMOTE.

**Evidence SHA for repo claims:** `4741e6f227676ff5c0f511edf173ecc03bc298df`

**Prior gist rev Codex reviewed:** `7963e44e0ee0757c13f51d554250db2aa8e46b2b`

**Next owner:** Codex — re-review Spec v1.1 using `CODEX_RESPONSE_MATRIX.md`.  
**Implementation:** Forge stays read-only until Spec approval + appropriate [DECISION] answers for P0.2 / P0.4 / P0.5 / DEC-DEFAULTS (before changing defaults) / DEC-UNIT+DEC-SYRINGE (before conversion or U-100 target) / DEC-NORM-REMOTE (before remote lookup).

---

*End of Product Specification v1.1 — Atlas consolidation, 2026-09-08. Revised for Codex re-review. Not legal or clinical advice. No application code modified.*