#!/usr/bin/env node
"use strict";

/**
 * Stage 6b.3 — absorb ui-polish-fix.js accordion + duplicate banner (Issue #34).
 *
 * Atlas Spec 5641278084: absorb cabinet accordion and the Due Today banner
 * dedupe. Do NOT port reminder/sync stubs, meds/notif/theme hides, or a
 * PEPTIDE_LIST dropdown. Tests fail if the overlay is removed without parity
 * or if forbidden ports land in src/ / bind.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { parsePathAllowlist } = require("./allowlist-freeze");
const { readText, repoRoot, walkFiles } = require("./lib");
const { compileUxModules } = require("../ux/harness");
const { BUNDLE_REL, emitBrowserBundle } = require("../ux/emit-browser");
const { assertPngHasVisibleContent } = require("./png-evidence");

const ROOT = repoRoot();
const RETIRED = "ui-polish-fix.js";
const REMAINING_LOADED = ["runtime-fixes.js"];
const FROZEN_GOLDENS = "659c1865da95c3197395c931e154c4267c802d8aaf7842aee83345962d013acd";
const FROZEN_APP = "489cd7b88b90e00bd2a700518312577cf5a65cf12cacc003d9a181422606a537";
const FILLS_KEY = "peptide-calculator-v2-fills";
const SCHEDULES_KEY = "peptide-calculator-v2-schedules";
const EXPANDED_FILL_KEY = "peptide-calculator-v2-expanded-fill";
const BASELINE_KEY = "fitgen-peptide-rebuild-v1";
const FORBIDDEN_STUB_RE =
  /disableReminderFunctions|installNotificationNoops|maybeRegisterNativePushIdentity|queueNextReminder|renderNotificationState|updateNotifSetupCard|sendTestPush/;

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

function mentionsBasename(text, basename) {
  const escaped = basename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\w./-])${escaped}(?:$|[^\\w-])`).test(text);
}

function parseFixAllowlist() {
  return parsePathAllowlist(readText(path.join(ROOT, "scripts/ci/allowlists/runtime-fix-js.txt")));
}

function createClassList(initial) {
  const values = new Set(String(initial || "").split(/\s+/).filter(Boolean));
  return {
    add(name) {
      values.add(name);
    },
    remove(name) {
      values.delete(name);
    },
    contains(name) {
      return values.has(name);
    },
    toString() {
      return [...values].join(" ");
    },
  };
}

function createNode(tagName, className) {
  const children = [];
  const listeners = new Map();
  const node = {
    tagName: String(tagName || "div").toUpperCase(),
    className: className || "",
    classList: createClassList(className),
    children,
    parentElement: null,
    textContent: "",
    style: { display: "" },
    querySelector(selector) {
      if (selector.startsWith(".")) {
        const cls = selector.slice(1);
        if (node.classList.contains(cls)) {
          return node;
        }
        for (const child of children) {
          const found = child.querySelector(selector);
          if (found) {
            return found;
          }
        }
        return null;
      }
      return null;
    },
    querySelectorAll(selector) {
      const out = [];
      const visit = (current) => {
        if (selector.startsWith(".") && current.classList.contains(selector.slice(1))) {
          out.push(current);
        }
        if (selector === '[data-action="mark-taken"]' && current.dataset && current.dataset.action === "mark-taken") {
          out.push(current);
        }
        for (const child of current.children) {
          visit(child);
        }
      };
      for (const child of children) {
        visit(child);
      }
      return out;
    },
    closest(selector) {
      const classes = String(selector)
        .split(",")
        .map((part) => part.trim().replace(/^\./, ""));
      let current = node;
      while (current) {
        if (classes.some((cls) => current.classList && current.classList.contains(cls))) {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    },
    appendChild(child) {
      child.parentElement = node;
      children.push(child);
      return child;
    },
    remove() {
      if (!node.parentElement) {
        return;
      }
      const siblings = node.parentElement.children;
      const index = siblings.indexOf(node);
      if (index >= 0) {
        siblings.splice(index, 1);
      }
      node.parentElement = null;
    },
    addEventListener(type, fn) {
      listeners.set(type, fn);
    },
    click() {
      const fn = listeners.get("click");
      if (fn) {
        fn();
      }
    },
    dataset: {},
  };
  return node;
}

function cabinetCard(expanded) {
  const card = createNode("article", "cabinet-card");
  const header = createNode("div", "fill-header");
  const toggle = createNode("button", "fill-toggle");
  const caret = createNode("span", "caret");
  caret.textContent = expanded ? "▾" : "▸";
  toggle.appendChild(caret);
  header.appendChild(toggle);
  const usage = createNode("div", "usage-grid");
  usage.textContent = "usage";
  const vial = createNode("div", "vial-row");
  vial.textContent = "vial";
  const list = createNode("div", `peptide-fill-list${expanded ? "" : " is-collapsed"}`);
  list.textContent = "actions";
  card.appendChild(header);
  card.appendChild(usage);
  card.appendChild(vial);
  card.appendChild(list);
  return { card, toggle, caret, header, usage, vial, list };
}

function main() {
  console.log("Stage 6b.3 ui-polish-fix.js absorbed accordion + banner; no reminder stubs");

  const html = readText(path.join(ROOT, "index.html"));
  const css = readText(path.join(ROOT, "styles.css"));
  const bindSrc = readText(path.join(ROOT, "p0-ux-bind.js"));
  const polishSrc = readText(path.join(ROOT, "src/ux/ui-polish.ts"));
  const runtimeSrc = readText(path.join(ROOT, "runtime-fixes.js"));
  const loadedSrcs = extractScriptSrcs(html);
  const allowed = parseFixAllowlist();

  assert(!loadedSrcs.includes(RETIRED), "index.html no longer loads ui-polish-fix.js");
  assert(!mentionsBasename(html, RETIRED), "index.html does not mention ui-polish-fix.js");
  assert(!fs.existsSync(path.join(ROOT, RETIRED)), "ui-polish-fix.js is deleted from the repository root");
  const reintroduced = walkFiles(ROOT)
    .map((abs) => path.relative(ROOT, abs).split(path.sep).join("/"))
    .filter((rel) => path.posix.basename(rel) === RETIRED);
  assert(reintroduced.length === 0, "ui-polish-fix.js is not reintroduced anywhere in the tree");
  assert(!allowed.has(RETIRED), "runtime-fix-js allowlist dropped ui-polish-fix.js only");

  for (const patch of REMAINING_LOADED) {
    assert(loadedSrcs.includes(patch), `${patch} remains loaded by index.html`);
    assert(fs.existsSync(path.join(ROOT, patch)), `${patch} remains on disk`);
    assert(allowed.has(patch), `runtime-fix-js allowlist still lists ${patch}`);
  }
  assertEqual(
    [...allowed].sort(),
    REMAINING_LOADED.slice().sort(),
    "runtime-fix-js allowlist is exactly the remaining loaded patch"
  );

  assert(html.includes('id="medications-card"'), "medications-card remains in cabinet markup");
  assert(html.includes('id="med-name-autocomplete"') && html.includes('id="save-fill-name-autocomplete"'), "Stage 5 autocomplete hosts remain sole name UX");
  assert(html.includes('id="backup-card"') && html.includes('id="cabinet-card"'), "authored backup + cabinet cards remain");
  assert(
    html.indexOf('id="backup-card"') < html.indexOf('id="medications-card"') &&
      html.indexOf('id="medications-card"') < html.indexOf('id="cabinet-card"'),
    "index.html keeps authored cabinet order: backup, meds, cabinet"
  );
  assert(html.includes('id="theme-toggle"') && /id="theme-toggle"[^>]*\bhidden\b/.test(html), "theme-toggle stays hidden in markup, not re-hidden as polish");
  assert(html.includes('id="notif-setup-card"') && html.includes('id="enable-notifications"'), "notification chrome remains in markup (hide not ported)");
  assert(html.includes('id="selected-fill"'), "selected-fill remains (hide not ported)");
  assert(!/>\s*Settings\s*</.test(html), "no Settings button exists to hide");

  assert(
    /#current-peptides \.cabinet-card:has\(\.peptide-fill-list\.is-collapsed\)/.test(css),
    "styles.css hides extra cabinet sections when peptide-fill-list is collapsed"
  );
  assert(
    /#current-peptides \.cabinet-card\.is-collapsed/.test(css),
    "styles.css hides extra cabinet sections when the card has is-collapsed"
  );
  assert(!/#medications-card[^{]*\{[^}]*display:\s*none/.test(css), "CSS does not hide medications-card");
  assert(!/#notif-setup-card[^{]*\{[^}]*display:\s*none\s*!important/.test(css), "CSS does not re-hide notification chrome as polish");
  assert(!/#theme-toggle[^{]*\{[^}]*display:\s*none\s*!important/.test(css), "CSS does not re-hide theme-toggle as polish");
  assert(!/#selected-fill[^{]*\{[^}]*display:\s*none\s*!important/.test(css), "CSS does not re-hide selected-fill as polish");
  assert(!/#cabinet-view\.is-active #medications-card/.test(css), "Stage 5 !important unhide removed; overlay hide is gone");

  assert(bindSrc.includes("applyCabinetAccordionLayout"), "p0-ux-bind.js applies cabinet accordion");
  assert(bindSrc.includes("collapseCabinetAtStartup"), "p0-ux-bind.js collapses cabinet at startup");
  assert(bindSrc.includes("removeDuplicateScheduleBanner"), "p0-ux-bind.js removes duplicate Due Today banner");
  assert(bindSrc.includes("MutationObserver"), "bind watches cabinet/schedule mutations");
  assert(bindSrc.includes("revealMedicationsCard"), "Stage 5 revealMedicationsCard remains");
  assert(!/PEPTIDE_LIST/.test(bindSrc), "bind does not surface PEPTIDE_LIST dropdown");
  assert(
    !/PEPTIDE_LIST/.test(polishSrc) && !/attachSuggestionDropdown/.test(polishSrc),
    "ui-polish.ts does not ship a catalog name dropdown"
  );
  assert(!FORBIDDEN_STUB_RE.test(polishSrc), "ui-polish.ts does not stub reminder/sync/notif APIs");
  assert(!FORBIDDEN_STUB_RE.test(bindSrc), "bind does not stub reminder/sync/notif APIs");
  assert(
    !/syncRemindersToBackend\s*=/.test(polishSrc) && !/disabled:\s*true/.test(polishSrc),
    "this slice does not replace syncRemindersToBackend with a disabled stub"
  );
  assert(
    bindSrc.includes("syncRemindersToBackend"),
    "bind still calls the real syncRemindersToBackend from the 6b.2 edit-fill path"
  );
  assert(!/medications-card[\s\S]{0,80}display/.test(polishSrc), "module does not hide medications-card");
  assert(
    !new RegExp(`removeItem\\(\\s*["']${EXPANDED_FILL_KEY}["']`).test(bindSrc) &&
      !new RegExp(`removeItem\\(\\s*["']${EXPANDED_FILL_KEY}["']`).test(polishSrc),
    "absorbed accordion does not raw-removeItem the expanded-fill key"
  );
  assert(
    !new RegExp(`setItem\\(\\s*["']${FILLS_KEY}["']`).test(bindSrc) &&
      !new RegExp(`setItem\\(\\s*["']${SCHEDULES_KEY}["']`).test(bindSrc),
    "bind does not raw-setItem fill/schedule mirror keys"
  );
  assert(!bindSrc.includes(BASELINE_KEY) && !polishSrc.includes(BASELINE_KEY), "this slice does not mention the baseline rebuild key");

  assert(
    runtimeSrc.includes("today-schedule-banner") && /due today/i.test(runtimeSrc) && runtimeSrc.includes('data-action="mark-taken"'),
    "runtime-fixes.js fallback still emits a Due Today banner plus mark-taken rows (banner absorb is still needed)"
  );
  assert(loadedSrcs.includes("runtime-fixes.js"), "6c runtime-fixes.js remains loaded");
  assert(sha256File("app.js") === FROZEN_APP, "app.js SHA-256 unchanged (no formula-builder edits)");
  assert(
    sha256File("scripts/calc/fixtures/legacy-evidence-goldens.json") === FROZEN_GOLDENS,
    "calc goldens SHA-256 unchanged"
  );

  const { ux } = compileUxModules();
  assert(typeof ux.applyCabinetAccordionLayout === "function", "FitGenP0Ux.applyCabinetAccordionLayout exists");
  assert(typeof ux.collapseCabinetAtStartup === "function", "FitGenP0Ux.collapseCabinetAtStartup exists");
  assert(typeof ux.removeDuplicateScheduleBanner === "function", "FitGenP0Ux.removeDuplicateScheduleBanner exists");
  assert(typeof ux.installNotificationNoops !== "function", "FitGenP0Ux does not export reminder stubs");
  assert(typeof ux.hideNotificationUi !== "function", "FitGenP0Ux does not export hideNotificationUi");
  assertEqual(ux.UI_POLISH_EXPANDED_CARET, "▾", "expanded caret token stays overlay-parity");
  assertEqual(ux.EXPANDED_FILL_STORAGE_KEY, EXPANDED_FILL_KEY, "expanded-fill key is named only as a do-not-write lock");
  assert(ux.shouldShowCabinetChild({ isTopRow: true, expanded: false }) === true, "accordion keeps the header row when collapsed");
  assert(ux.shouldShowCabinetChild({ isTopRow: false, expanded: false }) === false, "accordion hides extra rows when collapsed");
  assert(ux.shouldShowCabinetChild({ isTopRow: false, expanded: true }) === true, "accordion shows extra rows when expanded");
  assert(
    ux.shouldRemoveDuplicateDueTodayBanner({ childCount: 2, hasDueTodayCard: true, markTakenCount: 2 }) === true,
    "duplicate banner removes when two mark-taken controls exist"
  );
  assert(
    ux.shouldRemoveDuplicateDueTodayBanner({ childCount: 1, hasDueTodayCard: true, markTakenCount: 1 }) === false,
    "duplicate banner keeps a single Due Today card"
  );

  const container = createNode("div", "stack-list");
  const openCard = cabinetCard(true);
  const shutCard = cabinetCard(false);
  container.appendChild(openCard.card);
  container.appendChild(shutCard.card);
  assertEqual(ux.applyCabinetAccordionLayout(container), 2, "accordion applies to both cabinet cards");
  assertEqual(openCard.header.style.display, "", "expanded card keeps the header visible");
  assertEqual(openCard.usage.style.display, "", "expanded card keeps extra sections visible");
  assertEqual(shutCard.usage.style.display, "none", "collapsed card hides usage-grid");
  assertEqual(shutCard.vial.style.display, "none", "collapsed card hides vial-row");
  assert(shutCard.card.classList.contains("is-collapsed"), "collapsed card gets is-collapsed");
  assert(!openCard.card.classList.contains("is-collapsed"), "expanded card is not is-collapsed");

  let clicks = 0;
  openCard.toggle.click = () => {
    clicks += 1;
    openCard.caret.textContent = "▸";
  };
  const collapseState = { collapsedOnce: false };
  const firstCollapse = ux.collapseCabinetAtStartup(container, collapseState);
  assert(firstCollapse.clicked === true && firstCollapse.collapsedOnce === true, "startup collapse clicks the open toggle once");
  assertEqual(clicks, 1, "startup collapse clicks exactly once");
  assert(collapseState.collapsedOnce === true, "startup collapse marks collapsedOnce before returning");
  const secondCollapse = ux.collapseCabinetAtStartup(container, collapseState);
  assert(secondCollapse.clicked === false && clicks === 1, "startup collapse does not click again");

  const reminderList = createNode("div", "stack-list");
  const banner = createNode("div", "today-schedule-banner");
  banner.textContent = "Due Today — 2 peptide doses due today.";
  const bannerBtn = createNode("button", "primary-button");
  bannerBtn.dataset.action = "mark-taken";
  banner.appendChild(bannerBtn);
  const row = createNode("article", "list-card");
  row.textContent = "Upcoming peptide";
  const rowBtn = createNode("button", "primary-button");
  rowBtn.dataset.action = "mark-taken";
  row.appendChild(rowBtn);
  reminderList.appendChild(banner);
  reminderList.appendChild(row);
  assert(ux.removeDuplicateScheduleBanner(reminderList) === true, "duplicate Due Today banner is removed");
  assertEqual(reminderList.children.length, 1, "reminder-list keeps the schedule row after banner removal");
  assert(reminderList.children[0] === row, "remaining child is the schedule row, not the banner");
  assert(ux.removeDuplicateScheduleBanner(reminderList) === false, "banner helper no-ops once the duplicate is gone");

  emitBrowserBundle();
  const generated = fs.readFileSync(path.join(ROOT, BUNDLE_REL), "utf8");
  assert(generated.includes("applyCabinetAccordionLayout"), "browser bundle includes applyCabinetAccordionLayout");
  assert(generated.includes("removeDuplicateScheduleBanner"), "browser bundle includes removeDuplicateScheduleBanner");
  assert(!generated.includes("installNotificationNoops"), "browser bundle does not include reminder stubs");

  const evidenceDir = path.join(ROOT, "docs/evidence/stage-6b3-ui-polish");
  const requiredShots = [
    "after-desktop-cabinet-collapsed.png",
    "after-mobile-cabinet-collapsed.png",
    "after-desktop-cabinet-expanded.png",
    "after-mobile-cabinet-expanded.png",
    "after-desktop-cabinet-order.png",
    "after-mobile-cabinet-order.png",
    "after-desktop-schedule.png",
    "after-mobile-schedule.png",
    "after-desktop-selected-fill.png",
    "after-mobile-selected-fill.png",
    "after-desktop-notif-setup.png",
    "after-mobile-notif-setup.png",
  ];
  assert(fs.existsSync(path.join(evidenceDir, "STAGE6B3.md")), "STAGE6B3 evidence manifest exists");
  const shotStats = {};
  for (const name of requiredShots) {
    const abs = path.join(evidenceDir, name);
    assert(fs.existsSync(abs) && fs.statSync(abs).size > 1000, `evidence shot ${name} exists`);
    try {
      shotStats[name] = assertPngHasVisibleContent(abs);
      assert(true, `evidence shot ${name} has visible non-uniform pixels (${shotStats[name].width}x${shotStats[name].height})`);
    } catch (error) {
      assert(false, error.message);
    }
  }
  const mobileNotif = shotStats["after-mobile-notif-setup.png"];
  if (mobileNotif) {
    assert(mobileNotif.height <= 1800, "mobile notif-setup is a reviewable viewport, not a beyond-viewport dump");
    assert(mobileNotif.brightShare >= 0.02, "mobile notif-setup contains bright chrome pixels");
  }
  const notifBuf = fs.readFileSync(path.join(evidenceDir, "after-mobile-notif-setup.png"));
  const scheduleBuf = fs.readFileSync(path.join(evidenceDir, "after-mobile-schedule.png"));
  assert(!notifBuf.equals(scheduleBuf), "mobile notif-setup is a distinct crop from the schedule row shot");

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    process.exit(1);
  }
}

main();
