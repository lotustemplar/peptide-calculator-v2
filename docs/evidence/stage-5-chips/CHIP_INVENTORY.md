# CHIP_INVENTORY — Recovery Stage 5 / Issue #32 (Gate 0)

**Issue:** [#32](https://github.com/lotustemplar/peptide-calculator-v2/issues/32)  
**Branch:** `grok/32-recovery-stage-5-chips`  
**Base:** `main` @ `5531fe131365008a2bfe5c2ec682dafbe062ed40`  
**Risk:** Elevated (UX). Any chip that implies a dose or calculation default is **Serious** and is **not shipped** in Stage 5.  
**Gate:** This file is published **before** chip UI code.

Inventory-first rule (§C3): every proposed chip is classified here. Only `safe-MED-FLAG` rows may ship. `escalate-Serious` and `out-of-stage-5` rows stay unimplemented in this stage.

## Split (same owner, same issue)

| Slice | Scope in this issue |
| --- | --- |
| **5a** | Medications name CRUD + local normalization/autocomplete. Unknown-state is first-class (SAF-UNK). |
| **5b (ship)** | Chip families classified `safe-MED-FLAG` only: **Custom** + **recent-user** (+ explicit **Unknown** state control) on name fields. **No preselect.** |
| **5b (deferred)** | Every `escalate-Serious` / `out-of-stage-5` family. Not coded. Residual risk listed on the PR. |

Default-selection for every row is **none**. No chip is aria-pressed, selected, or auto-applied on render. Copy must not say recommended, best, or therapeutic.

## Classification rules

| Class | Meaning |
| --- | --- |
| `safe-MED-FLAG` | Name-only / unknown-state chrome. Does not write a calculator, dose, frequency, route, or unit default. |
| `escalate-Serious` | Would apply or imply a dose, frequency, route, unit, vial, water, or syringe value that affects calculation or therapy. Stop. Do not ship in Stage 5. |
| `out-of-stage-5` | Static catalogs, Stage 6+ / Stage 7 work, or unused legacy suggestion patches. Do not ship. |

## Shipped in Stage 5 (5a + safe 5b)

| Field | Source | Default-selection | Copy | Class |
| --- | --- | --- | --- | --- |
| Peptide / medication name | Custom | none | `Custom` | `safe-MED-FLAG` |
| Peptide / medication name | other (explicit unknown-state control) | none | `Unknown` | `safe-MED-FLAG` |
| Peptide / medication name | recent-user | none | Exact strings the user previously saved (medication `name` or fill display name). No catalog. Example synthetic only: `Demo Vial A` | `safe-MED-FLAG` |

### Copy and behavior (shipped)

| Chip | Exact label | What it does | What it must not do |
| --- | --- | --- | --- |
| Custom | `Custom` | Focuses the name input so the user can type. Does not insert a value. | Must not fill a peptide from `PEPTIDE_LIST`. Must not say suggested / recommended / best. |
| Unknown | `Unknown` | Sets name-state to unknown and display name `Unknown`. First-class SAF-UNK. | Must not be preselected. Must not normalize unknown onto a catalog name. |
| Recent-user | The stored user string, unmodified | Applies that previously entered name. Built at runtime from envelope medications + fills. | Must not include static list names the user never entered. Must not preselect. |

Hosts (after inventory): `#med-name` (Cabinet medications list) and `#save-fill-name` (save-fill name field). Same chip family. No other hosts.

## Escalated — do not ship (Serious)

These families would write calculator or therapeutic fields. Recent-user source does **not** make them safe: applying the value still implies a calc/dose default.

| Field | Source | Default-selection | Copy (proposed, not shipped) | Class |
| --- | --- | --- | --- | --- |
| Vial amount | static list | none | `10` `15` `20` `30` (mg) | `escalate-Serious` |
| Vial amount | recent-user | none | User-entered vial amounts | `escalate-Serious` |
| Vial amount | Custom | none | `Custom` (as an amount preset) | `escalate-Serious` |
| BAC water / max water (mL) | static list | none | `1` `2` `3` `5` | `escalate-Serious` |
| BAC water / max water (mL) | recent-user | none | User-entered water amounts | `escalate-Serious` |
| BAC water / max water (mL) | Custom | none | `Custom` (as a water preset) | `escalate-Serious` |
| Syringe size (mL) | static list | none | `0.3` `0.5` `1` | `escalate-Serious` |
| Syringe size (mL) | recent-user | none | User-entered syringe sizes | `escalate-Serious` |
| Syringe size (mL) | Custom | none | `Custom` (as a syringe preset) | `escalate-Serious` |
| Unit label | static list | none | `mg` `IU` (as chips) | `escalate-Serious` |
| Unit label | recent-user | none | User-entered unit labels | `escalate-Serious` |
| Planned dose (wizard) | static list | none | Any numeric dose chip | `escalate-Serious` |
| Planned dose (wizard) | recent-user | none | User-entered planned doses | `escalate-Serious` |
| Medication dose | static list / recent-user / Custom | none | Any dose chip on the meds form | `escalate-Serious` |
| Medication frequency / interval | static list | none | `Daily` `Every 2 days` `Weekly` / `7` | `escalate-Serious` |
| Medication frequency / interval | recent-user | none | User-entered intervals | `escalate-Serious` |
| Medication route | any | none | `SubQ` `IM` `Oral` or similar | `escalate-Serious` |
| Save-fill interval (every X days) | static list / recent-user | none | Interval chips on save-fill | `escalate-Serious` |
| Result ranking / water-option chips | other | none | `Easiest to measure` used as a selectable default | `escalate-Serious` |

Existing wizard `<select>` / `<input value="…">` characterized starting values (`mg`, `30`, `3`, `1`, `3`) are **not** Stage 5 chips. They stay frozen (DEC-DEFAULTS / Stage 7). Stage 5 must not add chips beside them.

## Out of Stage 5 (not shipped)

| Field | Source | Default-selection | Copy | Class |
| --- | --- | --- | --- | --- |
| Peptide / medication name | static list (`peptide-list.js` / `window.PEPTIDE_LIST`) | none | Full catalog in [Appendix A](#appendix-a--static-peptide_list-labels-not-shipped) | `out-of-stage-5` |
| Peptide / medication name | other (`fill-name-suggestions-fix.js` dormant patch) | none | `Tap a suggestion or type your own name.` plus first 7 `PEPTIDE_LIST` labels | `out-of-stage-5` |
| Reminder time | static list / recent-user | none | Time-of-day chips | `out-of-stage-5` |
| Mark missed | any | none | Any missed-status chip | `out-of-stage-5` |
| Remote / network name dictionary | other (DEC-NORM-REMOTE) | none | Any server-normalized label | `out-of-stage-5` |

`fill-name-suggestions-fix.js` remains on the runtime-fix allowlist and is **not loaded** by `index.html`. Stage 5 does not load it, edit it, or add another `*-fix.js`.

## 5a name rules (not chips, but Gate 0 adjacent)

| Rule | Acceptance |
| --- | --- |
| Add / edit / remove **names** | Live mutations go through `writeMedicationsFromUi` / Stage 3 envelope (`peptide-calculator-v2-p0ux-store`). No legacy-only med writes. |
| Local normalization | Trim + collapse internal whitespace. Match key is case-folded. Display preserves user capitalization. Offline only. |
| Autocomplete | Matches recent-user names only. First option is **not** auto-highlighted or auto-applied. |
| Unknown first-class | Empty, whitespace, or case-insensitive `unknown` ⇒ `nameState: "unknown"` and display `Unknown`. Never coerced onto a catalog name. |
| Dose / frequency / route | Not suggested. Optional stored dose/unit/interval on existing rows is passthrough. Missing values display `Unknown`. Interval is not invented as `7`. |
| Forbidden copy | No `recommended`, `best`, therapeutic, interaction, or dose-advice framing. |

## Residual risks (inventory)

1. Calc-field chip families remain unshipped. A later stage must re-inventory before any vial / water / syringe / unit / dose chip ships.
2. Characterized wizard defaults are unchanged and are not chips; changing them is Serious / Stage 7.
3. Static `PEPTIDE_LIST` still exists for the unused datalist helper in frozen `app.js`. Stage 5 does not surface it as chips.

Rollback = revert the Stage 5 PR. Never mutate or delete `fitgen-peptide-rebuild-v1`.

## Appendix A — static `PEPTIDE_LIST` labels (not shipped)

Source: `peptide-list.js`. Class of every label: `out-of-stage-5`. Default-selection: **none**. Field: peptide / medication name.

Semaglutide; Tirzepatide; Retatrutide; Liraglutide; Cagrilintide; Pramlintide; Exenatide; Oxyntomodulin; GLP-1; GIP; Ipamorelin; GHRP-2; GHRP-6; Hexarelin; Pralmorelin (GHRP-1); Sermorelin; Tesamorelin; CJC-1295 (no DAC); CJC-1295 (with DAC); Mod GRF 1-29; IGF-1 LR3; IGF-1 DES; MGF (Mechano Growth Factor); PEG-MGF; Follistatin 344; AOD-9604; Adipotide (FTPP); MOTS-c; BPC-157; TB-500 (Thymosin Beta-4); GHK-Cu (Copper Peptide); Thymosin Beta-4 Fragment; Melanotan 2 (MT-2); Melanotan 1 (Afamelanotide); PT-141 (Bremelanotide); Thymosin Alpha-1; LL-37; Thymalin; Thymulin; KPV; VIP (Vasoactive Intestinal Peptide); Larazotide; Selank; Semax; Dihexa; P21; Cerebrolysin; FGL; Cortexin; Epitalon (Epithalon); Pinealon; Vilon; Cortagen; Bronchogen; Chelohart; Ovagen; Vesugen; Chonluten; Crystagen; Pancragen; Testagen; Ventfort; DSIP (Delta Sleep-Inducing Peptide); Epithalon; SS-31 (Elamipretide); Humanin; Gonadorelin (GnRH); Kisspeptin-10; Kisspeptin-54; Triptorelin; Leuprolide; Nafarelin; Buserelin; Oxytocin; Histrelin; Argireline (Acetyl Hexapeptide-3); SNAP-8; Leuphasyl; Palmitoyl Tripeptide-1; Palmitoyl Tetrapeptide-7; Matrixyl (Palmitoyl Pentapeptide-4); SYN-AKE; Substance P; CGRP; Spantide; Insulin; Glucagon; Secretin; Ghrelin; Leptin; Adiponectin; Orexin A; Orexin B; Nesfatin-1; Humanin G (HNG); 5-Amino-1MQ.
