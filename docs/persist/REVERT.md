# Revert path — Stage 3 import safety

Issue #28 / Recovery Plan v1.1 Stage 3. Revert must **not strand either generation**.

## What this PR adds

- Additive `src/persist/` modules and tests
- `BACKUP_SCHEMA_V3` export/import mapping
- One GitHub-generation recovery slot (`peptide-calculator-v2-recovery-slot`)
- Backup-card restore control + export plaintext warning (no Stage 4 nav shell)

It does **not** migrate, overwrite, or delete `fitgen-peptide-rebuild-v1`.

## Revert the code

1. Do not merge until Codex `[REVIEW]` and Filipe ask.
2. To undo after merge: revert this PR (or reset the feature branch). `app.js` calculator, OCC Taken/Undo, and P0.UX `commitAppState` remain the GitHub spine.
3. Do **not** ship a “cleanup” that removes `fitgen-peptide-rebuild-v1`. Absence of this PR’s writer is enough; the rebuild key is untouched.

## GitHub-generation data after revert

- Live fills/schedules/OCC stay in `peptide-calculator-v2-p0ux-store` (and mirrors). Pre-Stage-3 `readAppState` still loads them.
- Stage 3 exports include **top-level** `fills` / `schedules` / `occurrences` / `medications` plus `schemaVersion: 3`. Old `importData()` reads those arrays and merge-skips by id. Users are not stranded on nested `entities` alone.
- Leftover `peptide-calculator-v2-recovery-slot` / `-pending` keys are ignored by old code. They may be left in place; they are not the baseline envelope.

## Baseline rebuild data after revert

- `fitgen-peptide-rebuild-v1` is still present if it was present before.
- Stage 3 never wrote that key, so revert cannot have deleted it.
- A rebuild-lineage app that reads only that envelope continues to see its `{ fills, histories, activeView, lastReminderDigestDate }` snapshot.

## Coexistence

Both keys may exist on one device. Import/replace/restore in this stage update **only** GitHub-generation keys. Blind overwrite of one envelope with the other is out of scope and unsafe.

## Not in this revert story

- Mark missed (quarantined on baseline histories; not applied)
- Reminder digest / native reminder architecture
- Encryption
- Destructive deletion of either generation
