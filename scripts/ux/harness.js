"use strict";

/**
 * Compiles src/occ + src/ux TypeScript to CommonJS for P0.UX tests.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const ts = require("typescript");
const { repoRoot } = require("../ci/lib");

const SRC_ROOT = path.join(repoRoot(), "src");

function collectTsFiles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectTsFiles(abs));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".ts")) {
      found.push(abs);
    }
  }
  return found.sort();
}

function compileUxModules() {
  const entries = collectTsFiles(SRC_ROOT).filter((abs) => !abs.endsWith(".browser.ts"));
  if (!entries.length) {
    throw new Error("P0.UX harness: no TypeScript files under src/");
  }

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitgen-ux-"));
  const program = ts.createProgram(entries, {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    outDir,
    rootDir: SRC_ROOT,
    declaration: false,
    removeComments: true,
  });

  const emit = program.emit();
  const diagnostics = ts.getPreEmitDiagnostics(program).concat(emit.diagnostics);
  const errors = diagnostics.filter((item) => item.category === ts.DiagnosticCategory.Error);
  if (errors.length) {
    const host = {
      getCurrentDirectory: () => process.cwd(),
      getCanonicalFileName: (fileName) => fileName,
      getNewLine: () => ts.sys.newLine,
    };
    throw new Error(ts.formatDiagnostics(errors, host));
  }

  return {
    ux: require(path.join(outDir, "ux", "index.js")),
    outDir,
  };
}

module.exports = {
  SRC_ROOT,
  collectTsFiles,
  compileUxModules,
};
