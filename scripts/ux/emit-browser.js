"use strict";

/**
 * Emits a browser IIFE for src/occ + src/ux so Taken/Undo can call FR-SCH-000.
 */

const fs = require("fs");
const path = require("path");
const { repoRoot, walkFiles } = require("../ci/lib");
const { compileUxModules } = require("./harness");

const BUNDLE_REL = "src/ux/p0-ux.browser.js";

function listJsFiles(outDir) {
  return walkFiles(outDir, { extensions: new Set([".js"]) }).map((abs) => ({
    abs,
    id: path
      .relative(outDir, abs)
      .split(path.sep)
      .join("/")
      .replace(/\.js$/, ""),
  }));
}

function buildBundleSource(outDir) {
  const files = listJsFiles(outDir);
  const modules = files
    .map(({ abs, id }) => {
      const body = fs.readFileSync(abs, "utf8");
      const dir = id.includes("/") ? id.slice(0, id.lastIndexOf("/")) : "";
      return `
  modules[${JSON.stringify(id)}] = { exports: {} };
  modules[${JSON.stringify(id)}].dirname = ${JSON.stringify(dir)};
  (function (exports, require, module, __dirname) {
${body}
  })(
    modules[${JSON.stringify(id)}].exports,
    createRequire(modules[${JSON.stringify(id)}].dirname),
    modules[${JSON.stringify(id)}],
    ${JSON.stringify(dir)}
  );
`;
    })
    .join("\n");

  return `/* Generated from src/occ + src/ux. Do not edit by hand. */
(function (root) {
  var modules = Object.create(null);
  function createRequire(fromDir) {
    return function (spec) {
      if (typeof spec !== "string") {
        throw new Error("P0.UX bundle: invalid require");
      }
      var cleaned = spec.replace(/\\\\/g, "/").replace(/\\.js$/, "");
      var resolved;
      if (cleaned.charAt(0) === ".") {
        var base = fromDir ? fromDir + "/" + cleaned : cleaned;
        resolved = base.split("/").reduce(function (acc, part) {
          if (part === "." || part === "") {
            return acc;
          }
          if (part === "..") {
            acc.pop();
            return acc;
          }
          acc.push(part);
          return acc;
        }, []).join("/");
      } else {
        resolved = cleaned;
      }
      if (!modules[resolved]) {
        throw new Error("P0.UX bundle: missing module " + resolved);
      }
      return modules[resolved].exports;
    };
  }
${modules}
  root.FitGenP0Ux = modules["ux/index"].exports;
})(typeof window !== "undefined" ? window : globalThis);
`;
}

function emitBrowserBundle() {
  const { outDir } = compileUxModules();
  const source = buildBundleSource(outDir);
  const dest = path.join(repoRoot(), BUNDLE_REL);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, source);
  return dest;
}

if (require.main === module) {
  const dest = emitBrowserBundle();
  process.stdout.write(`wrote ${dest}\n`);
}

module.exports = {
  BUNDLE_REL,
  buildBundleSource,
  emitBrowserBundle,
};
