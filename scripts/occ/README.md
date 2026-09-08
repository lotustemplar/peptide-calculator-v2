# P0.OCC occurrence model tests

This directory tests Spec v1.2 **P0.OCC** / **FR-SCH-000** / **§6.5**.

The production module lives in `src/occ/` (typed OccurrenceRecord identity + a
narrow atomic occurrence+depletion writer). These tests compile that TypeScript
with the repo `typescript` package and do **not** load `app.js` or change
legacy `takenDates` writers.

## What is locked

- One logical record per `(scheduleId, localCivilDate)`; lookup before create
- Surrogate `id` assigned once and reused after calendar rebuild / restart
- Taken/Undo + fill depletion in one persist commit
- Double-tap Taken is a no-op
- Undo uses the stored snapshot, not a later `desiredDose` edit
- Persist failure retains pre-operation status and depletion
- Exact unit match only; mismatch or unsupported unit fail-closed
- Legacy `takenDates`: explicit recoverable dates only; no invented history

## Commands

From the repository root:

```bash
npm test
npm run ci
```

`scripts/test.js` runs this suite after P0.0 / P0.1 / P0.6.

## Out of scope

- P0.UX Taken/Undo UI
- Skip / Snooze / Reschedule
- Full P0.3 import/recovery
- DEC-UNIT conversion, calculator math, reminder sync
