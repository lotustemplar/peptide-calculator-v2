# Baseline archive 2026-08-16 — provenance (Stage 0)

**Issue:** [#24](https://github.com/lotustemplar/peptide-calculator-v2/issues/24) — Recovery Plan v1.1 Stage 0  
**Risk class:** Routine (docs / evidence only)  
**This pack:** hashes, scan notes, allowlist, structural diff summary  
**This pack is not:** the baseline application, a deployable tree, or a correctness claim

Directory name `baseline-rar-2026-08-16` is the plan’s historical path label. It does **not** mean only a RAR is in scope.

## What the baseline is

The **original source archive** is a **RAR**. A **ZIP derivative** was subsequently created for workspace transfer/comparison and holds the same extracted tree. Codex review recorded filenames `peptide-calculator-v2(2).rar` (valid RAR v4) and derived `peptide-calculator-v2.zip`. This Stage 0 workspace did not have those files on disk and does not independently re-identify the filename history; restrictions below use format-neutral **source archive** wording. Both archives and the complete extract stay **outside** git.

The usable extracted tree from the 2026-09-08/09 planning pass is an **August 2026 rebuild** (`STORAGE_KEY = fitgen-peptide-rebuild-v1`). Core product file mtimes on that tree clustered on **2026-08-16** (UTC).

Filipe’s Stage-1 direction (2026-09-08) treats that rebuild’s recognizable UI, layout, and organization as the **product-identity reference** to refine onto GitHub’s tested P0 spine. See:

- Plan v1.1: https://github.com/lotustemplar/peptide-calculator-v2/issues/2#issuecomment-5595667320
- Codex plan approval: https://github.com/lotustemplar/peptide-calculator-v2/issues/2#issuecomment-5595679011
- Filipe Stage-1 approval: https://github.com/lotustemplar/peptide-calculator-v2/issues/2#issuecomment-5595858549

## Binding statements

1. **Identity / UI reference only.** Use this pack to recognize shell, navigation, and visual direction. Do not treat the baseline as the source of truth for calculator math, units, rounding, persistence, reminders, or safety copy.
2. **Not assumed correct.** Neither the baseline rebuild nor current `main` is a clinical oracle. GitHub calculator goldens lock *current* `main` outputs; they are regression locks, not medical validation.
3. **Not deployable as `main`.** Do not overwrite GitHub `main` with the source archive, any RAR/ZIP (or other) repackaged derivative, or the extracted tree. Do not revive baseline stub `*-fix.js` files as if they were real patches.
4. **Archive stays outside this repository.** The untouched extract used for planning lived at `/workspace/baseline-compare/baseline/` on the comparison workspace. The full source archive, any repackaged derivative (RAR/ZIP/etc.), the complete unvetted extract, and `unzipped/` (partial extract with 0-byte cores) are **not** in git and must not be added.

## What Stage 0 committed

| Path | Role |
|------|------|
| [HASHES.md](./HASHES.md) | SHA-256 freeze for baseline + `main` cores |
| [ALLOWLIST.md](./ALLOWLIST.md) | What may ever be committed later, after a fresh scan |
| [SCAN.md](./SCAN.md) | Secrets / endpoints / PHI-marker / license / debris notes |
| [DIFF_SUMMARY.md](./DIFF_SUMMARY.md) | Feature / storage / formula fork bullets (no medical claims) |

**Default:** no baseline `app.js`, `index.html`, `styles.css`, stub patches, archive temps, binaries, or source-archive / ZIP-derivative bytes.

Issue #26 later added [STAGE2.md](./STAGE2.md) (scan notes + chrome screenshot index) without placing extract bytes in git.

## GitHub `main` tip frozen here

`270e0eb8730fb95b650e911463affddae223d655` — merge of PR #21 (P0.UX Taken/Undo). Do not re-merge PR #21. Draft PR #23 (Capacitor / Issue #18) remains a separate paused packaging track.

## Rollback

Revert this docs PR only. No application behavior, storage keys, or archive files are affected.
