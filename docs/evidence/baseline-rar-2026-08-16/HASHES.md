# HASHES — Stage 0 core freeze

Algorithm: **SHA-256** (hex).  
Plan source: Recovery Plan v1.1 Appendix B / issue comment [5595667320](https://github.com/lotustemplar/peptide-calculator-v2/issues/2#issuecomment-5595667320).  
Do not invent hashes. Values below are either re-verified in this Stage 0 workspace or copied from that approved manifest after a local check.

## Git commit

| Ref | SHA-1 |
|-----|-------|
| `origin/main` tip (PR #21 merge) | `270e0eb8730fb95b650e911463affddae223d655` |

Verified in this workspace: `git rev-parse origin/main` and `git rev-parse HEAD` (before this docs commit) both returned that tip.

## Core files

| Side | Path | Bytes | SHA-256 | Verification in this Stage 0 workspace |
|------|------|------:|---------|----------------------------------------|
| Baseline | `app.js` | 71777 | `4ce5f9c9190826b6d4b39b57b069bde0ccdb1b755acd8d35a4e07110b0cb7f5d` | Frozen from plan v1.1. Archive not present here; **not** re-hashed. Planning inventory: 2114 lines; mtime 2026-08-16 14:55 UTC. |
| Baseline | `index.html` | 17881 | `8f6e27fe2cce67ccff9cfecd479ad6fde9e304fe5f91d49e9478a52a0f2e91f1` | Frozen from plan v1.1. Archive not present here; **not** re-hashed. Planning inventory: 409 lines; mtime 2026-08-16 14:53 UTC. |
| Baseline | `styles.css` | 23452 | `62ca986be8884628025f0e020edb1ab6810e3def4c7f89e63d2a2af4baedee3a` | Frozen from plan v1.1. Archive not present here; **not** re-hashed. Planning inventory: 1297 lines; mtime 2026-08-16 14:56 UTC. |
| Baseline | `runtime-fixes.js` | 67 | `35f6f3d5993b0f65c291b4495dcd2beeab47a4b7d76631ddd22988bdf97c835e` | Plan v1.1 value. Independently reproduced: UTF-8 assignment of `window.__fitgenRuntime` to itself-or-`{ apk: false }` plus a single newline is 67 bytes and hashes to this digest. **Stub, not a real overlay.** Source is not committed. |
| GitHub `main` | `app.js` | 77157 | `489cd7b88b90e00bd2a700518312577cf5a65cf12cacc003d9a181422606a537` | `sha256sum` of `app.js` at `270e0eb`. Matches plan v1.1. |
| GitHub `main` | `index.html` | 19637 | `18dfccc51b390b1c9b228bdfa2789517ce48d7c3774917fd189fcdda73d1059a` | `sha256sum` of `index.html` at `270e0eb`. Matches plan v1.1. |
| GitHub `main` | `styles.css` | 25859 | `307eae651c212be7e6a4455d344a2cbd0dfec5ae5a33cb03621f7fa37d27d40c` | `sha256sum` of `styles.css` at `270e0eb`. Matches plan v1.1. |
| GitHub `main` | `runtime-fixes.js` | 48336 | `dc390d5fa9f936effcdd9fc3a1fe85d5cf29ec6eb6b4a84da9636e5436624ca9` | `sha256sum` of `runtime-fixes.js` at `270e0eb`. Matches plan v1.1. Real overlay, not a stub. |

## Additional `main` files hashed here (not in plan Appendix B)

These are extra identity pins for this workspace’s `270e0eb` tree. They are **not** baseline hashes.

| Path | Bytes | SHA-256 |
|------|------:|---------|
| `peptide-list.js` | 2192 | `848be797f3e627b9f18cf8cf9c4087f180c1a00c4085ac55d9b639deb196dbe6` |
| `p0-ux-bind.js` | 19175 | `128233084b5b8f2010baedd4e15d1022d726c6611aa5bfa8b76712edfb2830f4` |
| `manifest.webmanifest` | 405 | `5bb15188910ed8e57c4f50219f259b8d4a58c3e3cc42ed4a07f07a30b297d375` |
| `config.example.js` | 252 | `96e06474dd822a029f0acfc83648b80b6b77f436df0567eab27d1c541a4ff773` |

Baseline `peptide-list.js` was inventoried as 203 bytes / prefix `efa30b0f…` only. The full digest was **not** published in plan v1.1, so it is **not** recorded here.

## How to re-verify later

On a machine that still has the sealed extract **outside** git:

```text
sha256sum baseline/app.js baseline/index.html baseline/styles.css baseline/runtime-fixes.js
sha256sum app.js index.html styles.css runtime-fixes.js
git rev-parse HEAD   # expect 270e0eb8730fb95b650e911463affddae223d655 on the frozen main tip
```

Do not copy those baseline files, the source archive, or any RAR/ZIP (or other) derivative into this repository to re-verify.

Codex independently re-hashed the extracted cores during review of `26f1abf` and confirmed the four baseline SHA-256 values and sizes in the table above. Those digest values are unchanged in this correction.
