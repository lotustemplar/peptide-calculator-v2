"use strict";

/**
 * P0.6 / UX-COPY-001 / UX-RES-002 / UX-WIZ-020
 * Locks measurement/planner replacements on loaded UI surfaces.
 * Lives under scripts/ci/ so the forbidden-copy scanner can name legacy phrases.
 * Does not execute calculator math or reminder sync.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");

const LOADED = {
  html: path.join(ROOT, "index.html"),
  app: path.join(ROOT, "app.js"),
  runtime: path.join(ROOT, "runtime-fixes.js"),
};

let passed = 0;
let failed = 0;

function read(absPath) {
  return fs.readFileSync(absPath, "utf8");
}

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${message}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL  ${message}`);
}

function assertIncludes(haystack, needle, message) {
  assert(haystack.includes(needle), message);
}

function assertExcludes(haystack, needle, message) {
  assert(!haystack.includes(needle), message);
}

function main() {
  const html = read(LOADED.html);
  const app = read(LOADED.app);
  const runtime = read(LOADED.runtime);
  const loaded = `${html}\n${app}\n${runtime}`;

  console.log("P0.6 MED-FLAG copy replacements (loaded surfaces)");

  assertIncludes(app, '<span class="badge">Easiest to measure</span>', "app.js ranking badge is Easiest to measure");
  assertIncludes(
    runtime,
    '<span class="badge">Easiest to measure</span>',
    "runtime-fixes.js ranking badge is Easiest to measure"
  );
  assertExcludes(app, '<span class="badge">Recommended</span>', "app.js badge is not Recommended");
  assertExcludes(runtime, '<span class="badge">Recommended</span>', "runtime-fixes.js badge is not Recommended");
  assertIncludes(html, "<h2>Water amounts by measurement ease</h2>", "results heading uses measurement framing");
  assertExcludes(html, "Recommended water amounts", "results heading is not Recommended water amounts");

  assertIncludes(html, "Enter the dose you already planned", "wizard step 2 uses planned-dose framing");
  assertIncludes(html, "FitGen does not suggest therapeutic doses.", "wizard helper states FitGen does not suggest therapeutic doses");
  assertIncludes(html, "Planned dose (mg)", "wizard dose label is Planned dose");
  assertIncludes(app, "Planned dose (${unitLabel})", "app.js unit label uses Planned dose");
  assertExcludes(html, "What's your desired dose?", "wizard title is not desired-dose framing");
  assertExcludes(html, "Desired dose (mg)", "wizard label is not Desired dose");

  assertIncludes(html, "<h2>Saved peptides/plans</h2>", "cabinet heading is Saved peptides/plans");
  assertIncludes(html, "Store your peptide plans here.", "cabinet helper uses plans, not prescriptions");
  assertIncludes(
    html,
    "Each saved plan shows the planned measurement and draw volume.",
    "cabinet fill copy uses measurement phrasing"
  );
  assertExcludes(html, "Saved prescriptions", "cabinet heading is not Saved prescriptions");
  assertExcludes(html, "how much to take", "cabinet helper does not say how much to take");

  assertIncludes(
    html,
    "Staying at or under 3 mL is a typical physical fit for many vials.",
    "wizard water warning uses physical-fit framing"
  );
  assertIncludes(
    app,
    "Staying at or under 3 mL is a typical physical fit for many vials.",
    "app.js water warning uses physical-fit framing"
  );
  assertExcludes(loaded, "usually preferred", "loaded surfaces do not say usually preferred");

  assertIncludes(html, "measurement-planner math", "marketing meta uses measurement-planner language");
  assertExcludes(html, "safety-first", "marketing meta does not say safety-first");

  assertIncludes(
    app,
    "Planned dose: ${formatDose(schedule.doseAmount, schedule.unitLabel)}. Measure ${formatDrawMl(schedule.doseMl)} from the constituted vial.",
    "app.js reminder body uses planned-dose framing"
  );
  assertIncludes(
    runtime,
    "Planned dose: ${formatDose(nextReminder.schedule.doseAmount, nextReminder.schedule.unitLabel)}. Measure ${formatDrawMl(nextReminder.schedule.doseMl)}.",
    "runtime-fixes.js reminder body uses planned-dose framing"
  );
  assert(
    !/\bTake\s+\$\{/.test(app) && !/\bTake\s+\$\{/.test(runtime),
    "loaded reminder paths no longer start with Take ${…}"
  );

  assertIncludes(app, '${index === 0 ? "recommended" : ""}', "app.js keeps recommended CSS class (visual identity)");
  assertIncludes(
    runtime,
    '${index === 0 ? "recommended" : ""}',
    "runtime-fixes.js keeps recommended CSS class (visual identity)"
  );
  assertIncludes(app, "function fireReminder(schedule)", "app.js reminder function is still present (no architecture rewrite)");
  assertIncludes(html, 'id="push-sync-now"', "schedule sync control id is unchanged (sync not re-enabled)");

  console.log(`${passed} passed, ${failed} failed`);
  if (failed) {
    process.exit(1);
  }
}

main();
