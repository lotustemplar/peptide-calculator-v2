#!/usr/bin/env node
"use strict";

/**
 * Stage 2 chrome/assets checks. Does not execute calculator math.
 * Confirms baseline-derived chrome tokens, contrast gates, icons, and
 * quarantined calc/persistence surfaces.
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

function srgbChannel(hexPair) {
  const n = parseInt(hexPair, 16) / 255;
  return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const h = hex.replace("#", "").toLowerCase();
  if (h.length !== 6) {
    throw new Error(`expected 6-digit hex, got ${hex}`);
  }
  const r = srgbChannel(h.slice(0, 2));
  const g = srgbChannel(h.slice(2, 4));
  const b = srgbChannel(h.slice(4, 6));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA, hexB) {
  const a = luminance(hexA);
  const b = luminance(hexB);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
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
  const root = cssBlock(css, /:root\s*\{/);
  const light = cssBlock(css, /body\[data-theme="light"\]\s*\{/);

  assert(tokenValue(root, "--bg") === "#030504", "dark --bg is baseline #030504");
  assert(tokenValue(root, "--bg-deep") === "#050805", "dark --bg-deep is baseline #050805");
  assert(tokenValue(root, "--green") === "#8ff11d", "dark --green is baseline #8ff11d");
  assert(tokenValue(root, "--green-strong") === "#67d414", "dark --green-strong is baseline #67d414");
  assert(tokenValue(root, "--radius-xl") === "34px", "radius-xl is baseline 34px");
  assert(tokenValue(root, "--radius-lg") === "26px", "radius-lg is baseline 26px");
  assert(tokenValue(root, "--radius-md") === "18px", "radius-md is baseline 18px");
  assert(tokenValue(root, "--radius-sm") === "14px", "radius-sm is baseline 14px");
  assert(tokenValue(root, "--tabbar-height") === "94px", "tabbar height is baseline 94px");
  assert(tokenValue(root, "--tabbar-offset") === "24px", "tabbar offset is baseline 24px");
  assert(Boolean(tokenValue(root, "--tabbar-glass")), "tabbar glass token exists");
  assert(Boolean(tokenValue(root, "--tabbar-line")), "tabbar line token exists");
  assert(Boolean(tokenValue(root, "--tabbar-glow")), "tabbar glow token exists");
  assert(!/--fitgen-theme:\s*#0f766e/.test(css), "chrome tokens are not PWA teal #0f766e");

  assert(/Manrope/.test(css), "styles.css documents deferred baseline UI font Manrope");
  assert(/Space Grotesk/.test(css), "styles.css documents deferred baseline display font Space Grotesk");
  assert(tokenValue(root, "--font-ui").includes("IBM Plex Sans"), "loaded UI font remains IBM Plex Sans this PR");
  assert(tokenValue(root, "--font-display").includes("Sora"), "loaded display font remains Sora this PR");

  const html = readText(path.join(ROOT, "index.html"));
  assert(!/Manrope|Space\+Grotesk|Space Grotesk/.test(html), "index.html does not add a new remote font request");
  assert(/IBM\+Plex\+Sans/.test(html) && /family=Sora/.test(html), "index.html keeps existing IBM Plex/Sora load");
  assert(/theme-color" content="#030504"/.test(html), "theme-color matches baseline --bg");

  const darkBg = tokenValue(root, "--bg");
  const lightBg = tokenValue(light, "--bg");
  const green = tokenValue(root, "--green");
  const greenOnLight = tokenValue(root, "--green-on-light") || tokenValue(light, "--green-on-light");
  const greenDark = contrastRatio(green, darkBg);
  const greenLight = contrastRatio(green, lightBg);
  const onLight = contrastRatio(greenOnLight, lightBg);

  assert(greenDark >= 4.5, `neon green vs dark --bg contrast ${greenDark.toFixed(2)} >= 4.5`);
  assert(greenLight < 4.5, `neon green vs light --bg contrast ${greenLight.toFixed(2)} < 4.5 (do not use as light text)`);
  assert(onLight >= 4.5, `light-chrome green ${greenOnLight} vs light --bg contrast ${onLight.toFixed(2)} >= 4.5`);

  const lightChrome = [
    cssBlock(css, /body\[data-theme="light"\] \.tab-button\.is-active\s*\{/),
    cssBlock(css, /body\[data-theme="light"\] \.eyebrow\s*\{/),
    cssBlock(css, /body\[data-theme="light"\] \.tabbar\s*\{/),
    cssBlock(css, /body\[data-theme="light"\] \.app-header\s*\{/),
  ].join("\n");
  assert(!/#8ff11d/.test(lightChrome), "light chrome rules do not use neon #8ff11d");
  assert(/--green-on-light/.test(css), "light chrome uses --green-on-light exception token");

  const tabbar = cssBlock(css, /^\.tabbar\s*\{/m);
  assert(/var\(--tabbar-height\)/.test(tabbar) || /min-height:\s*var\(--tabbar-height\)/.test(css), "tabbar uses height token");
  assert(/var\(--tabbar-glass\)/.test(css), "tabbar uses glass token");
  assert(/var\(--tabbar-line\)/.test(css), "tabbar uses neon line token");
  assert(/var\(--tabbar-glow\)/.test(css), "tabbar uses glow token");
  assert(/var\(--tabbar-offset\)/.test(css), "mobile tabbar uses 24px offset token");

  assert(!/buildOptions|buildWaterOptions/.test(css), "styles.css does not contain calculator builders");
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
  assert(manifest.background_color === "#030504", "manifest background_color matches baseline --bg");
  assert(manifest.theme_color === "#030504", "manifest theme_color matches baseline --bg");

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
