# P0.UX tests

This directory tests Spec v1.2 **P0.UX** wizard/cabinet confirms and Taken/Undo
wiring to the FR-SCH-000 writer in `src/occ/`.

Production logic lives in `src/ux/`. The browser IIFE is generated as
`src/ux/p0-ux.browser.js` and loaded before `app.js`.

```bash
npm test
npm run ci
node scripts/ux/emit-browser.js
node scripts/ux/browser-smoke.js
```

`browser-smoke.js` is optional real-Chrome CDP coverage (not part of `npm test`).
It requires a running static server on port 4173 and system Google Chrome.

Issue #26 chrome capture / PNG raster (also not part of `npm test`):

```bash
node scripts/ux/stage2-chrome-capture.js --icons
node scripts/ux/stage2-chrome-capture.js --shots before
node scripts/ux/stage2-chrome-capture.js --shots after
```

Issue #30 Stage 4 tab `aria-current` regression (part of `npm test`):

```bash
node scripts/ux/stage4-tab-aria-test.js
```

Issue #30 Stage 4 shell/nav evidence (also not part of `npm test`):

```bash
node scripts/ux/stage4-shell-capture.js --shots before
node scripts/ux/stage4-shell-capture.js --shots after
```

Issue #32 Stage 5 medications / chips (unit tests are part of `npm test`):

```bash
node scripts/ux/stage5-meds-test.js
node scripts/ux/stage5-load-test.js
node scripts/ci/stage5-chips-test.js
node scripts/ux/stage5-chips-capture.js --shots before
node scripts/ux/stage5-chips-capture.js --shots after
```

Issue #34 Stage 6b.3 cabinet accordion / Due Today banner evidence (also not part of `npm test`):

```bash
node scripts/ux/stage6b3-ui-polish-capture.js --shots after
```

Issue #34 Stage 6c-B1 CSS parity evidence (also not part of `npm test`):

```bash
node scripts/ux/stage6c-b1-css-capture.js --shots after
```
