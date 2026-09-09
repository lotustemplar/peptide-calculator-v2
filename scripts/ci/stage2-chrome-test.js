#!/usr/bin/env node
"use strict";

/**
 * Stage 2 chrome/assets checks. Does not execute calculator math.
 * Confirms allowlisted icon files, token names, and quarantined calc/persistence surfaces.
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

function pngChunks(buf) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(sig)) {
    return { ok: false, chunks: [] };
  }
  const chunks = [];
  let offset = 8;
  while (offset + 12 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buf.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 12 + length;
    if (type === "IEND") {
      break;
    }
  }
  return { ok: true, chunks };
}

function chunkText(chunks) {
  const parts = [];
  for (const chunk of chunks) {
    if (chunk.type === "tEXt" || chunk.type === "iTXt" || chunk.type === "zTXt" || chunk.type === "eXIf") {
      parts.push(`${chunk.type}:${chunk.data.toString("utf8")}`);
    }
  }
  return parts.join("\n");
}

const SECRET_RE =
  /api[_-]?key|secret|password|authorization:\s*bearer|-----BEGIN|sk_live|ghp_[A-Za-z0-9]|xox[baprs]-/i;
const PHI_RE = /\b(?:ssn|social security|date of birth|dob|mrn)\b/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const DENIED_QR = /peptide-app-phone-qr/i;

function main() {
  console.log("Stage 2 chrome/assets");

  const icons = ["icon.png", "icon-192.png", "icon-512.png", "icon.svg"];
  for (const rel of icons) {
    const abs = path.join(ROOT, rel);
    assert(fs.existsSync(abs), `${rel} exists`);
  }

  for (const rel of ["icon.png", "icon-192.png", "icon-512.png"]) {
    const buf = fs.readFileSync(path.join(ROOT, rel));
    const parsed = pngChunks(buf);
    assert(parsed.ok, `${rel} has PNG signature`);
    const meta = chunkText(parsed.chunks);
    assert(!SECRET_RE.test(meta), `${rel} has no secret-like PNG text`);
    assert(!PHI_RE.test(meta), `${rel} has no PHI-marker PNG text`);
    assert(!EMAIL_RE.test(meta), `${rel} has no email PNG text`);
    assert(!parsed.chunks.some((c) => c.type === "eXIf"), `${rel} has no eXIf chunk`);
  }

  const svg = readText(path.join(ROOT, "icon.svg"));
  assert(!/<script/i.test(svg), "icon.svg has no script tags");
  assert(!/foreignObject/i.test(svg), "icon.svg has no foreignObject");
  assert(!DENIED_QR.test(svg), "icon.svg is not the denied QR asset");

  const css = readText(path.join(ROOT, "styles.css"));
  for (const token of [
    "--font-ui",
    "--font-display",
    "--fitgen-canvas",
    "--fitgen-theme",
    "--fitgen-theme-rgb",
    "--space-safe-top",
    "--space-safe-bottom",
  ]) {
    assert(css.includes(token), `styles.css defines ${token}`);
  }
  assert(!/buildOptions|buildWaterOptions/.test(css), "styles.css does not contain calculator builders");

  const html = readText(path.join(ROOT, "index.html"));
  assert(/id="calculator-form"/.test(html), "calculator-form still present");
  assert(/id="vial-mg"/.test(html), "vial-mg still present");
  assert(/id="dose-mg"/.test(html), "dose-mg still present");
  assert(/viewport-fit=cover/.test(html), "viewport-fit=cover on chrome viewport");
  assert(/icon-192\.png/.test(html), "index.html links icon-192.png");
  assert(!/peptide-app-phone-qr/.test(html), "denied QR not referenced");
  assert(
    !/src="\.\/assets\/(?:vial|syringe|dose)-step\.png"/.test(html),
    "baseline wizard rasters are not wired to the calculator"
  );

  const manifest = JSON.parse(readText(path.join(ROOT, "manifest.webmanifest")));
  const srcs = (manifest.icons || []).map((icon) => icon.src);
  assert(srcs.includes("./icon.svg"), "manifest keeps SVG icon");
  assert(srcs.includes("./icon-192.png"), "manifest lists icon-192.png");
  assert(srcs.includes("./icon-512.png"), "manifest lists icon-512.png");

  const frozenGoldens = "659c1865da95c3197395c931e154c4267c802d8aaf7842aee83345962d013acd";
  const actualGoldens = sha256File("scripts/calc/fixtures/legacy-evidence-goldens.json");
  assert(actualGoldens === frozenGoldens, "calc goldens SHA-256 unchanged vs Stage 2 freeze");

  const frozenApp = "489cd7b88b90e00bd2a700518312577cf5a65cf12cacc003d9a181422606a537";
  assert(sha256File("app.js") === frozenApp, "app.js SHA-256 unchanged (no calc/persistence edits)");

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    process.exit(1);
  }
}

main();
