# FitGen Product Spec v1.2 — handoff summary

**Issue:** [#2](https://github.com/lotustemplar/peptide-calculator-v2/issues/2) · **Draft PR:** [#3](https://github.com/lotustemplar/peptide-calculator-v2/pull/3) · **Date:** 2026-09-08  
**Evidence SHA:** `4741e6f227676ff5c0f511edf173ecc03bc298df`  
**Author:** Atlas (consolidation) · **Mode:** docs-only · **Status:** Revised for Codex v1.1 re-review  
**Spec revision:** **v1.2**  
**Pinned gist rev:** [`4a801d7702857203161960f7fd6691013ffa431b`](https://gist.github.com/lotustemplar/6b7c927411da24208219cd1dba53e599/4a801d7702857203161960f7fd6691013ffa431b)  
**Prior gist rev (Codex-reviewed v1):** `7963e44e0ee0757c13f51d554250db2aa8e46b2b`

## Outcome

Amended Product Spec v1.1 → **v1.2** to resolve Codex’s **5 blocking findings** on PR #3 head `09e563a7fbe51cf64105a48eaebfdb37dff8324c` ([review](https://github.com/lotustemplar/peptide-calculator-v2/pull/3#pullrequestreview-5145040134)). Spec v1 findings 1–8 remain addressed. FitGen remains a **planner/measurement calculator** for user-entered reconstitutions and schedules — **not** clinician CDS, **not** dose advice, **not** interaction screening near-term (Aegis posture **B**).

**DEC-DEFAULTS is still open.** Live production first-run values are unchanged and not approved as Spec target. No Filipe decision is required for this docs amendment.

Response matrix: [docs/CODEX_RESPONSE_MATRIX.md](./CODEX_RESPONSE_MATRIX.md).

## ADR (unchanged)

**Incremental TypeScript/ES modules** behind existing DOM/CSS. **Reject** framework rewrite. Rollback: keep `app.js`, tag `pre-modules`, additive named `schemaVersion`.

## Platform + intended user

- **Intended user:** person managing their own reconstitution/draw planning (not clinician CDS).
- **Supported v1 baseline:** static web app + Median-wrapped Android.
- **iOS:** unsupported/uncommitted unless separately approved.
- Reminder platform promise tied to **DEC-REM** only.

## Med-safety posture (Aegis B)

**B) Name-normalization only** near-term.  
**Default:** offline/local bundled/subset dictionary (`SAF-NORM-001`).  
**Remote RxNorm/API:** Serious → **DEC-NORM-REMOTE**.  
**Out of scope:** DDI/allergy engines, dose advice. Never infer safety from missing data.

## v1.1 re-review findings → v1.2

| Finding | Fix |
| --- | --- |
| 1 | **§6.5 / FR-SCH-000:** unique `(scheduleId, localCivilDate)` identity; deterministic lookup/materialization; immutable `appliedDepletionAmount` + `appliedDepletionUnit`; Taken/Undo + depletion = one atomic writer; tests for rematerialization, double-tap, edit-dose-then-Undo, failed persist |
| 2 | **§6.2 / §6.2.1 / FR-IMP-001:** empty desired dose is `FillDraft` only; persisted `FillRecord.desiredDose` must be finite `> 0`; named target **BACKUP_SCHEMA_V3** (`schemaVersion === 3`) with legacy/unversioned/newer classification gate. Does not resolve DEC-DEFAULTS |
| 3 | **§6.9 / FR-IMP-003:** one restore-point slot; expiry **168 hours**; replace only after newer snapshot is durably written and verified; §10 no longer leaves retention as an open policy |
| 4 | **FR-EXP-001 / §6.8 / SR-PRIV-001:** user-initiated local JSON export allowed with plaintext warning; app-initiated network/cloud share is Serious-gated and **not in P0** |
| 5 | Pinned gist rev `4a801d7702857203161960f7fd6691013ffa431b` in all four docs; canonical links are repository `docs/` + Issue #2 / PR #3 URLs |

## P0 backlog (unchanged sequencing)

| # | Slice | Filipe? |
| --- | --- | --- |
| P0.0 | CI + lockfiles + no-new-`*-fix.js` + forbidden-copy grep | No |
| P0.1 | Dual-path goldens as **legacy evidence** + FR-CALC-010 domain | No |
| P0.2 | Single Generate path | **Yes** (DEC-FORMULA) |
| P0.3 | Persistence writer; import preview + one-slot recovery + local-export warning | Prefer no math change |
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

## Full Spec + specialist deliverables

- **Full Spec v1.2:** [docs/PRODUCT_SPEC_V1.md](./PRODUCT_SPEC_V1.md)
- **Response matrix:** [docs/CODEX_RESPONSE_MATRIX.md](./CODEX_RESPONSE_MATRIX.md)
- **Pinned gist:** https://gist.github.com/lotustemplar/6b7c927411da24208219cd1dba53e599/4a801d7702857203161960f7fd6691013ffa431b
- Codex Spec v1 review: https://github.com/lotustemplar/peptide-calculator-v2/issues/2#issuecomment-5588921595
- Codex Spec v1.1 re-review: https://github.com/lotustemplar/peptide-calculator-v2/pull/3#pullrequestreview-5145040134
- Mira UX (+ §10): https://gist.github.com/lotustemplar/53412d64afc1ab3e521e3917dd44e1be
- Sage / Sentinel / Aegis / CoS: Issue #2 comments (unchanged anchors)

Ephemeral agent working copies outside this repository are **non-authoritative**.

## Next owner

**Codex** — re-review Spec v1.2 against the response matrix and PR #3. Forge remains read-only until approval + decisions for blocking Serious stubs.
