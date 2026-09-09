# Stage 3 persist / import-safety tests

Typed modules live in `src/persist/`. They extend the P0.UX envelope writer
(`commitAppState`) and must not write `fitgen-peptide-rebuild-v1`.

Fixtures under `scripts/persist/fixtures/` are **synthetic** (names prefixed
`Synthetic …`). Do not add real backups, names, or dosing history.

```bash
npm test
npm run ci
node scripts/persist/persist-test.js
```

`scripts/test.js` runs this suite after P0.UX.

## What is locked

- FR-IMP-001 class gate (unversioned / 1–2 / 3 / ≥4)
- Baseline rebuild map vs GitHub multi-key / P0.UX / v3
- Preview without mutation; Cancel = no apply
- Skip existing vs confirmed Replace All
- One recovery slot; 168h expiry; write+verify before replace; quota abort
- Rollback; restart restore; current-slot-only after a second import
- Envelope atomic commit includes medications; mirrors are best-effort
- Baseline schedules mapped only from complete source interval/time/start
- Local-only export (native file bridge or download; no `navigator.share`)
- Round-trip; unknown-field passthrough; **no baseline key mutate/delete**

## Out of scope

- Stage 4 nav shell
- Mark missed (missed histories stay quarantined)
- Calculator math, reminders, packaging
