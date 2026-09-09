#!/usr/bin/env node
"use strict";

/**
 * Stage 4 behavioral regression: aria-current must track the visible view.
 *
 * Replays the three Codex paths that are stale on b7723af:
 *   1. bind-time sync, then later initialize()/setActiveView restore
 *   2. capture-phase tab click that stopImmediatePropagation()
 *   3. programmatic class toggle (app.js setActiveView / runtime-fixes fallback)
 *
 * This file fails on b7723af (no installTabAriaSync observer / capture rAF).
 */

const { compileUxModules } = require("./harness");

const { ux } = compileUxModules();

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${message}`);
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)})`);
}

class MiniClassList {
  constructor(el) {
    this.el = el;
  }

  contains(name) {
    return this.el.className.split(/\s+/).filter(Boolean).includes(name);
  }

  add(name) {
    if (!this.contains(name)) {
      this.el.className = `${this.el.className} ${name}`.trim();
      this.el.notifyClass();
    }
  }

  remove(name) {
    if (!this.contains(name)) {
      return;
    }
    this.el.className = this.el.className
      .split(/\s+/)
      .filter((item) => item && item !== name)
      .join(" ");
    this.el.notifyClass();
  }

  toggle(name, force) {
    const shouldHave = force === undefined ? !this.contains(name) : Boolean(force);
    if (shouldHave) {
      this.add(name);
    } else {
      this.remove(name);
    }
  }
}

class MiniEl {
  constructor(tag, attrs) {
    this.tagName = String(tag).toUpperCase();
    this.attrs = { ...attrs };
    this.children = [];
    this.parent = null;
    this.id = attrs.id || "";
    this.className = attrs.class || "";
    this.dataset = {};
    if (attrs["data-view-target"]) {
      this.dataset.viewTarget = attrs["data-view-target"];
    }
    if (attrs["data-view"]) {
      this.dataset.view = attrs["data-view"];
    }
    this.listeners = { capture: [], bubble: [] };
    this.classList = new MiniClassList(this);
    this.observers = new Set();
  }

  getAttribute(name) {
    if (name === "class") {
      return this.className || null;
    }
    return Object.prototype.hasOwnProperty.call(this.attrs, name) ? String(this.attrs[name]) : null;
  }

  setAttribute(name, value) {
    this.attrs[name] = String(value);
    if (name === "class") {
      this.className = String(value);
    }
    if (name === "id") {
      this.id = String(value);
    }
  }

  removeAttribute(name) {
    delete this.attrs[name];
  }

  append(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (node.matches(selector)) {
        return node;
      }
      node = node.parent;
    }
    return null;
  }

  matches(selector) {
    if (selector.startsWith(".")) {
      return selector
        .slice(1)
        .split(".")
        .every((name) => this.classList.contains(name));
    }
    if (selector.startsWith("#")) {
      return this.id === selector.slice(1);
    }
    const attrEq = /^\[([^=\]]+)="([^"]*)"\]$/.exec(selector);
    if (attrEq) {
      return this.getAttribute(attrEq[1]) === attrEq[2];
    }
    const attr = /^\[([^=\]]+)\]$/.exec(selector);
    if (attr) {
      return this.getAttribute(attr[1]) != null;
    }
    return false;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const found = [];
    const walk = (node) => {
      if (node.matches(selector)) {
        found.push(node);
      }
      node.children.forEach(walk);
    };
    this.children.forEach(walk);
    return found;
  }

  addEventListener(type, listener, options) {
    const capture = options === true || (options && options.capture);
    this.listeners[capture ? "capture" : "bubble"].push({ type, listener });
  }

  removeEventListener(type, listener, options) {
    const capture = options === true || (options && options.capture);
    const bucket = this.listeners[capture ? "capture" : "bubble"];
    this.listeners[capture ? "capture" : "bubble"] = bucket.filter(
      (item) => item.type !== type || item.listener !== listener
    );
  }

  dispatchEvent(event) {
    event.target = event.target || this;
    const chain = [];
    let node = this;
    while (node) {
      chain.unshift(node);
      node = node.parent;
    }
    for (const current of chain) {
      if (event.immediateStopped) {
        break;
      }
      for (const item of current.listeners.capture.slice()) {
        if (item.type === event.type) {
          item.listener(event);
        }
      }
    }
    if (!event.immediateStopped) {
      for (const item of this.listeners.bubble.slice()) {
        if (item.type === event.type) {
          item.listener(event);
        }
      }
    }
    return !event.defaultPrevented;
  }

  notifyClass() {
    this.observers.forEach((observer) => observer.notify(this));
  }
}

class TestMutationObserver {
  constructor(callback) {
    this.callback = callback;
    this.targets = new Set();
  }

  observe(target) {
    this.targets.add(target);
    target.observers.add(this);
  }

  disconnect() {
    this.targets.forEach((target) => target.observers.delete(this));
    this.targets.clear();
  }

