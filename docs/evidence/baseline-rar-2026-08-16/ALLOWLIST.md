# ALLOWLIST — what may ever be committed from the baseline

Stage 0 commits **none** of the extracted application. This file is the gate for **later** stages (2+), after a fresh secrets / endpoint / PHI / license / debris scan of the specific files proposed.

Codex correction #4 (plan v1.1 §C4): hashing proves identity; it does **not** prove publication safety.

## Stage 0 (this PR) — committed

| Item | Status |
|------|--------|
| This evidence directory (README, HASHES, ALLOWLIST, SCAN, DIFF_SUMMARY) | **Allowlisted now** — sanitized text only |
| Baseline `app.js` / `index.html` / `styles.css` | **Not committed** |
| Baseline stub `*-fix.js` | **Not committed** |
| Full source archive, RAR/ZIP (or other) derivative, or complete extract | **Not committed** |
| Screenshots of real user data | **Not committed** (none available in this workspace) |
| Synthetic storage fixtures | **Not committed** in Stage 0 (optional later; no real PHI) |

## Stage 2 (Issue #26) — committed after a fresh scan of the exact bytes

Gate document for this table: this file + [STAGE2.md](./STAGE2.md). Hashing proves identity of the bytes scanned; it does **not** prove the missing Aug-16 extract rasters.

| Item | Status |
|------|--------|
| In-repo FitGen `icon.svg` (already on `main`; re-scanned) | **Allowlisted** — no script/foreignObject; xmlns only |
| `icon.png`, `icon-192.png`, `icon-512.png` rasterized from that SVG onto baseline `--bg` `#030504` | **Allowlisted** after PNG chunk/strings scan. **Not** Aug-16 extract bytes |
| Behavior-neutral `:root` chrome tokens copied from Codex-verified baseline `styles.css` (`62ca986b…`): `--bg` `#030504`, `--bg-deep` `#050805`, `--green` `#8ff11d`, `--green-strong` `#67d414`, radii 34/26/18/14, tabbar 94px / 24px offset / glass / neon line+glow | **Allowlisted as a token slice** — full baseline `styles.css` still **not** committed |
| Manrope / Space Grotesk font files or new Google Fonts URLs | **Deferred** — would add a new remote request; keep IBM Plex / Sora this PR |
| `--green-on-light` `#1f6b12` | **Allowlisted exception** — neon `#8ff11d` fails contrast on light `--bg`; not a baseline hex |
| Chrome-only before/after screenshots under `docs/evidence/stage-2-chrome/` | **Allowlisted** — header/tabbar crops; product chrome only; PNG metadata none |
| Baseline RAR `icon.png` / `icon-192.png` / `icon-512.png` / baseline `icon.svg` | **Not committed** — extract not in this workspace; bytes not guessed |
| Wizard SVGs, `assets/{vial,syringe,dose}-step.png`, `assets/ui-reference.png` | **Not committed** — extract absent; existing GitHub `assets/Wizard-Step-*.png` left unwired-as-new |
| `peptide-app-phone-qr.png` | **Still denied** |

## May be proposed later (after a new scan of the exact bytes)


These are candidates only. Listing them here is **not** authorization to add them.

| Class | Examples from the planning inventory | Conditions before any PR |
|-------|--------------------------------------|--------------------------|
| Global visual tokens | Color / type / spacing notes already expressible in text; later, behavior-neutral token slices of CSS | No calculator form/results semantics; goldens unchanged |
| Static icons | `icon.png`, `icon-192.png`, `icon-512.png`, `icon.svg` | License/provenance cleared; no embedded PII; binary scan clean |
| Wizard artwork | `assets/` wizard SVGs (Aug 1), large `vial` / `syringe` / `dose-step` PNGs, `assets/ui-reference.png` | Same scan; Stage 2 assets-only; not wired to calc/persistence behavior |
| Synthetic fixtures | Hand-made JSON for `fitgen-peptide-rebuild-v1` **and** current multi-key / P0.UX envelopes | No real names, doses, dates from a person; Stage 3 territory |
| Structural screenshots | Empty-state or dummy-data UI chrome | No health payloads in EXIF or pixels |

## Must not be committed (default deny)

| Class | Why |
|-------|-----|
| Full source archive or repackaged derivative (RAR/ZIP/etc.) and complete extract | Codex #4; public-repo publication risk — format does not change the deny |
| Baseline `app.js`, `index.html`, full `styles.css` as executable app source | Dual-generation overwrite risk; not needed as fixtures for Stage 0. Prefer hashes + this text pack. Exception only if a later issue explicitly needs **non-executable** fixtures **after** a documented secrets/PHI/license scan. |
| Baseline stub `runtime-fixes.js`, `export-fix.js`, `mobile-polish-fix.js`, `native-backup-fix.js`, `ui-polish-fix.js` | Orphans that only set `window.__fitgen*` flags; committing them as product files is misleading |
| `archive/_tmp_app.js`, `archive/_tmp_index.html` | Older-lineage debris, not the rebuild identity |
| Incomplete baseline `.git` | Planning pass: broken/sparse objects; not a trustworthy remote |
| `peptide-app-phone-qr.png` | Marketing/QR remnant; possible external URL; uncleared |
| Real export/backup JSON, dosing history, names, addresses | PHI / personal health data — never in git |
| Secrets, tokens, private endpoints, `.env` values | Never in git |
| `unzipped/` 0-byte extract | Failed/partial extract; not a source of truth |
| New runtime `*-fix.js` | CI / AGENTS.md forbid adding another |

## Stage 0 decision on baseline app source as fixtures

**Do not commit** baseline `app.js` / `index.html` as non-executable fixtures in this stage. Hashes plus [DIFF_SUMMARY.md](./DIFF_SUMMARY.md) are sufficient to freeze identity. A later stage that needs a fixture must open its own issue, scan the exact file, and treat it as data — not as a script loaded by `index.html`.
