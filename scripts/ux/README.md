# P0.UX tests

This directory tests Spec v1.2 **P0.UX** wizard/cabinet confirms and Taken/Undo
wiring to the FR-SCH-000 writer in `src/occ/`.

Production logic lives in `src/ux/`. The browser IIFE is generated as
`src/ux/p0-ux.browser.js` and loaded before `app.js`.

```bash
npm test
npm run ci
node scripts/ux/emit-browser.js
```
