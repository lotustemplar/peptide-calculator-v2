"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { PATTERNS } = require("./check-forbidden-copy");
const repoCopyAllowlist = require("./allowlists/forbidden-copy.json");

const CI_DIR = __dirname;
const ROOT = path.resolve(__dirname, "../..");

const PATTERN_NEGATIVES = {
  SAFE_TO_COMBINE: "Users may think it is safe to combine these.",
  NO_INTERACTIONS_FOUND: "Status: no interactions found.",
  ALL_CLEAR: "Screening result: all clear.",
  INJECT_AS_FOLLOWS: "Inject as follows after reconstitution.",
  CLEARING_RESEARCH: "We are clearing research peptides for home use.",
  STOP_DOSE: "Please stop your dose tonight.",
  START_DOSE: "Please start the dose tomorrow.",
  INCREASE_DOSE: "Increase your dose by one mark.",
  DECREASE_DOSE: "Decrease the dose next week.",
  RECOMMENDED: "This is the recommended option.",
  SAVED_PRESCRIPTIONS: "Open Saved prescriptions to continue.",
  HOW_MUCH_TO_TAKE: "Shows how much to take tonight.",
  SAFETY_FIRST: "Marketing: safety-first dose math.",
  USUALLY_PREFERRED: "This vial size is usually preferred.",
  TAKE_AND_DRAW: "Take 3 mg and draw 0.5 mL.",
};

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

