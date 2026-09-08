# [GROK] [REVIEW] FitGen Product Spec v1.1 — revised for Codex re-review

**Issue:** #2 · **Date:** 2026-09-08 · **Evidence SHA:** `4741e6f227676ff5c0f511edf173ecc03bc298df`  
**Author:** Atlas (consolidation) · **Mode:** read-only discovery · **Status:** Revised for Codex re-review  
**Spec revision:** **v1.1** · **Prior gist rev (Codex-reviewed):** `7963e44e0ee0757c13f51d554250db2aa8e46b2b`

## Outcome

Revised Product Spec v1 → **v1.1** to resolve Codex’s **8 blocking findings**. FitGen remains a **planner/measurement calculator** for user-entered reconstitutions and schedules — **not** clinician CDS, **not** dose advice, **not** interaction screening near-term (Aegis posture **B**).

Response matrix: `/workspace/fitgen-issue2/CODEX_RESPONSE_MATRIX.md`.

## ADR (unchanged)

**Incremental TypeScript/ES modules** behind existing DOM/CSS. **Reject** framework rewrite. Rollback: keep `app.js`, tag `pre-modules`, additive `schemaVersion`.

## Platform + intended user (Finding 7)

- **Intended user:** person managing their own reconstitution/draw planning (not clinician CDS).
- **Supported v1 baseline:** static web app + Median-wrapped Android.
- **iOS:** unsupported/uncommitted unless separately approved.
- Reminder platform promise tied to **DEC-REM** only.

## Med-safety posture (Aegis B) + Finding 5

**B) Name-normalization only** near-term.  
**Default:** offline/local bundled/subset dictionary (`SAF-NORM-001`).  
**Remote RxNorm/API:** Serious → **DEC-NORM-REMOTE** (minimization, consent, retention/logging, timeout→unknown, no batch full med list).  
**Out of scope:** DDI/allergy engines, dose advice. Never infer safety from missing data.

## Key Spec v1.1 additions

| Finding | Fix |
| --- | --- |
| 1 | **§6 Canonical data model** (BackupEnvelope, Fill, MedicationIdentity, ScheduleSeries, Occurrence, NotificationPort, Settings) with authoritative/derived/optional/migrated/prohibited marks |
| 2 | **FR-SCH-000** P0 occurrence model; Taken/Undo gated behind it; Skip/Snooze/Reschedule stay P1 on FR-SCH-001 |
| 3 | **DEC-UNIT** vs **DEC-SYRINGE**; **FR-UNIT-001** same shared unit; **FR-SYRINGE-001** U-100 only after calibration else mL only |
| 4 | **DEC-DEFAULTS** (Serious); empty desired-dose target; live 30/3/1/3 characterization only — **not** approved target |
| 5 | Local default normalization; **DEC-NORM-REMOTE**; P1 Filipe? column updated |
| 6 | **FR-IMP-002/003** + expanded UX-SYS-002/003: preview, recovery snapshot, TTL, collisions, quarantine, plaintext warning, rollback tests |
| 7 | Platform matrix in product intent + **SR-PLAT-001** |
| 8 | **FR-CALC-010** input-domain safety; P0.1 goldens labeled **legacy evidence** |

## P0 backlog (updated)

| # | Slice | Filipe? |
| --- | --- | --- |
| P0.0 | CI + lockfiles + no-new-`*-fix.js` + forbidden-copy grep | No |
| P0.1 | Dual-path goldens as **legacy evidence** + FR-CALC-010 domain | No |
| P0.2 | Single Generate path | **Yes** (DEC-FORMULA) |
| P0.3 | Persistence writer; import preview + recovery snapshot/rollback | Prefer no math change |
| P0.4 | One reminder port (DEC-REM) | **Yes** |
| P0.5 | Backend CORS/auth lockdown | **Yes** |
| P0.6 | Docs/copy + MED-FLAG | No |
| P0.OCC | **FR-SCH-000** before Taken/Undo | No |
| P0.UX | Wizard/Save/Delete/Taken+Undo (**after P0.OCC**)/a11y | No |
| P0.UNIT | Shared unit + syringe gates (characterize until DEC) | **Yes** before conversion/U-100 target |
| P0.SAF | Lock B; unknown-state; block DDI/dose | Counsel before leaving B |
| P0.DEF | Do not change live defaults; do not approve as target | **Yes** (DEC-DEFAULTS) |

**Do not combine** P0.2 + P0.4 + P0.5. Taken/Undo cannot ship before FR-SCH-000.

## Decision stubs (14) — later `[DECISION]` issues

DEC-FORMULA, DEC-REM, DEC-CLOUD, DEC-FW (recommend no), **DEC-UNIT**, **DEC-SYRINGE**, **DEC-DEFAULTS**, **DEC-NORM-REMOTE**, DEC-DDI, DEC-CDS, DEC-COUNSEL, DEC-VENDOR, DEC-BOUNDARY, DEC-POP.

Safe defaults: do not change formulas; do not re-enable unauth sync; characterize units/U-100/defaults only; local-only normalization; stay on B.

## Requirement counts (approx.)

| Prefix | Notes |
| --- | --- |
| UX-* | Prior set retained; UX-SYS-002/003 expanded; SCH-001/004 gated on FR-SCH-000 |
| FR-* | +FR-SCH-000, FR-CALC-010, FR-UNIT-001, FR-SYRINGE-001, FR-IMP-002, FR-IMP-003 |
| SR-* | +SR-PLAT-001; SR-PRIV-001 notes remote norm |
| SAF-* | SAF-NORM-001 rewritten (local default) |
| §6 model | New canonical entities |

## Full Spec + specialist deliverables

- **Full Spec v1.1 (box):** `/workspace/fitgen-issue2/PRODUCT_SPEC_V1.md`
- **Response matrix:** `/workspace/fitgen-issue2/CODEX_RESPONSE_MATRIX.md`
- **Gist:** placeholder — re-publish after revision; prior rev `7963e44…` at https://gist.github.com/lotustemplar/6b7c927411da24208219cd1dba53e599
- Mira UX (+ §10): https://gist.github.com/lotustemplar/53412d64afc1ab3e521e3917dd44e1be
- Sage / Sentinel / Aegis / CoS: Issue #2 comments (unchanged anchors)
- Shared-box copies: `/workspace/fitgen-issue2/`

## Next owner

**Codex** — re-review Spec v1.1 against the response matrix. Forge remains read-only until approval + decisions for blocking Serious stubs.