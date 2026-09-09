# STAGE2 — Issue #26 scan, tokens, and chrome evidence

**Issue:** [#26](https://github.com/lotustemplar/peptide-calculator-v2/issues/26)  
**Branch:** `grok/26-recovery-stage-2-assets`  
**Base:** `main` @ `9ee70a878aec1cefb85911e55e248184483a682b`  
**Risk:** Elevated (UI assets) — no Serious DEC  
**Gate:** [ALLOWLIST.md](./ALLOWLIST.md) (Codex #4: hashing ≠ publication safety)

This is **chrome/assets only**. Calculator form/results, formulas, persistence, reminders, Mark missed, packaging, and Stage 3+ are untouched.

Codex `[REVIEW]` on `1967d08` required chrome tokens from the independently verified baseline `styles.css` (SHA-256 `62ca986be8884628025f0e020edb1ab6810e3def4c7f89e63d2a2af4baedee3a`), **not** from `manifest.webmanifest`.

## Exact baseline-derived tokens (this PR)

Source: Codex-verified slice of baseline `styles.css` (file itself **not** committed). Applied as a GitHub `:root` chrome slice.

| Token | Value | Used on |
|-------|-------|---------|
| `--bg` | `#030504` | page chrome, theme-color, PWA background/theme |
| `--bg-deep` | `#050805` | page gradient end |
| `--green` | `#8ff11d` | dark-chrome accent (header/tabbar/eyebrow) |
| `--green-strong` | `#67d414` | dark-chrome gradient mix |
| `--radius-xl/lg/md/sm` | `34 / 26 / 18 / 14 px` | global radius tokens (header/tabbar use them) |
| `--tabbar-height` | `94px` | `.tabbar` |
| `--tabbar-offset` | `24px` | mobile sticky tabbar `bottom` |
| `--tabbar-glass` | dark `rgba(5, 8, 5, 0.78)` | tabbar fill |
| `--tabbar-line` / `--tabbar-glow` | neon line + glow | tabbar `::before` |

`--teal` / calculator form, result cards, and wizard Next remain on the existing GitHub teal path so option generation/ranking/copy are unchanged.

## Deferred / unavailable (explicitly not this PR)

| Item | Status |
|------|--------|
| Baseline UI font **Manrope** | **Deferred.** Loading it would add a new Google Fonts request. `--font-ui` stays `"IBM Plex Sans", sans-serif`. Documented in `styles.css`. |
| Baseline display font **Space Grotesk** | **Deferred.** Same reason. `--font-display` stays `"Sora", sans-serif`. |
| Baseline `icon.png` / `icon-192.png` / `icon-512.png` / baseline `icon.svg` bytes | **Unavailable.** Extract still outside git. Regenerated PNGs are **not** baseline copies. |
| Wizard SVGs, `assets/{vial,syringe,dose}-step.png`, `assets/ui-reference.png` | **Unavailable / not wired.** Existing GitHub `assets/Wizard-Step-*.png` unchanged. |
| Full baseline `styles.css` as executable source | **Denied** (ALLOWLIST). |

## Contrast / readability

WCAG relative-luminance ratios computed in `scripts/ci/stage2-chrome-test.js`:

| Pair | Ratio | Gate |
|------|------:|------|
| `#8ff11d` on dark `--bg` `#030504` | 14.37 | **Use** on dark chrome (AA text 4.5) |
| `#8ff11d` on light `--bg` `#eff2ec` | 1.26 | **Do not use** as light-chrome text/line-on-page |
| `--green-on-light` `#1f6b12` on light `--bg` | 5.86 | **Exception** for light header/tabbar/eyebrow |

Light theme is still hidden in product UI; the exception is encoded so a later enable does not paint unreadable neon on cream.

## Proposed product files (fresh scan 2026-09-09, post-Codex correction)

| Path | Bytes | SHA-256 | Scan notes |
|------|------:|---------|------------|
| `icon.svg` (already on `main`) | 2791 | `b80e068d1878f23bf13640d58f08e9264f4391d88afac5cfbeb7eda2570b978c` | SVG xmlns only; no `<script>`, `foreignObject`, emails, secrets, PHI markers |
| `icon.png` | 14471 | `034e7d929e81ceed217ec91a5a191451f0839cfe0cf6b672d5c729dd93c69a8e` | PNG IHDR/IDAT/IEND only; 192×192 on `#030504` |
| `icon-192.png` | 14471 | `034e7d929e81ceed217ec91a5a191451f0839cfe0cf6b672d5c729dd93c69a8e` | Same bytes as `icon.png` |
| `icon-512.png` | 60653 | `c583652045730c3e556bc7eae27d785c563618fdddbddc14369c2a8c47c86200` | PNG IHDR/IDAT/IEND only; 512×512 on `#030504` |
| `styles.css` chrome token slice | 28200 | `406a02e5134b550036c8353bcb70a2d17b05d1c57522139b5b93934bb9292dde` | **Not** baseline file `62ca986b…` |
| `index.html` head chrome | 19867 | `df950fd43f96bdf6e9a35d76e56e4f528abf86adf0d1da17e75464d7452bcdd0` | Form IDs unchanged; `theme-color` `#030504` |
| `manifest.webmanifest` | — | `7bfe6b655fa435385252f1acd67e4fee953ac54820d3022b943ff626cd7b4066` | PNG icons; background/theme `#030504` (aligned to baseline `--bg`, not a token *source*) |

**Provenance of PNGs:** rasterized from in-repo FitGen `icon.svg` (git `46f8092`) onto baseline `--bg` `#030504`. **Not** byte-identical to the Aug-16 extract icon set.

**Denied / not present:** `peptide-app-phone-qr.png`; baseline wizard rasters; baseline `app.js` / full `styles.css`; any `*-fix.js`.

## Screenshots

Header and tabbar crops. **Before** = `origin/main` chrome. **After** = this correction (baseline neon/dark glass). PNG metadata: none.

| Before (`main`) | After (baseline chrome tokens) |
|-----------------|--------------------------------|
| `docs/evidence/stage-2-chrome/before-desktop-header.png` | `docs/evidence/stage-2-chrome/after-desktop-header.png` |
| `docs/evidence/stage-2-chrome/before-desktop-tabbar.png` | `docs/evidence/stage-2-chrome/after-desktop-tabbar.png` |
| `docs/evidence/stage-2-chrome/before-mobile-header.png` | `docs/evidence/stage-2-chrome/after-mobile-header.png` |
| `docs/evidence/stage-2-chrome/before-mobile-tabbar.png` | `docs/evidence/stage-2-chrome/after-mobile-tabbar.png` |

Visible delta: GitHub cyan/violet chrome → baseline `#030504` glass + neon `#8ff11d` tabbar line/active pill. Wizard Next may still appear as adjacent teal in mobile tabbar crops; that control was not restyled (calculator form).

## Golden / behavior freeze

Unchanged vs `main` @ `9ee70a8` / cores frozen at `270e0eb`:

| Path | SHA-256 |
|------|---------|
| `scripts/calc/fixtures/legacy-evidence-goldens.json` | `659c1865da95c3197395c931e154c4267c802d8aaf7842aee83345962d013acd` |
| `app.js` | `489cd7b88b90e00bd2a700518312577cf5a65cf12cacc003d9a181422606a537` |
| `runtime-fixes.js` | `dc390d5fa9f936effcdd9fc3a1fe85d5cf29ec6eb6b4a84da9636e5436624ca9` |
| `p0-ux-bind.js` | `128233084b5b8f2010baedd4e15d1022d726c6611aa5bfa8b76712edfb2830f4` |

No storage keys added or renamed. Rollback = revert this PR.

## Residual risks (Codex)

1. PNG set is derived from in-repo SVG on `#030504`, not a byte-port of Aug-16 icons.
2. Typography remains IBM Plex / Sora until a later scanned/vendored Manrope + Space Grotesk slice.
3. Existing GitHub `assets/Wizard-Step-*.png` remain the live wizard images.
4. Mobile tabbar crops can include adjacent wizard Cancel/Next pixels (teal); those controls were not restyled.

## Tests

`scripts/ci/stage2-chrome-test.js` (token values, contrast gates, deferred fonts, goldens). Optional: `node scripts/ux/stage2-chrome-capture.js`.
