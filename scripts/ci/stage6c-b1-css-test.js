#!/usr/bin/env node
"use strict";

/**
 * Stage 6c-B1 — RF-B-003 CSS injector absorb (Issue #34).
 *
 * Binding: Codex [NEXT_STAGE_AUTHORIZED] comment 5645707739.
 * Move surviving injectFallbackStyles declarations into styles.css, then
 * remove only that runtime stylesheet injector. Fail closed if:
 *   - runtime-fixes-style is still dynamically injected
 *   - required selectors/declarations disappear
 *   - runtime-fixes.js gains a replacement stylesheet injector
 *
 * Does not execute calculator math, reminder architecture, or RF-C-* paths.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { parsePathAllowlist } = require("./allowlist-freeze");
const { readText, repoRoot } = require("./lib");
const { assertPngHasVisibleContent } = require("./png-evidence");

const ROOT = repoRoot();
const FROZEN_GOLDENS = "659c1865da95c3197395c931e154c4267c802d8aaf7842aee83345962d013acd";
const FROZEN_APP = "489cd7b88b90e00bd2a700518312577cf5a65cf12cacc003d9a181422606a537";
const REMAINING_LOADED = ["runtime-fixes.js"];
const EVIDENCE_DIR = path.join(ROOT, "docs/evidence/stage-6c-b1-css");

const REQUIRED_SHOTS = [
  "after-desktop-cabinet-dark.png",
  "after-mobile-cabinet-dark.png",
  "after-desktop-cabinet-light.png",
  "after-mobile-cabinet-light.png",
  "after-desktop-schedule-dark.png",
  "after-mobile-schedule-dark.png",
  "after-desktop-schedule-light.png",
  "after-mobile-schedule-light.png",
  "after-desktop-notif-dark.png",
  "after-mobile-notif-dark.png",
  "after-live-desktop-cabinet-dark.png",
  "after-live-mobile-cabinet-dark.png",
];

const REQUIRED_RULES = [
  {
    selector: ".water-amount-emphasis",
    declarations: {
      color: "var(--teal)",
      "font-family": '"Sora", sans-serif',
      "font-size": "1.2rem",
      "font-weight": "700",
    },
  },
  {
    selector: ".cabinet-actions-fallback, .today-schedule-actions, .notification-actions",
    declarations: {
      display: "flex",
      "flex-wrap": "wrap",
      gap: "10px",
      "margin-top": "14px",
    },
  },
  {
    selector: ".vial-row-fallback",
    declarations: {
      display: "grid",
      "grid-template-columns": "92px minmax(0, 1fr)",
      gap: "14px",
      "align-items": "center",
      margin: "14px 0",
    },
  },
  {
    selector: ".vial-visual-fallback",
    declarations: {
      display: "grid",
      "justify-items": "center",
      gap: "8px",
    },
  },
  {
    selector: ".vial-shell-fallback",
    declarations: {
      position: "relative",
      width: "66px",
      height: "142px",
      "border-radius": "22px 22px 16px 16px",
      border: "1px solid rgba(255,255,255,0.14)",
      background: "linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03))",
      overflow: "hidden",
    },
  },
  {
    selector: 'body[data-theme="light"] .vial-shell-fallback',
    declarations: {
      "border-color": "rgba(16,39,37,0.14)",
      background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(232,240,236,0.9))",
    },
  },
  {
    selector: ".vial-shell-fallback::before",
    declarations: {
      content: '""',
      position: "absolute",
      inset: "8px",
      "border-radius": "14px",
      background: "rgba(255,255,255,0.05)",
    },
  },
  {
    selector: ".vial-liquid-fallback",
    declarations: {
      position: "absolute",
      left: "8px",
      right: "8px",
      bottom: "8px",
      "border-radius": "0 0 14px 14px",
      background: "linear-gradient(180deg, rgba(63,214,197,0.96), rgba(63,214,197,0.28))",
      "box-shadow": "inset 0 1px 0 rgba(255,255,255,0.4)",
    },
  },
  {
    selector: ".vial-threshold-fallback",
    declarations: {
      position: "absolute",
      left: "6px",
      right: "6px",
      height: "2px",
      "border-radius": "999px",
      background: "rgba(255,130,115,0.95)",
      "box-shadow": "0 0 0 4px rgba(255,130,115,0.12)",
    },
  },
  {
    selector: ".vial-remaining-label",
    declarations: {
      color: "var(--muted)",
      "font-size": "0.82rem",
    },
  },
  {
    selector: ".vial-copy-fallback",
    declarations: {
      display: "grid",
      gap: "6px",
    },
  },
  {
    selector: ".vial-copy-fallback strong",
    declarations: {
      "font-family": '"Sora", sans-serif',
    },
  },
  {
    selector: ".tab-button.has-alert",
    declarations: {
      color: "#ff8a80",
      "font-weight": "700",
    },
  },
  {
    selector: ".tab-button.has-alert.is-active",
    declarations: {
      color: "#ffd3cf",
    },
  },
  {
    selector: ".today-schedule-banner",
    declarations: {
      margin: "0 0 16px",
      padding: "16px",
      "border-radius": "18px",
      background: "rgba(255,130,115,0.14)",
      border: "1px solid rgba(255,130,115,0.2)",
    },
  },
  {
    selector: ".today-schedule-banner h3",
    declarations: {
      margin: "0 0 8px",
      "font-family": '"Sora", sans-serif',
      color: "#ffb8b1",
    },
  },
  {
    selector: ".today-schedule-banner p",
    declarations: {
      margin: "0",
      color: "var(--muted)",
    },
  },
  {
    selector: ".today-schedule-card",
    declarations: {
      "margin-top": "12px",
      padding: "14px",
      "border-radius": "16px",
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.08)",
    },
  },
  {
    selector: 'body[data-theme="light"] .today-schedule-card',
    declarations: {
      background: "rgba(255,255,255,0.88)",
      "border-color": "rgba(16,39,37,0.08)",
    },
  },
  {
    selector: ".today-schedule-card h4",
    declarations: {
      margin: "0 0 6px",
      "font-family": '"Sora", sans-serif',
    },
  },
  {
    selector: ".today-schedule-card p",
    declarations: {
      margin: "0",
    },
  },
  {
    selector: ".schedule-status-pill",
    declarations: {
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      "min-height": "32px",
      padding: "0 12px",
      "border-radius": "999px",
      background: "rgba(255,255,255,0.08)",
      color: "var(--muted)",
      "font-size": "0.84rem",
      "font-weight": "700",
    },
  },
  {
    selector: ".schedule-status-pill.is-ready",
    declarations: {
      background: "rgba(63,214,197,0.14)",
      color: "var(--mint)",
    },
  },
  {
    selector: ".schedule-status-pill.is-complete",
    declarations: {
      background: "rgba(255,255,255,0.08)",
      color: "var(--muted)",
    },
  },
  {
    selector: ".vial-row-fallback",
    media: "@media (max-width: 720px)",
    declarations: {
      "grid-template-columns": "1fr",
    },
  },
];

const STYLESHEET_INJECTOR_RES = [
  /\binjectFallbackStyles\s*\(/,
  /function\s+injectFallbackStyles\b/,
  /["']runtime-fixes-style["']/,
  /id\s*=\s*["']runtime-fixes-style["']/,
  /createElement\s*\(\s*["']style["']\s*\)/,
  /createElementNS\s*\([^)]*["']style["']/,
  /new\s+CSSStyleSheet\s*\(/,
  /\badoptedStyleSheets\b/,
  /\.insertRule\s*\(/,
  /insertAdjacentHTML\s*\(\s*[^)]*<style/i,
  /\.innerHTML\s*=\s*[^;]*<style/i,
];

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

function assertEqual(actual, expected, message) {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  assert(left === right, `${message} (actual=${left} expected=${right})`);
}

function sha256File(rel) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, rel))).digest("hex");
}

function extractScriptSrcs(html) {
  const srcs = [];
  const re = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
  let match = re.exec(html);
  while (match) {
    srcs.push(match[1].replace(/^\.\//, "").replace(/^\//, ""));
    match = re.exec(html);
  }
  return srcs;
}

function parseFixAllowlist() {
  return parsePathAllowlist(readText(path.join(ROOT, "scripts/ci/allowlists/runtime-fix-js.txt")));
}

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function parseDeclarations(body) {
  const decls = {};
  for (const part of body.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const colon = trimmed.indexOf(":");
    if (colon === -1) {
      continue;
    }
    const prop = trimmed.slice(0, colon).trim().toLowerCase();
    const value = trimmed.slice(colon + 1).trim();
    decls[prop] = value;
  }
  return decls;
}

function normalizeMedia(media) {
  if (!media) {
    return null;
  }
  return media.replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").trim();
}

function parseCssRules(css, media = null) {
  const text = stripCssComments(css);
  const rules = [];
  let index = 0;
  while (index < text.length) {
    const nextBrace = text.indexOf("{", index);
    if (nextBrace === -1) {
      break;
    }
    const prelude = text.slice(index, nextBrace).trim();
    let depth = 1;
    let cursor = nextBrace + 1;
    while (cursor < text.length && depth > 0) {
      if (text[cursor] === "{") {
        depth += 1;
      } else if (text[cursor] === "}") {
        depth -= 1;
      }
      cursor += 1;
    }
    const body = text.slice(nextBrace + 1, cursor - 1);
    if (!prelude) {
      index = cursor;
      continue;
    }
    if (/^@media\b/i.test(prelude)) {
      rules.push(...parseCssRules(body, normalizeMedia(prelude)));
    } else if (!prelude.startsWith("@")) {
      rules.push({
        selector: prelude.replace(/\s+/g, " "),
        declarations: parseDeclarations(body),
        media: normalizeMedia(media),
      });
    }
    index = cursor;
  }
  return rules;
}

function lastMatchingRule(rules, selector, media) {
  const wantedMedia = normalizeMedia(media);
  let found = null;
  for (const rule of rules) {
    if (rule.selector === selector && rule.media === wantedMedia) {
      found = rule;
    }
  }
  return found;
}

function main() {
  console.log("Stage 6c-B1 RF-B-003 CSS injector absorbed into styles.css\n");

  const html = readText(path.join(ROOT, "index.html"));
  const css = readText(path.join(ROOT, "styles.css"));
  const runtimeSrc = readText(path.join(ROOT, "runtime-fixes.js"));
  const bindSrc = readText(path.join(ROOT, "p0-ux-bind.js"));
  const loadedSrcs = extractScriptSrcs(html);
  const allowed = parseFixAllowlist();

  assert(loadedSrcs.includes("runtime-fixes.js"), "runtime-fixes.js remains loaded by index.html");
  assert(fs.existsSync(path.join(ROOT, "runtime-fixes.js")), "runtime-fixes.js remains on disk");
  assert(allowed.has("runtime-fixes.js"), "runtime-fix-js allowlist still lists runtime-fixes.js");
  assertEqual([...allowed].sort(), REMAINING_LOADED.slice().sort(), "runtime-fix-js allowlist is unchanged");
  assert(!html.includes("runtime-fixes-style"), "index.html does not host runtime-fixes-style");
  assert(!/#runtime-fixes-style/.test(css) && !/runtime-fixes-style/.test(css), "styles.css does not keep the runtime style id");

  for (const pattern of STYLESHEET_INJECTOR_RES) {
    assert(!pattern.test(runtimeSrc), `runtime-fixes.js has no replacement injector matching ${pattern}`);
  }
  assert(!/document\.head\.appendChild\s*\(\s*style\s*\)/.test(runtimeSrc), "runtime-fixes.js does not append a style node");
  assert(
    /function\s+hideLegacyScheduleEditor\s*\(/.test(runtimeSrc) && /hideLegacyScheduleEditor\s*\(\s*\)/.test(runtimeSrc),
    "RF-B-004 hideLegacyScheduleEditor remains (out of scope for 6c-B1)"
  );
  assert(
    runtimeSrc.includes("cabinet-actions-fallback") &&
      runtimeSrc.includes("vial-row-fallback") &&
      runtimeSrc.includes("water-amount-emphasis"),
    "runtime-fixes.js still emits the cabinet fallback class names (markup not rewritten)"
  );
  assert(
    !/class=["']today-schedule-banner["']/.test(runtimeSrc),
    "6c-B6 RF-B-012: runtime-fixes.js no longer writes the Due Today banner class (CSS rule remains)"
  );
  assert(
    !bindSrc.includes("injectFallbackStyles") && !bindSrc.includes("runtime-fixes-style"),
    "p0-ux-bind.js did not gain the retired style injector"
  );

  const rules = parseCssRules(css);
  for (const required of REQUIRED_RULES) {
    const match = lastMatchingRule(rules, required.selector, required.media);
    const label = required.media ? `${required.media} ${required.selector}` : required.selector;
    assert(Boolean(match), `styles.css keeps selector ${label}`);
    if (!match) {
      continue;
    }
    for (const [prop, value] of Object.entries(required.declarations)) {
      assert(
        match.declarations[prop] === value,
        `${label} keeps ${prop}: ${value} (actual=${match.declarations[prop] || "<missing>"})`
      );
    }
  }

  assert(
    runtimeSrc.includes("function editFillRecord") && /window\.prompt\(/.test(runtimeSrc),
    "runtime-fixes.js prompt editFillRecord is untouched (later 6c)"
  );
  assert(runtimeSrc.includes("syncRemindersToBackend"), "RF-C-003 syncRemindersToBackend is untouched");
  assert(runtimeSrc.includes("computeOptions"), "RF-C-007 computeOptions is untouched");
  assert(runtimeSrc.includes("queueUpcomingBrowserReminder"), "RF-C-009 reminder timer is untouched");
  assert(!/\bmark-missed\b/.test(runtimeSrc), "runtime-fixes.js gained no Mark missed action");

  assert(sha256File("app.js") === FROZEN_APP, "app.js SHA-256 unchanged (no formula-builder edits)");
  assert(
    sha256File("scripts/calc/fixtures/legacy-evidence-goldens.json") === FROZEN_GOLDENS,
    "calc goldens SHA-256 unchanged"
  );

  assert(fs.existsSync(path.join(EVIDENCE_DIR, "STAGE6CB1.md")), "STAGE6CB1 evidence manifest exists");
  assert(fs.existsSync(path.join(EVIDENCE_DIR, "parity-surfaces.html")), "CSS parity fixture exists");
  const fixture = readText(path.join(EVIDENCE_DIR, "parity-surfaces.html"));
  assert(/href=["'](?:\.\.\/){3}styles\.css["']/.test(fixture), "parity fixture loads repo styles.css");
  assert(!/runtime-fixes\.js/.test(fixture), "parity fixture does not load runtime-fixes.js");
  assert(/Demo Vial A/.test(fixture) && !/filipe/i.test(fixture), "parity fixture uses synthetic Demo Vial A only");

  const shotStats = {};
  for (const name of REQUIRED_SHOTS) {
    const abs = path.join(EVIDENCE_DIR, name);
    assert(fs.existsSync(abs) && fs.statSync(abs).size > 1000, `evidence shot ${name} exists`);
    try {
      shotStats[name] = assertPngHasVisibleContent(abs);
      assert(
        true,
        `evidence shot ${name} has visible non-uniform pixels (${shotStats[name].width}x${shotStats[name].height})`
      );
    } catch (error) {
      assert(false, error.message);
    }
  }

  const lightCabinet = shotStats["after-desktop-cabinet-light.png"];
  const darkCabinet = shotStats["after-desktop-cabinet-dark.png"];
  if (lightCabinet && darkCabinet) {
    assert(lightCabinet.brightShare > darkCabinet.brightShare, "light cabinet shot is brighter than dark cabinet shot");
  }
  const lightSchedule = shotStats["after-desktop-schedule-light.png"];
  const darkSchedule = shotStats["after-desktop-schedule-dark.png"];
  if (lightSchedule && darkSchedule) {
    assert(
      lightSchedule.brightShare > darkSchedule.brightShare,
      "light schedule shot is brighter than dark schedule shot"
    );
  }
  const liveCabinet = shotStats["after-live-desktop-cabinet-dark.png"];
  const fixtureCabinet = shotStats["after-desktop-cabinet-dark.png"];
  if (liveCabinet && fixtureCabinet) {
    assert(
      !fs.readFileSync(path.join(EVIDENCE_DIR, "after-live-desktop-cabinet-dark.png")).equals(
        fs.readFileSync(path.join(EVIDENCE_DIR, "after-desktop-cabinet-dark.png"))
      ),
      "live cabinet shot is distinct from the CSS fixture cabinet shot"
    );
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    process.exit(1);
  }
}

main();
