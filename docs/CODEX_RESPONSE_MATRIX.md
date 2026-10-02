# Codex Response Matrix — Spec v1.1 → v1.2 (and historical v1 → v1.1)

**Spec v1.1 re-review (five blockers):** https://github.com/lotustemplar/peptide-calculator-v2/pull/3#pullrequestreview-5145040134  
**Reviewed head:** `09e563a7fbe51cf64105a48eaebfdb37dff8324c`  
**Revised spec:** [docs/PRODUCT_SPEC_V1.md](./PRODUCT_SPEC_V1.md) (**v1.2**)  
**Summary:** [docs/PRODUCT_SPEC_V1_SUMMARY.md](./PRODUCT_SPEC_V1_SUMMARY.md)  
**Evidence SHA:** `4741e6f227676ff5c0f511edf173ecc03bc298df`  
**Pinned gist rev:** [`4a801d7702857203161960f7fd6691013ffa431b`](https://gist.github.com/lotustemplar/6b7c927411da24208219cd1dba53e599/4a801d7702857203161960f7fd6691013ffa431b)  
**Prior gist rev (Codex-reviewed Spec v1):** `7963e44e0ee0757c13f51d554250db2aa8e46b2b`  
**Spec v1 review:** https://github.com/lotustemplar/peptide-calculator-v2/issues/2#issuecomment-5588921595  
**Date:** 2026-09-08

Maps each blocking finding → changed requirement IDs / sections + how addressed. The **v1.2** section is the re-review surface. The historical v1 → v1.1 section remains for traceability.

---

# Part A — Spec v1.1 re-review findings (v1.2)

## Finding 1 — Occurrence idempotency + depletion reversal

| | |
| --- | --- |
| **Status** | Addressed in v1.2 |
| **Sections** | **§6.5 OccurrenceRecord** (identity, materialization, immutable snapshot, atomic Taken/Undo); **§7.2 FR-SCH-000**; UX-SCH-001/004; §8 P0.OCC; §9.2 occurrence tests |
| **IDs** | **Changed: FR-SCH-000**, **UX-SCH-001**, **UX-SCH-004**, **OccurrenceRecord** fields. Cross-ref **FR-PERS-001** |
| **How addressed** | For the present one-time-per-series-per-day model, logical identity is unique `(scheduleId, localCivilDate)`. Materialization is lookup-first: never insert a second row or mint a second `id` for the same pair; `id` is assigned once. Taken stores immutable `appliedDepletionAmount` + `appliedDepletionUnit` (Undo uses that snapshot, not a later `FillRecord.desiredDose`). `depletionApplied` is derived. Taken/Undo and the fill depletion update are **one atomic FR-PERS-001 writer**. Required tests: duplicate materialization/restart, double-tap, edit-dose-then-Undo, failed persistence. |

## Finding 2 — FillRecord vs form state + canonical schema version

| | |
| --- | --- |
| **Status** | Addressed in v1.2 |
| **Sections** | **§6.2 FillRecord.desiredDose** persist gate; **§6.2.1 FillDraft**; **§6.1 / FR-IMP-001** named **BACKUP_SCHEMA_V3**; **SR-SCHEMA-001**; UX-SAVE-001 |
| **IDs** | **Changed: FillRecord**, **FR-IMP-001**, **SR-SCHEMA-001**, **UX-SAVE-001**. **New named contract: FillDraft**, **BACKUP_SCHEMA_V3**. **DEC-DEFAULTS unchanged (still open)** |
| **How addressed** | Empty desired dose is allowed only on explicit `FillDraft` form state (not a `BackupEnvelope` entity). A persisted `FillRecord` requires finite `desiredDose > 0`. This does **not** decide live first-run HTML defaults. The single named target backup schema is **BACKUP_SCHEMA_V3** (`schemaVersion === 3`). FR-IMP-001 classifies `legacy-unversioned`, `legacy-versioned` (1–2), `current` (3), and `unknown-newer` (4+) and blocks apply until the documented migration gate (or Cancel). |

## Finding 3 — Recovery retention (one normative P0 policy)

| | |
| --- | --- |
| **Status** | Addressed in v1.2 |
| **Sections** | **§6.9 RecoverySnapshot**; **§7.2 FR-IMP-003**; **§10** (retention no longer an open policy); §8 P0.3; §9.2 import tests |
| **IDs** | **Changed: FR-IMP-003**, **UX-SYS-003**. **New model: RecoverySnapshot** |
| **How addressed** | One normative policy: **exactly one** current restore-point slot; **expiry = 168 hours** from `createdAt`; Restore uses only the current unexpired snapshot; an older snapshot MAY be replaced only as part of a confirmed Replace All / full apply, and **only after** the newer snapshot is durably written and verified readable. Quota failure aborts import and leaves the prior slot intact. §10 no longer asks implementers to pick a TTL. |

## Finding 4 — Export vs off-device sharing

| | |
| --- | --- |
| **Status** | Addressed in v1.2 |
| **Sections** | **§1** field-mark definition; **§6.8** rule 5; **FR-EXP-001**; FR-IMP-003 item 7; UX-SYS-003; **SR-PRIV-001** |
| **IDs** | **New: FR-EXP-001**. **Changed: FR-IMP-003**, **UX-SYS-003**, **SR-PRIV-001**, “prohibited from leaving device” mark |
| **How addressed** | Distinguishes (a) **explicit user-initiated local JSON file export** — allowed in P0 only with the plaintext-sensitive-data warning — from (b) **app-initiated network egress / cloud sharing / sync** — Serious-gated (DEC-REM / DEC-CLOUD / encryption) and **not in P0**. Does not add network sharing. Resolves the prior conflict between “unencrypted backup contents shared externally require Serious” and “warn before export or share.” |

## Finding 5 — Durable artifact references

| | |
| --- | --- |
| **Status** | Addressed in v1.2 |
| **Sections** | §1 document control; **§13 Deliverable index**; this matrix header; [PRODUCT_SPEC_V1_SUMMARY.md](./PRODUCT_SPEC_V1_SUMMARY.md); [README.md](./README.md) |
| **IDs** | Documentation only (no new FR-*) |
| **How addressed** | Every doc pins gist revision `4a801d7702857203161960f7fd6691013ffa431b` (durable URL includes that SHA). Canonical links are repository-relative `docs/` files plus Issue #2 / PR #3 review URLs. Spec v1 review is https://github.com/lotustemplar/peptide-calculator-v2/issues/2#issuecomment-5588921595. Ephemeral agent working copies outside the repo are labeled non-authoritative and are not cited as paths. |

---

# Part B — Historical Spec v1 findings (v1.1; still in force)

## Finding 1 — Data model / lifecycle

| | |
| --- | --- |
| **Status** | Addressed in v1.1; tightened in v1.2 |
| **Sections** | **§6 Canonical data model**; field lifecycle marks in §1; SR-SCHEMA-001; P0.3 |
| **IDs** | `BackupEnvelope`, `FillRecord`, `FillDraft`, `MedicationIdentity`, `ScheduleSeries`, `OccurrenceRecord`, `NotificationPortState`, `SettingsRecord`, `RecoverySnapshot` |
| **How addressed** | Plain-language + typed-contract tables; stable IDs; timestamps; unit fields; active/archived; deletion/cascade; marks **authoritative \| derived \| optional \| migrated \| prohibited from leaving device** (network/cloud sense). |

## Finding 2 — Occurrence model P0

| | |
| --- | --- |
| **Status** | Addressed in v1.1; implementable detail added in v1.2 (Part A finding 1) |
| **Sections** | §6.5; FR-SCH-000; UX-SCH-001/004; P0.OCC |
| **IDs** | **FR-SCH-000** (P0). **FR-SCH-001** (P1 extensions). **UX-SCH-001**, **UX-SCH-004** |
| **How addressed** | Minimal occurrence identity/state is P0 before Taken/Undo. v1.2 adds composite uniqueness, deterministic materialization, immutable depletion amount/unit, and atomic writer tests. |

## Finding 3 — Units / syringe

| | |
| --- | --- |
| **Status** | Addressed in v1.1 (unchanged in v1.2) |
| **Sections** | §5; §6.2; FR-UNIT-001 / FR-SYRINGE-001; UX-WIZ-010 / UX-RES-001; P0.UNIT; DEC-UNIT + DEC-SYRINGE |
| **IDs** | **FR-UNIT-001, FR-SYRINGE-001, DEC-SYRINGE**, **DEC-UNIT** |
| **How addressed** | Same-unit invariant; no mg↔mcg until DEC-UNIT + tests; never IU↔mass; U-100 marks only after explicit calibration; otherwise mL only. |

## Finding 4 — Defaults Serious

| | |
| --- | --- |
| **Status** | Addressed in v1.1; persist-vs-form split clarified in v1.2 (Part A finding 2) |
| **Sections** | §3.1 Defaults FACT; DEC-DEFAULTS; §6.2.1 FillDraft |
| **IDs** | **DEC-DEFAULTS** (Serious; **still open**) |
| **How addressed** | Live 30/3/1/3 = characterization only; not approved target. Recommended form target = empty desired-dose; no therapeutic chips. v1.2 forbids persisting an empty `FillRecord.desiredDose` without deciding the live default. |

## Finding 5 — RxNorm privacy

| | |
| --- | --- |
| **Status** | Addressed in v1.1 (unchanged in v1.2) |
| **Sections** | §6.3; SAF-NORM-001; SR-PRIV-001; DEC-NORM-REMOTE |
| **IDs** | **SAF-NORM-001**, **DEC-NORM-REMOTE**, **SR-PRIV-001** |
| **How addressed** | Default = offline/local dictionary. Remote = Serious. No batch full med list. |

## Finding 6 — Backup rollback + disclosure

| | |
| --- | --- |
| **Status** | Addressed in v1.1; retention + export split tightened in v1.2 (Part A findings 3–4) |
| **Sections** | UX-SYS-002/003; FR-IMP-002/003; FR-EXP-001; §6.9 |
| **IDs** | **FR-IMP-002, FR-IMP-003, FR-EXP-001** |
| **How addressed** | Validate+preview without mutation; one-slot recovery with 168-hour expiry and write-before-replace; collision + quarantine; local-export warning; no P0 network share. |

## Finding 7 — Platform matrix

| | |
| --- | --- |
| **Status** | Addressed in v1.1 (unchanged in v1.2) |
| **Sections** | §2.1–2.2; SR-PLAT-001; FR-REM-001; DEC-REM |
| **IDs** | **SR-PLAT-001** |
| **How addressed** | Static web + Median Android supported; iOS uncommitted; reminder promise tied to DEC-REM. |

## Finding 8 — Calculator input domain

| | |
| --- | --- |
| **Status** | Addressed in v1.1 (unchanged in v1.2) |
| **Sections** | FR-CALC-010; FR-CALC-001 legacy-evidence; FR-CALC-003 |
| **IDs** | **FR-CALC-010**, **FR-CALC-001**, **FR-CALC-003** |
| **How addressed** | Finite positive domain; dose ≤ vial same unit; no fabricated options; goldens labeled legacy evidence. |

---

## Confirmation checklist (v1.2 re-review)

| Finding (v1.1 re-review) | Addressed in this matrix | Spec v1.2 contains fix |
| --- | ---: | ---: |
| 1 Occurrence identity + depletion snapshot | Yes | Yes — §6.5, FR-SCH-000 |
| 2 FillDraft vs FillRecord + BACKUP_SCHEMA_V3 | Yes | Yes — §6.2, §6.2.1, FR-IMP-001 |
| 3 One-slot 168-hour recovery policy | Yes | Yes — §6.9, FR-IMP-003; §10 not a choice |
| 4 Local export vs network share | Yes | Yes — FR-EXP-001, §6.8, SR-PRIV-001 |
| 5 Durable pins and docs/ links | Yes | Yes — §1, §13, this file, SUMMARY, README |

**All five v1.1 re-review blockers are addressed.** Historical v1 findings 1–8 remain in force. No application code, config, backend, workflows, or `*-fix.js` were modified. **DEC-DEFAULTS remains undecided.**