  notify() {
    this.callback([{ type: "attributes", attributeName: "class" }]);
  }
}

function makeShell() {
  const root = new MiniEl("div", { class: "app-shell" });
  const views = [
    ["calculator-view", true],
    ["schedule-view", false],
    ["calendar-view", false],
    ["cabinet-view", false],
  ];
  views.forEach(([id, active]) => {
    root.append(
      new MiniEl("section", {
        id,
        class: active ? "app-view is-active" : "app-view",
        "data-view": id,
      })
    );
  });
  const add = root.append(
    new MiniEl("button", {
      class: "tab-button is-active",
      "data-view-target": "calculator-view",
    })
  );
  add.setAttribute("aria-current", "page");
  add.append(new MiniEl("span", { class: "tab-label" }));
  root.append(new MiniEl("button", { class: "tab-button", "data-view-target": "schedule-view" }));
  root.append(new MiniEl("button", { class: "tab-button", "data-view-target": "calendar-view" }));
  root.append(new MiniEl("button", { class: "tab-button", "data-view-target": "cabinet-view" }));
  return root;
}

function setViewClasses(root, viewId) {
  root.querySelectorAll(".app-view").forEach((view) => {
    view.classList.toggle("is-active", view.id === viewId);
  });
  root.querySelectorAll("[data-view-target]").forEach((tab) => {
    tab.classList.toggle("is-active", tab.getAttribute("data-view-target") === viewId);
  });
}

function currentAria(root) {
  const current = root.querySelectorAll("[data-view-target]").find((tab) => tab.getAttribute("aria-current") === "page");
  return current ? current.getAttribute("data-view-target") : null;
}

function flushRaf() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

function applyB7723afWiring(root) {
  ux.syncTabAria(root);
  root.addEventListener(
    "click",
    (event) => {
      const tab = event.target && event.target.closest && event.target.closest("[data-view-target]");
      if (tab) {
        setImmediate(() => ux.syncTabAria(root));
      }
    },
    false
  );
}

function captureInterceptedClick(root, viewId) {
  const tab = root.querySelector(`[data-view-target="${viewId}"]`);
  const label = tab.querySelector(".tab-label") || tab;
  tab.addEventListener(
    "click",
    (event) => {
      event.preventDefault = () => {
        event.defaultPrevented = true;
      };
      event.stopImmediatePropagation();
      setViewClasses(root, viewId);
    },
    true
  );
  const event = {
    type: "click",
    target: label,
    defaultPrevented: false,
    immediateStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopImmediatePropagation() {
      this.immediateStopped = true;
    },
  };
  label.dispatchEvent(event);
}

async function main() {
  if (typeof global.MutationObserver !== "function") {
    global.MutationObserver = TestMutationObserver;
  }
  if (typeof global.requestAnimationFrame !== "function") {
    global.requestAnimationFrame = (callback) => setImmediate(() => callback(0));
  }

  assert(typeof ux.installTabAriaSync === "function", "installTabAriaSync is exported (missing on b7723af)");
  assert(typeof ux.syncTabAria === "function", "syncTabAria is exported");

  (function staleOnB7723afRestoreAndCapture() {
    const restoreRoot = makeShell();
    applyB7723afWiring(restoreRoot);
    setViewClasses(restoreRoot, "schedule-view");
    assertEqual(currentAria(restoreRoot), "calculator-view", "b7723af restore leaves aria-current on Add");

    const clickRoot = makeShell();
    applyB7723afWiring(clickRoot);
    captureInterceptedClick(clickRoot, "cabinet-view");
    assertEqual(currentAria(clickRoot), "calculator-view", "b7723af capture click leaves aria-current on Add");

    const programRoot = makeShell();
    applyB7723afWiring(programRoot);
    setViewClasses(programRoot, "calendar-view");
    assertEqual(currentAria(programRoot), "calculator-view", "b7723af programmatic setActiveView leaves aria-current on Add");
  })();

  const restoreRoot = makeShell();
  ux.installTabAriaSync(restoreRoot);
  setViewClasses(restoreRoot, "schedule-view");
  assertEqual(currentAria(restoreRoot), "schedule-view", "restore/initialize keeps aria-current on Schedule");
  assert(restoreRoot.querySelector('[data-view-target="calculator-view"]').getAttribute("aria-current") == null, "restore clears Add aria-current");

  const clickRoot = makeShell();
  ux.installTabAriaSync(clickRoot);
  captureInterceptedClick(clickRoot, "cabinet-view");
  await flushRaf();
  assertEqual(currentAria(clickRoot), "cabinet-view", "capture-intercepted tab click keeps aria-current on Cabinet");

  const programRoot = makeShell();
  ux.installTabAriaSync(programRoot);
  setViewClasses(programRoot, "calendar-view");
  assertEqual(currentAria(programRoot), "calendar-view", "programmatic setActiveView keeps aria-current on Calendar");

  console.log(`Stage 4 tab aria-current: ${passed} passed, ${failed} failed`);
  if (failed) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
