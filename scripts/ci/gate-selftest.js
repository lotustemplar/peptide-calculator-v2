"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CI_DIR = __dirname;
const ROOT = path.resolve(__dirname, "../..");

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

function runCheck(scriptName, env) {
  const script = path.join(CI_DIR, scriptName);
  return spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function makeTempRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function write(root, relPath, contents) {
  const abs = path.join(root, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents);
}

function testLint() {
  console.log("eslint (npm run lint)");
  const probe = path.join(ROOT, "scripts", ".lint-probe-temp.js");
  fs.writeFileSync(probe, "debugger;\n");
  try {
    const result = spawnSync(
      process.execPath,
      [path.join(ROOT, "node_modules", "eslint", "bin", "eslint.js"), "scripts/.lint-probe-temp.js", "--max-warnings", "0"],
      { cwd: ROOT, encoding: "utf8" }
    );
    assert(result.status !== 0, "fails the job when a lint violation is introduced");
    assert(
      /debugger/.test(`${result.stdout || ""}\n${result.stderr || ""}`),
      "reports the debugger violation"
    );
  } finally {
    fs.unlinkSync(probe);
  }

  const clean = spawnSync("npm", ["run", "lint"], { cwd: ROOT, encoding: "utf8" });
  assert(clean.status === 0, "passes lint on the current scripts/ tree");
}

function testLockfiles() {
  console.log("check-lockfiles.js");
  const missingRoot = makeTempRoot("fitgen-lock-missing-");
  const missing = runCheck("check-lockfiles.js", { FITGEN_CI_ROOT: missingRoot });
  assert(missing.status !== 0, "fails when lockfiles are absent");

  const presentRoot = makeTempRoot("fitgen-lock-present-");
  write(presentRoot, "package-lock.json", "{}");
  write(presentRoot, "backend/package-lock.json", "{}");
  const present = runCheck("check-lockfiles.js", { FITGEN_CI_ROOT: presentRoot });
  assert(present.status === 0, "passes when both lockfiles exist");

  const repo = runCheck("check-lockfiles.js", { FITGEN_CI_ROOT: ROOT });
  assert(repo.status === 0, "passes on the current repository");
}

function testNoNewFix() {
  console.log("check-no-new-fix-js.js");
  const allowDir = makeTempRoot("fitgen-fix-allow-");
  write(allowDir, "runtime-fix-js.txt", "legacy-fix.js\n");

  const cleanRoot = makeTempRoot("fitgen-fix-clean-");
  write(cleanRoot, "legacy-fix.js", "/* baseline */\n");
  const clean = runCheck("check-no-new-fix-js.js", {
    FITGEN_CI_ROOT: cleanRoot,
    FITGEN_CI_ALLOWLIST_DIR: allowDir,
  });
  assert(clean.status === 0, "passes when only allowlisted *-fix.js files exist");

  const dirtyRoot = makeTempRoot("fitgen-fix-dirty-");
  write(dirtyRoot, "legacy-fix.js", "/* baseline */\n");
  write(dirtyRoot, "brand-new-fix.js", "/* forbidden */\n");
  const dirty = runCheck("check-no-new-fix-js.js", {
    FITGEN_CI_ROOT: dirtyRoot,
    FITGEN_CI_ALLOWLIST_DIR: allowDir,
  });
  assert(dirty.status !== 0, "fails when a new *-fix.js file is added");
  assert(
    (dirty.stderr || "").includes("brand-new-fix.js"),
    "names the new *-fix.js file in the failure output"
  );

  const repo = runCheck("check-no-new-fix-js.js", { FITGEN_CI_ROOT: ROOT });
  assert(repo.status === 0, "passes on the current repository allowlist");
}

function testForbiddenCopy() {
  console.log("check-forbidden-copy.js");
  const allowDir = makeTempRoot("fitgen-copy-allow-");
  write(
    allowDir,
    "forbidden-copy.json",
    JSON.stringify({
      entries: [
        {
          file: "index.html",
          patternId: "RECOMMENDED",
          excerpt: "Recommended water amounts",
        },
      ],
    })
  );

  const cleanRoot = makeTempRoot("fitgen-copy-clean-");
  write(cleanRoot, "index.html", "<h2>Recommended water amounts</h2>\n");
  write(cleanRoot, "docs/spec.md", "forbidden example: safe to combine\n");
  const clean = runCheck("check-forbidden-copy.js", {
    FITGEN_CI_ROOT: cleanRoot,
    FITGEN_CI_ALLOWLIST_DIR: allowDir,
  });
  assert(clean.status === 0, "passes allowlisted Recommended and ignores docs/");

  const clearanceRoot = makeTempRoot("fitgen-copy-clearance-");
  write(clearanceRoot, "app.js", "export const note = 'safe to combine';\n");
  const clearance = runCheck("check-forbidden-copy.js", {
    FITGEN_CI_ROOT: clearanceRoot,
    FITGEN_CI_ALLOWLIST_DIR: allowDir,
  });
  assert(clearance.status !== 0, "fails on new 'safe to combine'");
  assert(
    (clearance.stderr || "").includes("SAFE_TO_COMBINE"),
    "labels the clearance hit as SAFE_TO_COMBINE"
  );

  const recommendedRoot = makeTempRoot("fitgen-copy-rec-");
  write(recommendedRoot, "index.html", "<h2>Recommended water amounts</h2>\n<span>Recommended</span>\n");
  const recommended = runCheck("check-forbidden-copy.js", {
    FITGEN_CI_ROOT: recommendedRoot,
    FITGEN_CI_ALLOWLIST_DIR: allowDir,
  });
  assert(recommended.status !== 0, "fails on a new clinical Recommended outside the allowlist");

  const interactionRoot = makeTempRoot("fitgen-copy-int-");
  write(interactionRoot, "ui.js", "status.textContent = 'no interactions found';\n");
  const interaction = runCheck("check-forbidden-copy.js", {
    FITGEN_CI_ROOT: interactionRoot,
    FITGEN_CI_ALLOWLIST_DIR: allowDir,
  });
  assert(interaction.status !== 0, "fails on new 'no interactions found'");

  const directiveRoot = makeTempRoot("fitgen-copy-dir-");
  write(directiveRoot, "help.html", "<p>Increase your dose tomorrow.</p>\n");
  const directive = runCheck("check-forbidden-copy.js", {
    FITGEN_CI_ROOT: directiveRoot,
    FITGEN_CI_ALLOWLIST_DIR: allowDir,
  });
  assert(directive.status !== 0, "fails on a treatment-directive 'increase your dose'");

  const repo = runCheck("check-forbidden-copy.js", { FITGEN_CI_ROOT: ROOT });
  assert(repo.status === 0, "passes on the current repository allowlist");
}

function main() {
  console.log("P0.0 CI baseline self-tests (gates only; no calculator goldens yet).\n");
  testLint();
  testLockfiles();
  testNoNewFix();
  testForbiddenCopy();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    process.exit(1);
  }
}

main();
