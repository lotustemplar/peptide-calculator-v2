#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { SKIP_DIR_NAMES, walkFiles } = require("../ci/lib");
const {
  DIRECTORIES,
  FILES,
  RETIRED_RUNTIME_PATCHES,
  prepareWww,
} = require("./prepare-www");

const ROOT = path.resolve(__dirname, "../..");

let passed = 0;
let failed = 0;
const tempDirs = [];

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${message}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL  ${message}`);
}

function makeTempRoot(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function write(root, relPath, contents) {
  const abs = path.join(root, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents);
}

function loadedScriptHrefs() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  return [...html.matchAll(/<script\s+src="\.\/([^"]+)"/g)].map((match) => match[1]);
}

function loadedStylesheetHrefs() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  return [...html.matchAll(/<link[^>]+href="\.\/([^"]+)"/g)].map((match) => match[1]);
}

function testSkipDirs() {
  console.log("CI skip dirs for Capacitor trees");
  assert(SKIP_DIR_NAMES.has("www"), "walkFiles skips www/");
  assert(SKIP_DIR_NAMES.has("android"), "walkFiles skips android/");
  assert(SKIP_DIR_NAMES.has("ios"), "walkFiles skips ios/");

  const root = makeTempRoot("fitgen-android-skip-");
  write(root, "app.js", "ok\n");
  write(root, "www/runtime-fixes.js", "copied grandfathered patch\n");
  write(root, "android/app/src/main/assets/public/runtime-fixes.js", "copied grandfathered patch\n");
  const found = walkFiles(root).map((abs) => path.relative(root, abs).split(path.sep).join("/"));
  assert(found.includes("app.js"), "still walks the real app tree");
  assert(!found.some((rel) => rel.startsWith("www/")), "does not walk generated www/ copies");
  assert(!found.some((rel) => rel.startsWith("android/")), "does not walk generated android/ copies");
}

function testPrepareWwwMatchesCurrentMain() {
  console.log("prepare-www.js matches current main");
  const hrefs = loadedScriptHrefs();
  assert(hrefs.length > 0, "index.html lists script src files");
  for (const href of hrefs) {
    assert(FILES.includes(href), `copy list includes loaded script ${href}`);
  }
  for (const href of loadedStylesheetHrefs()) {
    assert(FILES.includes(href), `copy list includes linked asset ${href}`);
  }
  assert(FILES.includes("styles.css"), "copy list includes styles.css");
  assert(FILES.includes("icon.svg"), "copy list includes icon.svg");
  assert(FILES.includes("icon.png"), "copy list includes icon.png");
  assert(FILES.includes("icon-192.png"), "copy list includes icon-192.png");
  assert(FILES.includes("icon-512.png"), "copy list includes icon-512.png");
  assert(DIRECTORIES.includes("assets"), "copy list includes assets/");

  for (const retired of RETIRED_RUNTIME_PATCHES) {
    assert(!FILES.includes(retired), `copy list excludes retired ${retired}`);
  }

  const root = makeTempRoot("fitgen-www-");
  for (const rel of FILES) {
    write(root, rel, `asset:${rel}\n`);
  }
  write(root, "assets/Wizard-Step-1.png", "png\n");
  write(root, "backend/server.js", "do-not-copy\n");
  write(root, "export-fix.js", "retired-must-not-copy\n");
  write(root, "notification-fix.js", "unloaded\n");

  const result = prepareWww(root);
  assert(fs.existsSync(path.join(result.www, "index.html")), "writes www/index.html");
  assert(fs.existsSync(path.join(result.www, "src/ux/p0-ux.browser.js")), "preserves src/ux bundle path");
  assert(fs.existsSync(path.join(result.www, "icon-192.png")), "copies Stage 2 icon-192.png");
  assert(fs.existsSync(path.join(result.www, "assets/Wizard-Step-1.png")), "copies wizard assets");
  assert(!fs.existsSync(path.join(result.www, "backend/server.js")), "does not copy backend/");
  assert(!fs.existsSync(path.join(result.www, "export-fix.js")), "does not restore retired export-fix.js");
  assert(!fs.existsSync(path.join(result.www, "notification-fix.js")), "does not copy unloaded patches");
  assert(
    fs.readFileSync(path.join(result.www, "app.js"), "utf8") === "asset:app.js\n",
    "copies app.js bytes unchanged"
  );
}

function testWorkflowIsArtifactOnly() {
  console.log("android-apk.yml is Actions-artifact only");
  const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/android-apk.yml"), "utf8");
  assert(!/gh release/.test(workflow), "workflow does not create or update a GitHub Release");
  assert(!/softprops\/action-gh-release/.test(workflow), "workflow does not use a release action");
  assert(/upload-artifact@v4/.test(workflow), "workflow uploads an Actions artifact");
  assert(/fitgen-internal-test-apk/.test(workflow), "artifact name is fitgen-internal-test-apk");
  assert(/contents:\s*read/.test(workflow), "workflow uses contents: read (no release write)");
  assert(/emulator-smoke\.sh/.test(workflow), "workflow runs the POSIX emulator smoke script");
}

function testEmulatorSmokeScript() {
  console.log("emulator-smoke.sh");
  const script = path.join(ROOT, "scripts/android/emulator-smoke.sh");
  const parsed = spawnSync("sh", ["-n", script], { encoding: "utf8" });
  assert(parsed.status === 0, "POSIX sh -n accepts emulator-smoke.sh");
  const text = fs.readFileSync(script, "utf8");
  assert(text.includes("com.fitgen.peptidecalculator/.MainActivity"), "launches the Capacitor activity");
  assert(!text.includes("pipefail"), "does not use bash pipefail");
}

function main() {
  console.log("Android packaging tests (current-main www copy list + artifact-only workflow).\n");
  try {
    testSkipDirs();
    testPrepareWwwMatchesCurrentMain();
    testWorkflowIsArtifactOnly();
    testEmulatorSmokeScript();
  } finally {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    process.exit(1);
  }
}

main();
