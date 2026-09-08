# P0.0 CI quality gates

This directory implements Spec v1.2 **P0.0** / **SR-CI-001**, **SR-CI-002**, and the
CI slice of **SAF-COPY-001**. It does not change calculator, reminder, or backend
behavior.

Required PR check path: `.github/workflows/ci.yml` (`on: pull_request`).
`.github/workflows/keep-alive.yml` is schedule-only and must **not** be a
required PR check.

## Local commands

From the repository root, Node 20.x:

```bash
npm ci --ignore-scripts
npm ci --prefix backend
npm run lint
npm run ci:no-new-fix
npm run ci:forbidden-copy
npm test
```

`npm run ci` runs the same sequence after lockfiles exist.

CI installs **from lockfiles**:

- root: `npm ci --ignore-scripts` (skips the deploy `postinstall` that runs a
  second backend install)
- backend: `npm ci --prefix backend`

## Gates

| Gate | Script | Fails when |
| --- | --- | --- |
| Lockfiles | `check-lockfiles.js` | `package-lock.json` or `backend/package-lock.json` is missing |
| Lint | `npm run lint` (`eslint scripts`) | ESLint reports a violation in `scripts/` |
| No new `*-fix.js` | `check-no-new-fix-js.js` | A `*-fix.js` or `*-fixes.js` file exists outside the allowlist |
| Forbidden copy | `check-forbidden-copy.js` | A new clearance/clinical/MED-FLAG match is not allowlisted |
| Test runner | `scripts/test.js` | Gate self-tests fail |

Calculator golden fixtures are **not** in this slice (P0.1 / Issue #5). The
runner is intentionally minimal and currently executes gate self-tests only.

## Allowlist rationale

Both content gates are **forward-looking**. Pre-existing matches on `main`
(`4741e6f`) are allowlisted so P0.0 can land without a live copy rewrite
(P0.6 / UX-COPY-001).

### `allowlists/runtime-fix-js.txt`

Every `*-fix.js` / `*-fixes.js` file already on `main`, including unloaded
patches (`native-reminder-fix.js`, `settings-fix.js`, …) and `runtime-fixes.js`.
Adding a new matching file fails CI. Do not add allowlist rows to land a new
runtime patch.

### `allowlists/forbidden-copy.json`

Pre-existing MED-FLAG / clinical-adjacent strings already on `main`:

- results **Recommended** badge/heading (`index.html`, `app.js`, `runtime-fixes.js`)
- **Saved prescriptions**, **how much to take**, **safety-first**, **usually preferred**
- reminder **Take ${…} and draw** payloads
- non-clinical `MEDIAN_SETUP.md` “Recommended stack”

`docs/` is excluded so the Spec record can discuss forbidden phrases without
tripping the live-copy gate. `scripts/ci/` is excluded so the gate source can
name the phrases.

Do **not** add an allowlist entry to introduce new user-facing clearance or
treatment-directive copy. P0.6 should remove the live string and then drop the
unused entry.

## How to see a failing check

On this branch, after `npm ci --ignore-scripts`:

```bash
# New runtime patch (must fail)
touch brand-new-fix.js
node scripts/ci/check-no-new-fix-js.js
rm brand-new-fix.js

# New forbidden clearance string (must fail)
printf "export const note = 'safe to combine';\n" > /tmp/fitgen-forbidden-probe.js
# Or add the same line under app.js, run the gate, then revert — do not commit it.
node scripts/ci/check-forbidden-copy.js
```

The self-tests in `gate-selftest.js` create temporary fixtures for those
failure cases and assert non-zero exit. `npm test` prints PASS/FAIL for each.

A PR that adds `*-fix.js` or new forbidden copy should show a red
**PR quality gates** check on the pull request, not keep-alive.
