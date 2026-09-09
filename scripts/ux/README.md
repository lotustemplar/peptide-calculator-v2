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
