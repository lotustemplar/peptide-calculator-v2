# P0.0 CI quality gates

This directory implements Spec v1.2 **P0.0** / **SR-CI-001**, **SR-CI-002**, and the
CI slice of **SAF-COPY-001**. It does not change calculator, reminder, or backend
behavior.

Required PR check path: `.github/workflows/ci.yml` (`on: pull_request`).
`.github/workflows/keep-alive.yml` is schedule-only and must **not** be a
required PR check. This workflow must **not** use `pull_request_target`.

## Local commands

From the repository root, Node 20.x:

```bash
git fetch origin main
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

## Base-ref behavior

Changed-file lint and allowlist freeze compare **PR head** to the merge-base /
PR base (`FITGEN_CI_BASE_REF`, default `origin/$GITHUB_BASE_REF` or
`origin/main`).

On GitHub Actions (`pull_request`):

1. Checkout the PR head (`contents: read` only).
2. `git fetch origin $GITHUB_BASE_REF` (the base repository `main`, not a
   privileged `pull_request_target` checkout).
3. Gates read allowlists and changed paths from that base ref.

Local / self-test fallback:

- `FITGEN_CI_BASE_ROOT` — directory treated as the base tree (deterministic
  fixture; used by `gate-selftest.js`).
- `FITGEN_CI_ALLOW_MISSING_BASE=1` — skip base resolution (emergency local use
  only; CI must resolve the base).
- `FITGEN_CI_LINT_FILES` — newline-separated explicit lint targets (self-tests).

If a gate allowlist file is **absent on the base** (first introduction of P0.0),
the freeze is skipped for that file. After these files exist on `main`, a later
PR cannot add or broaden exceptions.

Removals remain allowed (patch retirement / P0.6 copy rewrite).

## Gates

| Gate | Script | Fails when |
| --- | --- | --- |
| Lockfiles | `check-lockfiles.js` | `package-lock.json` or `backend/package-lock.json` is missing |
| Lint | `check-lint.js` | ESLint fails on `scripts/` or on changed/new JS/CJS/MJS outside the legacy-path allowlist; a new `.ts`/`.tsx` file fails closed until Issue #9 |
| No new `*-fix.js` | `check-no-new-fix-js.js` | A new `*-fix.js` / `*-fixes.js` exists, or the fix-js allowlist gained a row versus base |
| Forbidden copy | `check-forbidden-copy.js` | A new clearance/clinical/MED-FLAG match is not bound to an exact baseline context, or the copy allowlist gained a row versus base |
| Test runner | `scripts/test.js` | Gate self-tests fail |

Calculator golden fixtures are **not** in this slice (P0.1 / Issue #5). The
runner is intentionally minimal and currently executes gate self-tests only.

## Allowlist rationale

Content and lint-skip lists are **forward-looking**. Pre-existing matches on
`main` (`4741e6f`) are allowlisted so P0.0 can land without a live copy rewrite
(P0.6 / UX-COPY-001). Head allowlists are frozen against the PR base.

### `allowlists/runtime-fix-js.txt`

Every `*-fix.js` / `*-fixes.js` file already on `main`, including unloaded
patches and `runtime-fixes.js`. Adding a new matching file fails CI. Adding a
new allowlist row versus the PR base also fails CI.

### `allowlists/forbidden-copy.json`

Each exception is bound to **one exact normalized line** (`context`) plus
`file` + `patternId`. A different “Recommended” (or any other token) in the
same file does **not** consume that exception.

Pre-existing MED-FLAG / clinical-adjacent strings already on `main`:

- results **Recommended** badge/heading (`index.html`, `app.js`, `runtime-fixes.js`)
- **Saved prescriptions**, **how much to take**, **safety-first**, **usually preferred**
- reminder **Take … and draw** payloads (literal amounts or `${…}` interpolation)
- non-clinical `MEDIAN_SETUP.md` “Recommended stack”

`docs/` is excluded so the Spec record can discuss forbidden phrases without
tripping the live-copy gate. `scripts/ci/` is excluded so the gate source can
name the phrases.

### `allowlists/legacy-lint-paths.txt`

Grandfathered application/backend JS already on `main`. Changed-file lint skips
these so P0.0 does not rewrite legacy code. New **JS/CJS/MJS** is linted with
parser settings split by runtime:

- `scripts/**`, `backend/**`, `*.cjs`, `eslint.config.js` → CommonJS + Node
- `*.mjs` and other new `*.js` (for example `src/`) → `sourceType: "module"`

TypeScript/TSX is **not** linted in P0.0. A new `.ts`/`.tsx` file fails closed
until typed linting lands ([Issue #9](https://github.com/lotustemplar/peptide-calculator-v2/issues/9)).
Adding a path to this list versus the PR base fails CI.

## How to see a failing check

On this branch, after `npm ci --ignore-scripts` and `git fetch origin main`:

```bash
# New runtime patch (must fail)
touch brand-new-fix.js
node scripts/ci/check-no-new-fix-js.js
rm brand-new-fix.js

# Changed-file lint outside scripts/ (must fail)
mkdir -p src
printf 'debugger;\n' > src/probe.js
FITGEN_CI_LINT_FILES=src/probe.js FITGEN_CI_SKIP_SCRIPTS=1 node scripts/ci/check-lint.js
rm -rf src
```

Valid JS/CJS/MJS fixtures (must pass) and a fail-closed TypeScript probe are
covered by `gate-selftest.js`.

The self-tests in `gate-selftest.js` create temporary fixtures (removed in
`finally`) for failure cases, including allowlist-bypass attempts, relocated
forbidden copy, lowercase recommended, literal Take/draw, and every pattern ID.

A PR that adds `*-fix.js`, new forbidden copy, or a lint violation on a
non-legacy file should show a red **PR quality gates** check on the pull
request, not keep-alive.
