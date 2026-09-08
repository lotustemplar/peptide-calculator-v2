"use strict";

/**
 * Compiles src/occ TypeScript to CommonJS for P0.OCC tests.
 * Production browser files are not loaded and are not modified.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const ts = require("typescript");
const { repoRoot } = require("../ci/lib");

const OCC_SRC = path.join(repoRoot(), "src", "occ");

function compileOccurrenceModules() {
  const entries = fs
    .readdirSync(OCC_SRC)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => path.join(OCC_SRC, name));

  if (!entries.length) {
    throw new Error("P0.OCC harness: no TypeScript files under src/occ");
  }

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitgen-occ-"));
  const program = ts.createProgram(entries, {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    outDir,
    rootDir: OCC_SRC,
    declaration: false,
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

  return require(path.join(outDir, "index.js"));
}

module.exports = {
  OCC_SRC,
  compileOccurrenceModules,
};
