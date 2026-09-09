# SCHEMA_MAP — both data generations (Stage 3)

Read-only map for Recovery Plan v1.1 Stage 3 / Issue #28.  
Synthetic fixtures only. **No real PHI.** This document does not change formulas, units, or presentation.

Plan source: Issue #2 recovery plan; Stage 0 evidence in [`docs/evidence/baseline-rar-2026-08-16/`](../evidence/baseline-rar-2026-08-16/). Spec contract: Product Specification v1.2 **BACKUP_SCHEMA_V3** (`schemaVersion === 3`), FR-IMP-001..003, FR-PERS-001, FR-EXP-001.

## Generations

| Generation | Identity | Shape |
| --- | --- | --- |
| Baseline rebuild | localStorage key `fitgen-peptide-rebuild-v1` | Single envelope `{ fills, histories, activeView, lastReminderDigestDate }` |
| GitHub `main` | Multi-keys + P0.UX envelope `peptide-calculator-v2-p0ux-store` + OCC `peptide-calculator-v2-occurrences` | Coupled fills / schedules / occurrences / medications via one envelope `setItem`; legacy keys are mirrors |

Stage 3 **never** `setItem`s or `removeItem`s `fitgen-peptide-rebuild-v1`. Import writes only the GitHub-generation keys listed below.

## GitHub-generation keys (writable)

| Key | Role |
| --- | --- |
| `peptide-calculator-v2-p0ux-store` | Canonical envelope `{ version: 1, fills, schedules, occurrences, medications }` — FR-PERS-001 writer |
| `peptide-calculator-v2-fills` | Legacy mirror |
| `peptide-calculator-v2-schedules` | Legacy mirror |
| `peptide-calculator-v2-occurrences` | OCC mirror |
| `peptide-calculator-v2-medications` | Best-effort mirror after the envelope commit |
| `peptide-calculator-v2-recovery-slot` | FR-IMP-003 one restore-point slot |
| `peptide-calculator-v2-recovery-slot-pending` | Write+verify staging for the slot |

## Baseline rebuild → BACKUP_SCHEMA_V3

Documented dual-read aliases. Mapping defaults are planner fields, not therapeutic advice.

| Baseline | GitHub store / v3 |
| --- | --- |
| `fills[].savedId` | `FillRecord.id` / `savedId` |
| `fills[].name` (or `fillName` / `label` / `peptideName`) | `displayName` / `name` |
| `fills[].vialAmount` (`vialMg`) | `vialAmount` |
| `fills[].waterMl` | `waterMl` |
| `fills[].unitLabel` | `unit` / `unitLabel` |
| `fills[].recommendedDoseAmount` (`doseAmount` / `desiredDose`) | `desiredDose` (must be finite `> 0` or the fill is quarantined) |
| `histories[]` `status=taken` + date | OCC `taken` **only** when the source fill also has a complete schedule (`intervalDays` + `reminderTime`/`timeOfDay` + `startDate`/`startCivilDate`). Schedule id `baseline-sched:{savedId}`. No depletion snapshots invented. Missing those schedule fields: taken history is quarantined (`taken-history-no-source-schedule`); **no** active series and **no** reminder. |
| `histories[]` `status=missed` | **Quarantined.** Not applied. Mark missed is out of Stage 3 |
| `activeView` | Quarantine/passthrough only (not a GitHub view write) |
| `lastReminderDigestDate` | Quarantine/passthrough only (reminders are out of Stage 3) |

Stage 3 does **not** invent `intervalDays`, `reminderTime`, or `startDate` when the rebuild envelope omits them. Partial schedule fields are quarantined as `incomplete-source-schedule`. `doseMl` is derived from source vial/water/dose only after those three schedule fields are present, so `app.js` `isValidSchedule` can keep a faithfully mapped row.

## GitHub backups → BACKUP_SCHEMA_V3

| Input | FR-IMP-001 class | Map |
| --- | --- | --- |
| Missing / non-integer `schemaVersion` | `legacy-unversioned` | Dual-read `fills` / `schedules` / `occurrences` / `medications` (v1/v2 `version` field is not `schemaVersion`) |
| `schemaVersion` 1 or 2 | `legacy-versioned` | Same GitHub dual-read |
| `schemaVersion === 3` | `current` | Prefer `entities.*`, fall back to top-level arrays |
| `schemaVersion` ≥ 4 | `unknown-newer` | **Do not apply as v3** |

Unknown fields (example fixture: `rxCui`) are kept on the entity object (passthrough) and listed in the quarantine summary. They are not silently stripped.

P0.UX envelope `{ version: 1, fills, schedules, occurrences, medications? }` is GitHub-generation, still `legacy-unversioned` until exported as `schemaVersion: 3`. Medications belong in that envelope JSON so reload cannot observe new fills with old medications.

## Export dual-read (non-stranding)

`BACKUP_SCHEMA_V3` files write **both**:

- Spec `entities` (`FillRecord` / `ScheduleSeries` / OCC / medications / settings)
- Top-level `fills` / `schedules` / `occurrences` / `medications` in the current GitHub store shape

A reverted pre-Stage-3 importer that only reads top-level arrays can still load the file. Nested-only newer files are `unknown-newer` and blocked.

## Duplicate policy

- Default **Skip existing**: keep local IDs (`savedId` / schedule `id` / OCC `(scheduleId, localCivilDate)` / medication `id`); append new rows.
- Optional **Replace All**: confirmed destructive swap of GitHub-generation collections only.
- Cancel / blocked preview: zero writes.

## Recovery slot

Exactly one slot. `expiresAt = createdAt + 168 hours`. Newer snapshot is written to `-pending`, verified, then copied to the live slot. Quota/verify failure aborts with **no** GitHub mutation; a prior unexpired slot stays. Restore never touches the baseline key.