function runCheck(scriptName, env) {
  const script = path.join(CI_DIR, scriptName);
  return spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
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

function writePathAllowlist(root, name, paths) {
  write(root, path.posix.join("scripts/ci/allowlists", name), `${paths.join("\n")}\n`);
}

function writeCopyAllowlist(root, entries) {
  write(
    root,
    "scripts/ci/allowlists/forbidden-copy.json",
    JSON.stringify({ entries }, null, 2)
  );
}

function cleanupTemps() {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
}

function lintEnv(allowDir, baseRoot, files) {
  return {
    FITGEN_CI_LINT_FILES: files,
    FITGEN_CI_SKIP_SCRIPTS: "1",
    FITGEN_CI_BASE_ROOT: baseRoot,
    FITGEN_CI_ALLOWLIST_DIR: allowDir,
  };
}

function testLint() {
  console.log("check-lint.js");
  const srcDir = path.join(ROOT, "src");
  const probes = {
    "src/.lint-probe-temp.js": "debugger;\n",
    "src/.lint-probe-temp.cjs": "debugger;\n",
    "src/.lint-probe-temp.mjs": "debugger;\n",
    "src/.lint-ok-temp.js": "export const dose = 1;\n",
    "src/.lint-ok-temp.cjs": "\"use strict\";\nmodule.exports = { dose: 1 };\n",
    "src/.lint-ok-temp.mjs": "export const dose = 1;\nexport function formatDose(value) {\n  return String(value);\n}\n",
    "src/.lint-probe-temp.ts": "const dose: number = 1;\nexport { dose };\n",
  };

  fs.mkdirSync(srcDir, { recursive: true });
  for (const [rel, contents] of Object.entries(probes)) {
    write(ROOT, rel, contents);
  }

  const legacyPaths = ["app.js"];
  const baseRoot = makeTempRoot("fitgen-lint-base-");
  writePathAllowlist(baseRoot, "legacy-lint-paths.txt", legacyPaths);
  const allowDir = makeTempRoot("fitgen-lint-allow-");
  write(allowDir, "legacy-lint-paths.txt", `${legacyPaths.join("\n")}\n`);

  try {
    for (const ext of ["js", "cjs", "mjs"]) {
      const rel = `src/.lint-probe-temp.${ext}`;
      const hit = runCheck("check-lint.js", lintEnv(allowDir, baseRoot, rel));
      const out = `${hit.stdout || ""}\n${hit.stderr || ""}`;
      assert(hit.status !== 0, `fails lint on a debugger violation in .${ext}`);
      assert(/debugger/.test(out), `reports the debugger violation for .${ext}`);
    }

    for (const ext of ["js", "cjs", "mjs"]) {
      const rel = `src/.lint-ok-temp.${ext}`;
      const ok = runCheck("check-lint.js", lintEnv(allowDir, baseRoot, rel));
      assert(ok.status === 0, `passes lint on a valid .${ext} fixture`);
    }

    const tsHit = runCheck(
      "check-lint.js",
      lintEnv(allowDir, baseRoot, "src/.lint-probe-temp.ts")
    );
    const tsOut = `${tsHit.stdout || ""}\n${tsHit.stderr || ""}`;
    assert(tsHit.status !== 0, "fails closed when a TypeScript file is introduced");
    assert(
      /typed linting|TypeScript\/TSX is outside/i.test(tsOut),
      "points TypeScript files at the typed-linting prerequisite instead of parsing them as JS"
    );
    assert(
      !/Parsing error/i.test(tsOut),
      "does not report a stock Espree parse error for TypeScript"
    );

    const skippedLegacy = runCheck("check-lint.js", lintEnv(allowDir, baseRoot, "app.js"));
    assert(skippedLegacy.status === 0, "does not lint grandfathered legacy paths");
  } finally {
    for (const rel of Object.keys(probes)) {
      fs.rmSync(path.join(ROOT, rel), { force: true });
    }
    fs.rmSync(srcDir, { recursive: true, force: true });
  }

  const clean = spawnSync("npm", ["run", "lint"], { cwd: ROOT, encoding: "utf8" });
  assert(clean.status === 0, "passes lint on the current changed-file surface");
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
  const baseRoot = makeTempRoot("fitgen-fix-base-");
  writePathAllowlist(baseRoot, "runtime-fix-js.txt", ["legacy-fix.js"]);

  const cleanRoot = makeTempRoot("fitgen-fix-clean-");
  write(cleanRoot, "legacy-fix.js", "/* baseline */\n");
  const clean = runCheck("check-no-new-fix-js.js", {
    FITGEN_CI_ROOT: cleanRoot,
    FITGEN_CI_ALLOWLIST_DIR: allowDir,
    FITGEN_CI_BASE_ROOT: baseRoot,
  });
  assert(clean.status === 0, "passes when only allowlisted *-fix.js files exist");

  const dirtyRoot = makeTempRoot("fitgen-fix-dirty-");
  write(dirtyRoot, "legacy-fix.js", "/* baseline */\n");
  write(dirtyRoot, "brand-new-fix.js", "/* forbidden */\n");
  const dirty = runCheck("check-no-new-fix-js.js", {
    FITGEN_CI_ROOT: dirtyRoot,
    FITGEN_CI_ALLOWLIST_DIR: allowDir,
    FITGEN_CI_BASE_ROOT: baseRoot,
  });
  assert(dirty.status !== 0, "fails when a new *-fix.js file is added");
  assert(
    (dirty.stderr || "").includes("brand-new-fix.js"),
    "names the new *-fix.js file in the failure output"
  );

  const bypassAllow = makeTempRoot("fitgen-fix-bypass-allow-");
  write(bypassAllow, "runtime-fix-js.txt", "legacy-fix.js\nbrand-new-fix.js\n");
  const bypassRoot = makeTempRoot("fitgen-fix-bypass-");
  write(bypassRoot, "legacy-fix.js", "/* baseline */\n");
  write(bypassRoot, "brand-new-fix.js", "/* forbidden */\n");
  const bypass = runCheck("check-no-new-fix-js.js", {
    FITGEN_CI_ROOT: bypassRoot,
    FITGEN_CI_ALLOWLIST_DIR: bypassAllow,
    FITGEN_CI_BASE_ROOT: baseRoot,
  });
  assert(bypass.status !== 0, "fails when a new *-fix.js file is added together with an allowlist row");

  const retiredAllow = makeTempRoot("fitgen-fix-retired-allow-");
  write(retiredAllow, "runtime-fix-js.txt", "legacy-fix.js\n");
  const retiredBase = makeTempRoot("fitgen-fix-retired-base-");
  writePathAllowlist(retiredBase, "runtime-fix-js.txt", ["legacy-fix.js", "old-fix.js"]);
  const retiredRoot = makeTempRoot("fitgen-fix-retired-");
  write(retiredRoot, "legacy-fix.js", "/* baseline */\n");
  const retired = runCheck("check-no-new-fix-js.js", {
    FITGEN_CI_ROOT: retiredRoot,
    FITGEN_CI_ALLOWLIST_DIR: retiredAllow,
    FITGEN_CI_BASE_ROOT: retiredBase,
  });
  assert(retired.status === 0, "allows removing a retired *-fix.js allowlist row");

  const repo = runCheck("check-no-new-fix-js.js", { FITGEN_CI_ROOT: ROOT });
  assert(repo.status === 0, "passes on the current repository allowlist");
}

function testForbiddenCopy() {
  console.log("check-forbidden-copy.js");
  const recommendedEntry = {
    file: "index.html",
    patternId: "RECOMMENDED",
    context: "<h2>Recommended water amounts</h2>",
  };
  const allowDir = makeTempRoot("fitgen-copy-allow-");
  write(allowDir, "forbidden-copy.json", JSON.stringify({ entries: [recommendedEntry] }));
  const baseRoot = makeTempRoot("fitgen-copy-base-");
  writeCopyAllowlist(baseRoot, [recommendedEntry]);

  const cleanRoot = makeTempRoot("fitgen-copy-clean-");
  write(cleanRoot, "index.html", "<h2>Recommended water amounts</h2>\n");
  write(cleanRoot, "docs/spec.md", "forbidden example: safe to combine\n");
  const clean = runCheck("check-forbidden-copy.js", {
    FITGEN_CI_ROOT: cleanRoot,
    FITGEN_CI_ALLOWLIST_DIR: allowDir,
    FITGEN_CI_BASE_ROOT: baseRoot,
  });
  assert(clean.status === 0, "passes allowlisted Recommended and ignores docs/");

  const relocatedRoot = makeTempRoot("fitgen-copy-reloc-");
  write(relocatedRoot, "index.html", "<span>Recommended dose</span>\n");
  const relocated = runCheck("check-forbidden-copy.js", {
    FITGEN_CI_ROOT: relocatedRoot,
    FITGEN_CI_ALLOWLIST_DIR: allowDir,
    FITGEN_CI_BASE_ROOT: baseRoot,
  });
  assert(
    relocated.status !== 0,
    "fails when the allowed Recommended occurrence is replaced by the same token in a different context"
  );

  const lowercaseRoot = makeTempRoot("fitgen-copy-lower-");
  write(lowercaseRoot, "ui.js", "label.textContent = 'recommended';\n");
  const lowercase = runCheck("check-forbidden-copy.js", {
    FITGEN_CI_ROOT: lowercaseRoot,
    FITGEN_CI_ALLOWLIST_DIR: allowDir,
    FITGEN_CI_BASE_ROOT: baseRoot,
  });
  assert(lowercase.status !== 0, "fails on lowercase clinical recommended");
  assert(
    (lowercase.stderr || "").includes("RECOMMENDED"),
    "labels lowercase recommended as RECOMMENDED"
  );

  const literalRoot = makeTempRoot("fitgen-copy-literal-");
  write(literalRoot, "help.html", "<p>Take 3 mg and draw 0.5 mL.</p>\n");
  const literal = runCheck("check-forbidden-copy.js", {
    FITGEN_CI_ROOT: literalRoot,
    FITGEN_CI_ALLOWLIST_DIR: allowDir,
    FITGEN_CI_BASE_ROOT: baseRoot,
  });
  assert(literal.status !== 0, "fails on a literal Take … and draw directive");
  assert(
    (literal.stderr || "").includes("TAKE_AND_DRAW"),
    "labels the literal Take/draw hit as TAKE_AND_DRAW"
  );

  const interpolatedRoot = makeTempRoot("fitgen-copy-interp-");
  write(interpolatedRoot, "notify.js", "const body = `Take ${formatDose(schedule.doseAmount)} and draw ${ml}.`;\n");
  const interpolated = runCheck("check-forbidden-copy.js", {
    FITGEN_CI_ROOT: interpolatedRoot,
    FITGEN_CI_ALLOWLIST_DIR: allowDir,
    FITGEN_CI_BASE_ROOT: baseRoot,
  });
  assert(interpolated.status !== 0, "fails on an interpolated Take ${…} and draw directive");

  const neutralRoot = makeTempRoot("fitgen-copy-neutral-");
  write(neutralRoot, "notes.md", "Take the lockfile and draw a diagram of the workflow.\n");
  const neutral = runCheck("check-forbidden-copy.js", {
    FITGEN_CI_ROOT: neutralRoot,
    FITGEN_CI_ALLOWLIST_DIR: allowDir,
    FITGEN_CI_BASE_ROOT: baseRoot,
  });
  assert(neutral.status === 0, "does not false-positive neutral 'take … and draw' documentation");

  const missingIds = PATTERNS.map((pattern) => pattern.id).filter((id) => !PATTERN_NEGATIVES[id]);
  assert(missingIds.length === 0, "table-driven negatives cover every PATTERNS id");

  for (const pattern of PATTERNS) {
    const fixtureRoot = makeTempRoot(`fitgen-copy-${pattern.id.toLowerCase()}-`);
    write(fixtureRoot, "probe.html", `<p>${PATTERN_NEGATIVES[pattern.id]}</p>\n`);
    const result = runCheck("check-forbidden-copy.js", {
      FITGEN_CI_ROOT: fixtureRoot,
      FITGEN_CI_ALLOWLIST_DIR: allowDir,
      FITGEN_CI_BASE_ROOT: baseRoot,
    });
    assert(result.status !== 0, `fails on new ${pattern.id} copy`);
    assert(
      (result.stderr || "").includes(pattern.id),
      `labels the ${pattern.id} hit with its pattern id`
    );
  }

  for (const entry of repoCopyAllowlist.entries) {
    const fixtureRoot = makeTempRoot("fitgen-copy-allowed-");
    write(fixtureRoot, entry.file, `${entry.context}\n`);
    const allowedDir = makeTempRoot("fitgen-copy-allowed-allow-");
    write(allowedDir, "forbidden-copy.json", JSON.stringify({ entries: [entry] }));
    const allowedBase = makeTempRoot("fitgen-copy-allowed-base-");
    writeCopyAllowlist(allowedBase, [entry]);
    const result = runCheck("check-forbidden-copy.js", {
      FITGEN_CI_ROOT: fixtureRoot,
      FITGEN_CI_ALLOWLIST_DIR: allowedDir,
      FITGEN_CI_BASE_ROOT: allowedBase,
    });
    assert(result.status === 0, `passes the baseline fixture for ${entry.file} ${entry.patternId}`);
  }

  const bypassAllow = makeTempRoot("fitgen-copy-bypass-allow-");
  write(
    bypassAllow,
    "forbidden-copy.json",
    JSON.stringify({
      entries: [
        recommendedEntry,
        {
          file: "app.js",
          patternId: "SAFE_TO_COMBINE",
          context: "export const note = 'safe to combine';",
        },
      ],
    })
  );
  const bypassRoot = makeTempRoot("fitgen-copy-bypass-");
  write(bypassRoot, "index.html", "<h2>Recommended water amounts</h2>\n");
  write(bypassRoot, "app.js", "export const note = 'safe to combine';\n");
  const bypass = runCheck("check-forbidden-copy.js", {
    FITGEN_CI_ROOT: bypassRoot,
    FITGEN_CI_ALLOWLIST_DIR: bypassAllow,
    FITGEN_CI_BASE_ROOT: baseRoot,
  });
  assert(
    bypass.status !== 0,
    "fails when new forbidden copy is added together with a new allowlist exception"
  );

  const repo = runCheck("check-forbidden-copy.js", { FITGEN_CI_ROOT: ROOT });
  assert(repo.status === 0, "passes on the current repository allowlist");
}

function main() {
  console.log("P0.0 CI baseline self-tests (gates only; no calculator goldens yet).\n");
  try {
    testLint();
    testLockfiles();
    testNoNewFix();
    testForbiddenCopy();
  } finally {
    cleanupTemps();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    process.exit(1);
  }
}

main();
