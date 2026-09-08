# Codex Response Matrix — Spec v1 → v1.1

**Input review:** `/workspace/fitgen-issue2/CODEX_REVIEW_SPEC_V1.md`  
**Revised spec:** `/workspace/fitgen-issue2/PRODUCT_SPEC_V1.md` (v1.1)  
**Evidence SHA:** `4741e6f227676ff5c0f511edf173ecc03bc298df`  
**Prior gist rev Codex reviewed:** `7963e44e0ee0757c13f51d554250db2aa8e46b2b`  
**Date:** 2026-09-08

Maps each blocking finding → changed requirement IDs / sections + how addressed.

---

## Finding 1 — Data model / lifecycle

| | |
| --- | --- |
| **Status** | Addressed |
| **Sections** | **§6 Canonical data model** (new); field lifecycle marks in §1; SR-SCHEMA-001 cross-ref; P0.3 backlog refs §6 |
| **IDs** | Model entities (not FR-* IDs): `BackupEnvelope`, `FillRecord`, `MedicationIdentity`, `ScheduleSeries`, `OccurrenceRecord`, `NotificationPortState`, `SettingsRecord` |
| **How addressed** | Added plain-language + typed-contract tables for all required entities: schemaVersion/exportedAt/userId?/entities; fill/reconstitution; medication identity (user text + optional RxCUI/normalized concept); schedule series; occurrence/dose-log; notification port state; settings/time zone. Specified stable IDs, timestamps, unit fields, active/archived lifecycle, deletion/cascade behavior. Marked fields **authoritative \| derived \| optional \| migrated \| prohibited from leaving device** without Serious decision. |

---

## Finding 2 — Occurrence model P0

| | |
| --- | --- |
| **Status** | Addressed |
| **Sections** | §6.5 OccurrenceRecord; §7.2 FR-SCH-000; UX-SCH-001/004 gated notes; §8 P0.OCC + backlog gate; FR-SCH-001 reclassified as P1 extensions |
| **IDs** | **New: FR-SCH-000** (P0). **Changed: FR-SCH-001** (P1 extensions only). **Changed: UX-SCH-001, UX-SCH-004** (explicit prerequisite on FR-SCH-000). Backlog **P0.OCC** before P0.UX Taken/Undo |
| **How addressed** | Promoted minimal occurrence identity/state to **P0** as prerequisite to UX-SCH-001/004. FR-SCH-000 requires occurrence ID, local civil date/TZ, Taken state, idempotent mark-taken (double-tap no-op), depletion semantics (`depletionApplied`), Undo after restart. Skip/Snooze/Reschedule remain P1 on the same model via FR-SCH-001. Backlog explicitly states Taken/Undo cannot ship before FR-SCH-000. |

---

## Finding 3 — Units / syringe

| | |
| --- | --- |
| **Status** | Addressed |
| **Sections** | §5 hard constraints; §6.2 unit + syringeCalibration fields; §7.2 FR-UNIT-001 / FR-SYRINGE-001; UX-WIZ-010 / UX-RES-001 notes; §8 P0.UNIT; §11 DEC-UNIT + **DEC-SYRINGE** |
| **IDs** | **New: FR-UNIT-001, FR-SYRINGE-001, DEC-SYRINGE**. **Changed: DEC-UNIT** (shared-unit recommendation; no mg↔mcg until specified; never IU↔mass). **Changed: UX-WIZ-010, UX-RES-001, UX-CAB-002** |
| **How addressed** | Split **DEC-UNIT** vs **DEC-SYRINGE**. Spec REQ: vial amount and desired dose **MUST share one unit field** (same-unit invariant). Do not ship mg↔mcg conversion until DEC-UNIT + tests. Never IU↔mass. U-100 marks only after U-100 syringe calibration explicitly selected; otherwise **mL only**. Boundary/golden tests for every permitted unit combination. Safe default: characterize production only; do not approve unconditional U-100 or new mcg conversion as target. |

---

## Finding 4 — Defaults Serious

| | |
| --- | --- |
| **Status** | Addressed |
| **Sections** | §3.1 Defaults FACT row; §5 constraint; UX-WIZ-002/020, UX-CHIP-001 notes; §8 **P0.DEF**; §10 Serious list; §11 **DEC-DEFAULTS**; §13 Atlas notes item 1 reclassified |
| **IDs** | **New: DEC-DEFAULTS** (Serious). **Changed:** removed prior “elevated reversible assumption” that kept 30/3/1/3 as Spec target |
| **How addressed** | Added DEC-DEFAULTS. Recommended: empty desired-dose; no therapeutic amount chips; packaging/syringe/BAC convenience presets OK if non-therapeutic. Safe default while waiting: do not change live 30/3/1/3; **do not approve** as target design. Prior Atlas assumption #1 removed/reclassified to characterization-only. |

---

## Finding 5 — RxNorm privacy

