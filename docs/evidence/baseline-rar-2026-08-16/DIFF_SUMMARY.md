# DIFF_SUMMARY — baseline rebuild vs GitHub `main` @ 270e0eb

Structural comparison only. **No medical, dosing, compatibility, or “which formula is right” claims.** Calculator goldens on `main` lock current outputs; they are not clinical truth.

Source: Recovery Plan v1.0 inventory + v1.1 stage locks (issue [#2](https://github.com/lotustemplar/peptide-calculator-v2/issues/2) comments [5595667320](https://github.com/lotustemplar/peptide-calculator-v2/issues/2#issuecomment-5595667320), [5595679011](https://github.com/lotustemplar/peptide-calculator-v2/issues/2#issuecomment-5595679011)).

## Generations

| | Baseline extract | GitHub `main` |
|--|------------------|---------------|
| Lineage | Aug 2026 rebuild | May–Sep lineage + P0 CI / OCC / UX |
| Identity pin | Cores hashed in [HASHES.md](./HASHES.md) | Same file @ `270e0eb` |
| Calculator option builder | Draw-candidate-first `buildOptions` (invents water from a preferred draw mL) | Water-first walk (`buildWaterOptions` 0.5…max in 0.05 steps → dose mL) |
| Persistence | Single envelope `fitgen-peptide-rebuild-v1` | Multi-keys + `peptide-calculator-v2-p0ux-store` + OCC |
| Loaded JS | `./app.js` only | `app.js` + real `runtime-fixes.js` + several allowlisted `*-fix.js` + P0 bind/bundle |
| `runtime-fixes.js` | 67 B stub | 48336 B real overlay |

Unified-diff scale from the planning pass (approximate): `app.js` ~3786 lines, `index.html` ~720, `styles.css` ~2259. Cores are **not** the same generation.

## Feature fork (presence, not quality)

| Capability | Baseline rebuild | GitHub `main` |
|------------|------------------|---------------|
| Reconstitution calculator | Present (draw-first options) | Present (water-first options) — **Serious** to change either path |
| Cabinet / saved fills | Present | Present |
| Separate medications list | Absent | Present |
| Schedule tracking | Histories on the fill | Schedules + `takenDates` + OCC |
| Calendar chrome | Month grid + day panel | Agenda / list entries |
| Mark taken | Present | Present (P0.UX + OCC) |
| Mark missed | Present | Different / limited model — **out of Stages 0–5** (`REQ-MISSED`) |
| Undo taken | Absent | Present (snackbar + OCC writer) |
| Wizard Back / Next | Present | Present |
| Wizard Cancel + discard confirm | Close control only | Cancel + P0.UX discard confirms |
| Name / amount suggestions | `peptide-list.js` orphan (unwired) | Longer list + patch file (verify live before relying) |
| Backup | v1 `{ version, state }` + native file hooks | Multi-entity export/import; P0.3 still open (#22) |
| Reminders | Daily digest + `FitGenNative.syncReminders` payload | Web timer + Median/OneSignal + backend hooks in `runtime-fixes.js` — architecture is **Serious** |
| CI / goldens / OCC / MED-FLAG | Absent | Present on `main` |
| Visual shell | Hero + bottom tabbar (Add / Schedule / Calendar / Cabinet); modal 4-step wizard; PNG step art | Same four views; inline 3-step wizard panes; evolved CSS + P0 affordances |

## Storage fork

- **Baseline:** one envelope. Fields named in the plan: `fills`, `histories`, `activeView`, `lastReminderDigestDate`. Import described as replacement-style. Migrates legacy `peptide-calculator-v2-fills` / `-schedules`.
- **GitHub:** separate medication / fill / schedule keys plus the atomic P0.UX envelope and occurrence records.
- **Rule (Stage 3, not this PR):** do not mutate or delete the baseline key. Blind overwrite can drop one generation.

## Formula fork (Serious — do not “fix” in recovery Stages 0–6)

Same user inputs can yield **different option sets** because the builders start from different variables (draw-first vs water-first). Stage 0 records that fork only. Changing formulas, units, rounding, ranking, emphasis, or calculation defaults requires a separate Serious DEC (Stage 7). Until then, keep tested `main` behavior and goldens.

## Files only on one side (high signal)

**Baseline-only (keep off git until allowlisted):** `archive/_tmp_*`, rebuild step PNGs / `ui-reference.png`, wizard SVGs, PNG icons, `peptide-app-phone-qr.png`.

**GitHub-only (retain unless a later retirement PR):** `.github/**`, `scripts/**`, `src/occ/**`, `src/ux/**`, `p0-ux-bind.js`, real `*-fix.js` suite, `backend/**`, lockfiles, collaboration docs.

## Integration spine (already decided; not implemented here)

Filipe Stage-1: recognizable baseline UI/IA on GitHub’s tested CI / OCC / Taken-Undo spine. Refine the original app; do not replace it with a different product. Stage 0 does not port assets or change runtime files.
