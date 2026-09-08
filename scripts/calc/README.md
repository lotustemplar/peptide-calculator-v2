# P0.1 calculator legacy-evidence tests

This directory implements Spec v1.2 **P0.1** / **FR-CALC-001** and **FR-CALC-010**.

The snapshots are **legacy-evidence** of the two live calculator paths. They are
**not** target correctness oracles, therapeutic-dose oracles, or a
`DEC-FORMULA` winner.

## Paths under test

| Path | Production file | Current policy locked as evidence |
| --- | --- | --- |
| `app-js-water-step` | `app.js` | Water steps from 0.50 mL; min-draw **0.05** mL; 12 cards |
| `runtime-fixes-draw-target` | `runtime-fixes.js` | Clean draw targets from **0.10** mL in 0.05 steps; 18 cards; precision fallback |

The harness reads those files from the repo root and evaluates them in a Node
`vm` with a mock DOM. Production calculator formulas are **not** copied into
this directory and must not be edited to land these tests.

## Commands

From the repository root:

```bash
npm test
npm run ci
```

`scripts/test.js` runs P0.0 gate self-tests, then this suite.

To recapture goldens after an intentional evidence refresh (not a formula
change):

```bash
FITGEN_UPDATE_CALC_GOLDENS=1 node scripts/calc/legacy-evidence-test.js
```

Recapture is evidence-only. It does **not** approve new live numbers.

## Fixtures

- `fixtures/legacy-evidence-matrix.json` — mg/IU, syringe, and water cases for
  FR-CALC-001.
- `fixtures/legacy-evidence-goldens.json` — captured outputs for both paths.
- `fixtures/fr-calc-010-domain.json` — NaN / Infinity / ≤0, dose > vial, and
  impossible configs. Each case must reject with inline error / empty-state and
  **no** success options list.

## Out of scope

- Changing live reconstitution numbers, rounding, or min-draw policy
- Picking a single Generate path (P0.2 / DEC-FORMULA)
- Dose-advice / target-dose oracles
- MED-FLAG copy rewrite