| | |
| --- | --- |
| **Status** | Addressed |
| **Sections** | §6.3 MedicationIdentity privacy notes; §7.4 **SAF-NORM-001** rewrite; SR-PRIV-001; §8 P1 med-list row Filipe? column; §11 **DEC-NORM-REMOTE** |
| **IDs** | **Changed: SAF-NORM-001**. **New: DEC-NORM-REMOTE**. **Changed: SR-PRIV-001**. P1 backlog Filipe? = No for local identity-only; **Yes** if remote |
| **How addressed** | Default path = **offline/local** normalization dictionary (bundled/subset). Remote RxNorm/API = Serious → DEC-NORM-REMOTE. If remote ever approved: data minimization, consent copy, retention/logging, timeout/offline→unknown, **no** batch send of full med list by default. |

---

## Finding 6 — Backup rollback + disclosure

| | |
| --- | --- |
| **Status** | Addressed |
| **Sections** | §7.1 UX-SYS-002/003 expanded; §7.2 **FR-IMP-002**, **FR-IMP-003**; §8 P0.3; §9.2 import test gates; §10 elevated TTL question |
| **IDs** | **New: FR-IMP-002, FR-IMP-003**. **Changed: UX-SYS-002, UX-SYS-003**. Ties to FR-IMP-001 / SR-SCHEMA-001 / §6.1 |
| **How addressed** | Validate+preview without mutation; pre-import recovery snapshot before Replace All; restore UX + retention TTL (≥7 days baseline); duplicate/ID collision per entity; unknown-field quarantine/passthrough; explicit plaintext sensitive-data warning before export/share; tests for Cancel, quota failure, corrupt snapshot, successful rollback, app restart. |

---

## Finding 7 — Platform matrix

| | |
| --- | --- |
| **Status** | Addressed |
| **Sections** | **§2.1 Intended user**; **§2.2 Supported platform matrix**; §5 reminder constraint; FR-REM-001 scope note; **SR-PLAT-001**; DEC-REM recommended option text; §8 P0.4 |
| **IDs** | **New: SR-PLAT-001**. **Changed: §2 Product intent, FR-REM-001, DEC-REM** |
| **How addressed** | Documented intended user (self-managed planner, not clinician CDS). Supported v1 baseline: **static web app + Median-wrapped Android**; **iOS unsupported/uncommitted** unless separately approved. Final platform reminder promise tied to **DEC-REM** — does not imply all reminder paths supported. |

---

## Finding 8 — Calculator input domain

| | |
| --- | --- |
| **Status** | Addressed |
| **Sections** | §7.2 **FR-CALC-010**; FR-CALC-001 legacy-evidence labeling; FR-CALC-003 target vs FACT C2; UX-WIZ-003 / UX-RES-003 links; §8 P0.1; §9.2 test gates; DEC-FORMULA safe default |
| **IDs** | **New: FR-CALC-010**. **Changed: FR-CALC-001** (legacy evidence, not target oracles), **FR-CALC-003** (target consistency; C2 = FACT defect) |
| **How addressed** | Added normative input-domain safety **without** choosing disputed formula: finite positive numbers; dose ≤ vial content (same unit); impossible configs → inline error / no options; minimum non-zero draw after rounding = TBD pending DEC-FORMULA with UX-RES-003 when no option fits; precision/display policy = consistent rounded values in target design. P0.1 golden snapshots labeled **legacy evidence**, not target correctness oracles. |

---

## Also updated (cross-cutting)

| Area | Change |
| --- | --- |
| Document control | Status = Revised for Codex re-review; Spec revision = v1.1; prior gist rev recorded; versioning notes |
| §11 Decision stubs | Added DEC-DEFAULTS, DEC-SYRINGE, DEC-NORM-REMOTE; updated DEC-UNIT / DEC-REM / DEC-FORMULA text |
| §8 P0/P1 backlog | P0.OCC, P0.UNIT, P0.DEF; Taken/Undo gate; SAF-NORM Filipe? column; P0.3 import rollback |
| §12 Traceability | Rows for §6 model, FR-SCH-000, FR-CALC-010, FR-UNIT/SYRINGE, FR-IMP-002/003, SR-PLAT-001, DEC-* |
| §13 Deliverable index | Spec v1.1 paths; gist placeholder note; Codex response matrix path; Atlas notes reclassified |
| Summary | `/workspace/fitgen-issue2/PRODUCT_SPEC_V1_SUMMARY.md` updated for GitHub comment |

---

## Confirmation checklist

| Finding | Addressed in this matrix | Spec v1.1 contains fix |
| --- | ---: | ---: |
| 1 Data model | Yes | Yes — §6 |
| 2 Occurrence P0 | Yes | Yes — FR-SCH-000 |
| 3 Units / syringe | Yes | Yes — FR-UNIT-001, FR-SYRINGE-001, DEC-SYRINGE |
| 4 Defaults Serious | Yes | Yes — DEC-DEFAULTS; assumption removed |
| 5 RxNorm privacy | Yes | Yes — SAF-NORM-001, DEC-NORM-REMOTE |
| 6 Backup rollback | Yes | Yes — FR-IMP-002/003, UX-SYS-002/003 |
| 7 Platform matrix | Yes | Yes — §2.1–2.2, SR-PLAT-001 |
| 8 Calculator domain | Yes | Yes — FR-CALC-010; legacy-evidence P0.1 |

**All eight blocking findings are addressed.** No application code, git remotes, or production systems were modified.