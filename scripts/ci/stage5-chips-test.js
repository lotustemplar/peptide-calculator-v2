#!/usr/bin/env node
"use strict";

/**
 * Stage 5 inventory + freeze checks. Does not execute calculator math.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { readText, repoRoot } = require("./lib");

const ROOT = repoRoot();

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${message}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL  ${message}`);
}

function sha256File(rel) {
  const abs = path.join(ROOT, rel);
  return crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
}

function parseInventoryRows(markdown) {
  const rows = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.startsWith("|")) {
      continue;
    }
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim().replace(/^[`*]+|[`*]+$/g, ""));
    if (cells.length < 5) {
      continue;
    }
    if (/^-+$/.test(cells[0]) || cells[0] === "Field") {
      continue;
    }
    rows.push({
      field: cells[0],
      source: cells[1],
      defaultSelection: cells[2],
      copy: cells[3],
      class: cells[4],
    });
  }
  return rows;
}

function main() {
  console.log("Stage 5 chip inventory + MED-FLAG freeze");

  const inventoryRel = "docs/evidence/stage-5-chips/CHIP_INVENTORY.md";
  const inventoryAbs = path.join(ROOT, inventoryRel);
  assert(fs.existsSync(inventoryAbs), "CHIP_INVENTORY.md exists");
  const inventory = readText(inventoryAbs);
  const rows = parseInventoryRows(inventory);

  assert(rows.length > 0, "inventory table has classified rows");
  const missingCols = rows.filter(
    (row) => !row.field || !row.source || !row.defaultSelection || !row.copy || !row.class
  );
  assert(missingCols.length === 0, "every inventory row has field/source/default/copy/class");
  assert(
    rows.every((row) => row.defaultSelection === "none"),
    "every inventory row has default-selection none"
  );
  assert(
    rows.every((row) => /^(safe-MED-FLAG|escalate-Serious|out-of-stage-5)$/.test(row.class)),
    "every inventory class is safe-MED-FLAG, escalate-Serious, or out-of-stage-5"
  );

  const shipped = rows.filter((row) => row.class === "safe-MED-FLAG");
  assert(
    shipped.some((row) => row.source === "Custom" && row.copy.includes("Custom")),
    "Custom name chip is classified safe-MED-FLAG"
  );
  assert(
    shipped.some((row) => /recent-user/.test(row.source)),
    "recent-user name chip is classified safe-MED-FLAG"
  );
  assert(
    shipped.some((row) => /Unknown/.test(row.copy)),
    "Unknown state chip is classified safe-MED-FLAG"
  );

  const escalated = rows.filter((row) => row.class === "escalate-Serious");
  assert(
    escalated.some((row) => /vial/i.test(row.field)),
    "vial amount chips are escalate-Serious"
  );
  assert(
    escalated.some((row) => /water/i.test(row.field)),
    "BAC water chips are escalate-Serious"
  );
  assert(
    escalated.some((row) => /syringe/i.test(row.field)),
    "syringe chips are escalate-Serious"
  );
  assert(
    escalated.some((row) => /dose/i.test(row.field)),
    "dose chips are escalate-Serious"
  );
  assert(
    escalated.some((row) => /frequency|interval/i.test(row.field)),
    "frequency/interval chips are escalate-Serious"
  );

  const html = readText(path.join(ROOT, "index.html"));
  const bind = readText(path.join(ROOT, "p0-ux-bind.js"));
  const css = readText(path.join(ROOT, "styles.css"));
  const chipsTs = readText(path.join(ROOT, "src/ux/chips.ts"));
  const medNames = readText(path.join(ROOT, "src/ux/med-names.ts"));

  assert(/data-chip-field="peptide-name"/.test(html), "HTML hosts only peptide-name chips");
  assert(/data-chip-default="none"/.test(html), "HTML chip hosts declare default none");
  assert(!/data-chip-field="vial|data-chip-field="syringe|data-chip-field="water|data-chip-field="dose/.test(html), "HTML has no calc-field chip hosts");
  assert(/fitgen-chip-row/.test(css), "chip chrome lives in styles.css");
  assert(
    /#cabinet-view\.is-active #medications-card/.test(css) && /display:\s*block\s*!important/.test(css),
    "Stage 5 unhides medications-card that ui-polish-fix.js hides"
  );
  assert(/selected: false/.test(chipsTs), "chip model hard-codes selected false");
  assert(/UNKNOWN_NAME_STATE/.test(medNames), "unknown-state lives in src/ux/med-names.ts");
  assert(/writeMedicationsFromUi/.test(bind), "bind uses Stage 3 writeMedicationsFromUi");
  assert(!/PEPTIDE_LIST/.test(bind), "bind does not surface PEPTIDE_LIST chips");
  assert(!/recommended|best\b/i.test(html.match(/id="med-name-chips"[\s\S]{0,400}/)?.[0] || ""), "med chip host has no recommended/best copy");
  assert(!/stage5-.*-fix\.js/.test(html), "Stage 5 did not add a runtime *-fix.js");
  assert(!/fill-name-suggestions-fix\.js/.test(html), "static suggestion patch stays unloaded");

  const frozenGoldens = "659c1865da95c3197395c931e154c4267c802d8aaf7842aee83345962d013acd";
  const actualGoldens = sha256File("scripts/calc/fixtures/legacy-evidence-goldens.json");
  assert(actualGoldens === frozenGoldens, "calc goldens SHA-256 unchanged vs Stage 4 freeze");

  const frozenApp = "489cd7b88b90e00bd2a700518312577cf5a65cf12cacc003d9a181422606a537";
  assert(sha256File("app.js") === frozenApp, "app.js SHA-256 unchanged (no formula-builder edits)");

  const evidenceDir = path.join(ROOT, "docs/evidence/stage-5-chips");
  const requiredShots = [
    "before-desktop-meds.png",
    "before-mobile-meds.png",
    "after-desktop-meds.png",
    "after-mobile-meds.png",
    "after-desktop-chips.png",
    "after-mobile-chips.png",
  ];
  for (const name of requiredShots) {
    const abs = path.join(evidenceDir, name);
    assert(fs.existsSync(abs) && fs.statSync(abs).size > 1000, `evidence shot ${name} exists`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    process.exit(1);
  }
}

main();
