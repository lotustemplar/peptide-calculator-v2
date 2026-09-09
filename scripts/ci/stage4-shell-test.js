#!/usr/bin/env node
"use strict";

/**
 * Stage 4 shell/IA checks. Does not execute calculator math.
 * Confirms hero / bottom tabbar / view chrome IA, P0 control wiring,
 * and quarantined calc/persistence surfaces.
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

function cssBlock(css, headerRe) {
  const match = headerRe.exec(css);
  if (!match) {
    return "";
  }
  const start = match.index + match[0].length;
  let depth = 1;
  let index = start;
  while (index < css.length && depth > 0) {
    if (css[index] === "{") {
      depth += 1;
    } else if (css[index] === "}") {
      depth -= 1;
    }
    index += 1;
  }
  return css.slice(start, index - 1);
}

function tokenValue(block, name) {
  const re = new RegExp(`${name}:\\s*([^;]+);`);
  const match = re.exec(block);
  return match ? match[1].trim() : null;
}

function main() {
  console.log("Stage 4 shell/IA + P0 chrome wiring");

  const html = readText(path.join(ROOT, "index.html"));
  const css = readText(path.join(ROOT, "styles.css"));
  const bind = readText(path.join(ROOT, "p0-ux-bind.js"));
  const runtime = readText(path.join(ROOT, "runtime-fixes.js"));
  const dialog = readText(path.join(ROOT, "src/ux/dialog.ts"));
  const wizard = readText(path.join(ROOT, "src/ux/wizard.ts"));

  const tabTargets = [...html.matchAll(/data-view-target="([^"]+)"/g)].map((match) => match[1]);
  assert(
    tabTargets.join(",") === "calculator-view,schedule-view,calendar-view,cabinet-view",
    "tab order is Add · Schedule · Calendar · Cabinet"
  );

  const tabLabels = [...html.matchAll(/<span class="tab-label">([^<]+)<\/span>/g)].map((match) => match[1]);
  assert(tabLabels.join(",") === "Add,Schedule,Calendar,Cabinet", "tab labels are Add / Schedule / Calendar / Cabinet");

  const tabbarIndex = html.indexOf('class="tabbar"');
  const mainClose = html.lastIndexOf("</main>");
  assert(tabbarIndex > mainClose && mainClose > 0, "tabbar is after main (bottom IA)");

  assert(/class="app-header app-hero"/.test(html), "hero uses app-header app-hero chrome");
  assert(/class="hero-lead"/.test(html), "hero lead is present");
  assert(/Measurement planner for fills, schedules, and cabinet inventory/.test(html), "hero lead is planner framing");

  for (const viewId of ["calculator-view", "schedule-view", "calendar-view", "cabinet-view"]) {
    const viewRe = new RegExp(`id="${viewId}"[\\s\\S]*?class="view-chrome"`);
    assert(viewRe.test(html), `${viewId} has view-chrome`);
  }

  assert(/wizard-back-btn/.test(html) && /data-back="1"/.test(html), "wizard Back control still present");
  assert(/wizard-cancel-btn/.test(html), "wizard Cancel control still present");
  assert(/wizard-next-btn/.test(html) && /data-next="2"/.test(html), "wizard Next control still present");
  assert(/fitgen-target-44/.test(html), "P0 44px targets still present on wizard chrome");
  assert(/id="fitgen-confirm-dialog"/.test(html), "P0 confirm dialog still present");
  assert(/id="fitgen-undo-snackbar"/.test(html), "Taken Undo snackbar still present");
  assert(/id="fitgen-undo-snackbar-btn"/.test(html), "Undo snackbar button still present");
  assert(/Keep editing/.test(bind) || /DISCARD_KEEP/.test(bind), "dirty Cancel Keep editing is bound");

  assert(/function handleWizardBack/.test(bind), "p0-ux-bind wires wizard Back");
  assert(/handleWizardBack\(event\)/.test(bind), "p0-ux-bind invokes wizard Back");
  assert(/function handleWizardCancel/.test(bind), "p0-ux-bind wires dirty Cancel");
  assert(/function handleTaken/.test(bind), "p0-ux-bind wires Taken");
  assert(/function handleUndo/.test(bind), "p0-ux-bind wires Undo");
  assert(/UNDO_SNACKBAR_MS/.test(bind), "snackbar duration uses UX contract");
  assert(/function syncTabAria/.test(bind), "tab aria-current is synced after view changes");

  assert(/UNDO_SNACKBAR_MS = 8000/.test(dialog), "Undo snackbar duration is 8000ms");
  assert(/UX-WIZ-001/.test(wizard), "wizard module still owns UX-WIZ-001 Back preserve");

  assert(/querySelector\("\.tab-label"\)/.test(runtime), "Schedule badge writes .tab-label (does not wipe tab icons)");

  const tabbar = cssBlock(css, /^\.tabbar\s*\{/m);
  assert(/position:\s*fixed/.test(tabbar), "tabbar is fixed to the viewport bottom");
  assert(/bottom:\s*var\(--tabbar-offset\)/.test(tabbar), "tabbar uses Stage 2 offset token");
  assert(/min-height:\s*var\(--tabbar-height\)/.test(tabbar) || /var\(--tabbar-height\)/.test(tabbar), "tabbar uses height token");

  const snackbar = cssBlock(css, /^\.fitgen-snackbar\s*\{/m);
  assert(/var\(--tabbar-height\)/.test(snackbar), "snackbar sits above the bottom tabbar");

  assert(/\.view-chrome\s*\{/.test(css), "view-chrome selector exists");
  assert(/\.app-hero/.test(css), "hero chrome selector exists");
  assert(/\.tab-label/.test(css), "tab-label chrome selector exists");

  const root = cssBlock(css, /:root\s*\{/);
  assert(tokenValue(root, "--bg") === "#030504", "Stage 2 dark --bg still #030504");
  assert(tokenValue(root, "--green") === "#8ff11d", "Stage 2 --green still #8ff11d");
  assert(tokenValue(root, "--tabbar-height") === "94px", "Stage 2 tabbar height still 94px");

  assert(!/mark-missed|mark missed|inferred-missed|inferred missed/i.test(html), "HTML has no Mark missed");
  assert(!/mark-missed|mark missed|inferred-missed|inferred missed/i.test(bind), "bind has no Mark missed");
  assert(!/mark-missed|data-action=["']mark-missed["']/.test(runtime), "runtime-fixes gained no Mark missed action");

  assert(/id="calculator-form"/.test(html), "calculator-form still present");
  assert(/id="vial-mg"/.test(html), "vial-mg still present");
  assert(/id="dose-mg"/.test(html), "dose-mg still present");
  assert(/id="syringe-max"/.test(html), "syringe-max still present");
  assert(/id="max-water-ml"/.test(html), "max-water-ml still present");
  assert(/id="results-grid"/.test(html), "results-grid still present");
  assert(/Water amounts by measurement ease/.test(html), "results heading copy unchanged");
  assert(/What's in your vial\?/.test(html), "wizard step-1 title unchanged");
  assert(!/src="\.\/assets\/(?:vial|syringe|dose)-step\.png"/.test(html), "baseline wizard rasters are not wired");

  const frozenGoldens = "659c1865da95c3197395c931e154c4267c802d8aaf7842aee83345962d013acd";
  const actualGoldens = sha256File("scripts/calc/fixtures/legacy-evidence-goldens.json");
  assert(actualGoldens === frozenGoldens, "calc goldens SHA-256 unchanged vs Stage 2/3 freeze");

  const frozenApp = "489cd7b88b90e00bd2a700518312577cf5a65cf12cacc003d9a181422606a537";
  assert(sha256File("app.js") === frozenApp, "app.js SHA-256 unchanged (no calc/persistence edits)");

  const evidenceDir = path.join(ROOT, "docs/evidence/stage-4-shell");
  const requiredShots = [
    "before-desktop-shell.png",
    "before-mobile-shell.png",
    "before-desktop-dirty-cancel.png",
    "before-mobile-dirty-cancel.png",
    "before-desktop-taken-undo.png",
    "before-mobile-taken-undo.png",
    "after-desktop-shell.png",
    "after-mobile-shell.png",
    "after-desktop-dirty-cancel.png",
    "after-mobile-dirty-cancel.png",
    "after-desktop-taken-undo.png",
    "after-mobile-taken-undo.png",
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
