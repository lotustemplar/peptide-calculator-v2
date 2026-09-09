# SCAN — secrets, endpoints, PHI markers, licenses, debris

**Scope:** document the planning-pass scan of the uploaded RAR / extracted rebuild, plus what this Stage 0 workspace could and could not re-check.  
**Rule:** do not commit hits; redact values. Absence of a hit in this note is **not** a safety claim about combinations, doses, or live user data.

## Scan posture

| Pass | When | Tree available | Result used here |
|------|------|----------------|------------------|
| Planning inventory (Recovery Plan v1.0 → v1.1) | 2026-09-08/09 | `/workspace/baseline-compare/baseline/` plus a partial `unzipped/` extract | File roles, sizes, stub contents, storage-key names, native-bridge surface names, debris list |
| This Stage 0 workspace | 2026-09-09 | **No RAR and no extract** (correct: archive stays outside the deployable tree) | Re-hashed GitHub cores at `270e0eb`; reproduced the 67-byte baseline stub digest; scanned **this evidence pack** and current `main` for accidental secrets |

A byte-level re-scan of every RAR member is **not** possible in this environment without bringing the archive into the workspace. Stage 0 therefore freezes the planning-pass findings and keeps the archive out. Any later allowlist of a baseline binary or source file requires a **new** scan of those exact bytes.

## Secrets / credentials

| Finding | Action |
|---------|--------|
| Planning inventory did **not** publish live API keys, tokens, passwords, or private `.env` values from the extract | No secret material copied into this pack |
| Baseline `config.js` / `config.example.js` described only as minimal `APP_CONFIG` (146 / 45 bytes; 2026-07-31). Raw values were **not** pasted into the public plan | Files **not** committed. Treat as unscanned-for-publication until a later pass opens them off-repo |
| Incomplete `.git` in the extract (message claim: “Initial upload of Median web app”; object prefix `a5e7bd6…`; unix date 2026-05-01) | Debris / untrustworthy history — **deny** (see ALLOWLIST) |
| Current GitHub `main` already contains public `backendBaseUrl` / OneSignal prefix in `config.js` (Render hostname). That is an existing `main` fact, not a new RAR leak | Not copied again here |

**Redaction:** no key material, connection strings, or `.env` bodies are reproduced in this directory.

## Endpoints / network surfaces (names only)

From the planning inventory of the rebuild (not a live traffic capture):

- Browser daily-digest reminder path (local)
- Native bridge names: `FitGenNative.syncReminders`, native file export/import hooks
- Baseline `index.html` loads **only** `./app.js` (stubs and `peptide-list.js` are orphans)
- No `backend/` directory was listed in the baseline inventory

No raw private URLs, webhook secrets, or vendor API keys from the RAR are recorded here.

## PHI / personal-health markers

| Marker | Planning-pass note | Published here? |
|--------|--------------------|-----------------|
| Storage key `fitgen-peptide-rebuild-v1` | Rebuild envelope `{ fills, histories, activeView, lastReminderDigestDate }` | Key **name** and field **names** only |
| Legacy keys `peptide-calculator-v2-fills`, `peptide-calculator-v2-schedules` | Migration mentioned (`takenDates` → histories) | Key **names** only |
| Histories / taken / missed rows | Can be health-adjacent **if** they came from a real person | **No** sample payloads |
| Real user backup JSON | None attached to the published plan | None committed |
| Names, emails, phone numbers, addresses | Not published in the plan inventory | None committed |

Synthetic fixtures for both storage generations are a **Stage 3** item, not Stage 0.

## Licenses / third-party assets

Uncleared for commit until a later scan says otherwise:

- PNG icon set (`icon.png`, `icon-192.png`, `icon-512.png`) and `icon.svg`
- Wizard SVGs and large step / `ui-reference` PNGs under `assets/`
- `peptide-app-phone-qr.png` (QR / marketing remnant)
- Incomplete `.git` / Median upload claim (not a license grant)

## Debris / extract caveats

- `/workspace/baseline-compare/unzipped/` had many **0-byte** cores — failed or partial extract. Do not treat as source of truth.
- Usable tree was `/workspace/baseline-compare/baseline/` (non-zero cores).
- Stub `*-fix.js` files (32–67 bytes) only set `window.__fitgen*` flags.
- `archive/_tmp_app.js` (~1979 LOC) and `archive/_tmp_index.html` are an **older** lineage, closer to GitHub `app.js`, not the rebuild.
- `peptide-list.js` in the rebuild (203 bytes / 12 names) is **not** loaded by baseline `index.html`.

## This evidence pack (self-scan)

This directory contains Markdown only: hashes, key **names**, structural fork bullets, and process links. It does not contain RAR bytes, baseline scripts, binaries, or user payloads.
