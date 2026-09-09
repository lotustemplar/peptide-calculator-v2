# STAGE2 — Issue #26 scan, tokens, and chrome evidence

**Issue:** [#26](https://github.com/lotustemplar/peptide-calculator-v2/issues/26)  
**Branch:** `grok/26-recovery-stage-2-assets`  
**Base:** `main` @ `9ee70a878aec1cefb85911e55e248184483a682b`  
**Risk:** Elevated (UI assets) — no Serious DEC  
**Gate:** [ALLOWLIST.md](./ALLOWLIST.md) (Codex #4: hashing ≠ publication safety)

This is **chrome/assets only**. Calculator form/results, formulas, persistence, reminders, Mark missed, packaging, and Stage 3+ are untouched.

## What this workspace could scan

The Aug-16 baseline extract remains **outside git** (Stage 0). This environment has no RAR/ZIP/extract, so baseline `icon.png` / wizard SVGs / `ui-reference.png` / baseline `styles.css` `:root` bytes were **not** available to copy.

Stage 2 therefore scanned **exact bytes proposed for this PR**, not the missing archive members.

## Proposed product files (fresh scan 2026-09-09)

| Path | Bytes | SHA-256 | Scan notes |
|------|------:|---------|------------|
| `icon.svg` (already on `main`) | 2791 | `b80e068d1878f23bf13640d58f08e9264f4391d88afac5cfbeb7eda2570b978c` | SVG xmlns only; no `<script>`, `foreignObject`, emails, secrets, PHI markers |
| `icon.png` | 14642 | `1a9e9223989e2c658498069c4df3b09612ba92b7a74c560fb0293826b43cfeef` | PNG IHDR/IDAT/IEND only; no eXIf/tEXt/iTXt; 192×192 RGB |
| `icon-192.png` | 14642 | `1a9e9223989e2c658498069c4df3b09612ba92b7a74c560fb0293826b43cfeef` | Same bytes as `icon.png` (192×192 raster) |
| `icon-512.png` | 62523 | `ad6931d4cc21a86227299ab86acda4f5e930556fa8aa22a55456b50b7964cfb0` | PNG IHDR/IDAT/IEND only; no eXIf/tEXt/iTXt; 512×512 RGB |
| `styles.css` token/chrome slice | 26517 | `55f5e965f72f4bc74a072cb84e8b46a5192f7aa7aaa9c8f2538bfadc13a3c7dd` | No secrets/PHI; no calculator builders. **Not** baseline `62ca986b…` |
| `index.html` head chrome only | 19867 | `8b1691849f524e53d089c9ad844b352a418309e77cc4ac25b5245221f9cb97c3` | Calculator form IDs unchanged; `viewport-fit=cover` + PNG icon links |
| `manifest.webmanifest` | 761 | `6bfdf1094430af3a7a1d44cc1335ea78ea992f1d48cedd33d56312fbd4f42f88` | Adds PNG icon entries; theme/background colors already on `main` |

**Provenance of new PNGs:** rasterized in this workspace from the already-published FitGen shield `icon.svg` (git `46f8092`, Filipe) onto canvas `#f4efe6` (`manifest.webmanifest` `background_color` / `--fitgen-canvas`). These are **not** claimed to be byte-identical to the Aug-16 baseline PNG set.

**License:** project-owned mark already in this public repository. No third-party raster from the extract was copied.

**Denied / not present:** `peptide-app-phone-qr.png`; baseline wizard SVGs; `assets/{vial,syringe,dose}-step.png`; `assets/ui-reference.png`; baseline `app.js` / full `styles.css`; any `*-fix.js`.

## Token slice (behavior-neutral)

Added to GitHub `:root` (did **not** replace the file with baseline `styles.css`):

- Type: `--font-ui`, `--font-display` (existing IBM Plex Sans / Sora)
- FitGen install colors already in the PWA manifest: `--fitgen-canvas` `#f4efe6`, `--fitgen-theme` `#0f766e`, `--fitgen-theme-rgb`
- Spacing: `--space-1`…`--space-4`; `--space-safe-*` from `env(safe-area-inset-*)` (plan v1.1 §6 note that baseline CSS handled safe-area)

**Applied only to chrome:** `.app-shell` padding, `.app-header` / `.brand-mark` / `.tab-button.is-active` teal, mobile `.tabbar` safe-area, `.brand-copy h1` display font. Dark default theme is unchanged (a full light-theme flip would be a major visual redesign / Serious).

**Not applied:** calculator form layout, result cards, option ranking, copy, persistence keys.

## Screenshots

Header and tabbar crops only (no real user data; default product chrome). PNG metadata chunks: none.

| Before (`main`) | After (this PR) |
|-----------------|-----------------|
| `docs/evidence/stage-2-chrome/before-desktop-header.png` | `docs/evidence/stage-2-chrome/after-desktop-header.png` |
| `docs/evidence/stage-2-chrome/before-desktop-tabbar.png` | `docs/evidence/stage-2-chrome/after-desktop-tabbar.png` |
| `docs/evidence/stage-2-chrome/before-mobile-header.png` | `docs/evidence/stage-2-chrome/after-mobile-header.png` |
| `docs/evidence/stage-2-chrome/before-mobile-tabbar.png` | `docs/evidence/stage-2-chrome/after-mobile-tabbar.png` |

Visible delta: header/tabbar active chrome shifts from cyan/violet toward FitGen theme teal `#0f766e`. PNG icons appear in the PWA/favicon set; in-page header still uses `icon.svg`.

## Golden / behavior freeze

These SHA-256 values are unchanged vs `main` @ `9ee70a8` / cores frozen at `270e0eb`:

| Path | SHA-256 |
|------|---------|
| `scripts/calc/fixtures/legacy-evidence-goldens.json` | `659c1865da95c3197395c931e154c4267c802d8aaf7842aee83345962d013acd` |
| `app.js` | `489cd7b88b90e00bd2a700518312577cf5a65cf12cacc003d9a181422606a537` |
| `runtime-fixes.js` | `dc390d5fa9f936effcdd9fc3a1fe85d5cf29ec6eb6b4a84da9636e5436624ca9` |
| `p0-ux-bind.js` | `128233084b5b8f2010baedd4e15d1022d726c6611aa5bfa8b76712edfb2830f4` |

No storage keys added or renamed. Rollback = revert this PR.

## Residual risks (Codex)

1. Baseline extract rasters were not available; PNG set is derived from in-repo SVG, not a byte-port of the Aug-16 icon files.
2. Baseline `:root` hex values were not available; tokens come from in-repo manifest + documented safe-area note, not from hashing baseline `styles.css`.
3. Existing GitHub `assets/Wizard-Step-*.png` are unchanged and remain the live wizard images (not newly wired).
4. Mobile tabbar crops can include adjacent wizard Cancel/Next pixels because those controls sit next to the sticky tabbar; those controls were not restyled in this PR.

## Tests

`scripts/ci/stage2-chrome-test.js` is invoked by `npm test` / `npm run ci`. Optional screenshot/raster helper: `node scripts/ux/stage2-chrome-capture.js` (not part of CI).
