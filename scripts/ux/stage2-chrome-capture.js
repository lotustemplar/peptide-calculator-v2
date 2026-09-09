#!/usr/bin/env node
"use strict";

/**
 * Stage 2 helper (not part of npm test / npm run ci).
 * Rasterize the in-repo FitGen SVG to PNG icons and/or capture chrome screenshots.
 *
 *   node scripts/ux/stage2-chrome-capture.js --icons
 *   node scripts/ux/stage2-chrome-capture.js --shots before
 *   node scripts/ux/stage2-chrome-capture.js --shots after
 */

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { repoRoot } = require("../ci/lib");

const PORT = Number(process.env.FITGEN_STAGE2_PORT || 4175);
const CDP_PORT = Number(process.env.FITGEN_STAGE2_CDP_PORT || 9225);
const CHROME = process.env.CHROME_PATH || "/usr/local/bin/google-chrome";
const ROOT = repoRoot();

function httpJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve);
      this.ws.addEventListener("error", reject);
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          reject(new Error(message.error.message || "CDP error"));
        } else {
          resolve(message.result);
        }
      }
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = (this.id += 1);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || "evaluate failed");
    }
    return result.result.value;
  }

  async screenshot(filePath, clip) {
    const params = { format: "png", fromSurface: true };
    if (clip) {
      params.clip = clip;
      params.captureBeyondViewport = true;
    }
    const { data } = await this.send("Page.captureScreenshot", params);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, Buffer.from(data, "base64"));
    return filePath;
  }

  close() {
    this.ws.close();
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function iconTileHtml(size) {
  return `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#030504">
  <div id="tile" style="width:${size}px;height:${size}px;display:grid;place-items:center;background:#030504">
    <img src="/icon.svg" width="${Math.round(size * 0.86)}" height="${Math.round(size * 0.86)}" alt="">
  </div>
</body></html>`;
}

function startStaticServer() {
  const server = http.createServer((req, res) => {
    const raw = req.url || "/";
    const urlPath = decodeURIComponent(raw.split("?")[0]);
    if (urlPath === "/__icon-tile") {
      const size = Number(new URL(raw, "http://127.0.0.1").searchParams.get("size") || "192");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(iconTileHtml(size));
      return;
    }
    const rel = urlPath === "/" ? "/index.html" : urlPath;
    const abs = path.normalize(path.join(ROOT, rel));
    if (!abs.startsWith(ROOT)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(abs, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      const ext = path.extname(abs).toLowerCase();
      const types = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".webmanifest": "application/manifest+json",
        ".json": "application/json",
      };
      res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

async function launchChrome() {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "fitgen-stage2-"));
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      `--user-data-dir=${userData}`,
      `--remote-debugging-port=${CDP_PORT}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let version;
  for (let i = 0; i < 40; i += 1) {
    try {
      version = await httpJson(`http://127.0.0.1:${CDP_PORT}/json/version`);
      break;
    } catch {
      await wait(150);
    }
  }
  if (!version) {
    chrome.kill();
    throw new Error("Chrome DevTools did not start");
  }

  const targets = await httpJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const page = targets.find((item) => item.type === "page") || targets[0];
  const cdp = new Cdp(page.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  return { chrome, cdp, userData };
}

async function rasterizeIcons(cdp) {
  const specs = [
    { file: "icon.png", size: 192 },
    { file: "icon-192.png", size: 192 },
    { file: "icon-512.png", size: 512 },
  ];

  for (const spec of specs) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: spec.size,
      height: spec.size,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send("Page.navigate", {
      url: `http://127.0.0.1:${PORT}/__icon-tile?size=${spec.size}`,
    });
    await wait(700);
    await cdp.evaluate(`(() => {
      const img = document.querySelector("img");
      return img && img.complete ? true : new Promise((resolve) => {
        img.addEventListener("load", () => resolve(true), { once: true });
      });
    })()`);
    const box = await cdp.evaluate(`(() => {
      const el = document.getElementById("tile");
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, scale: 1 };
    })()`);
    const out = path.join(ROOT, spec.file);
    await cdp.screenshot(out, box);
    console.log(`wrote ${spec.file} (${spec.size}x${spec.size})`);
  }
}

async function captureShots(cdp, label) {
  const outDir = path.join(ROOT, "docs/evidence/stage-2-chrome");
  fs.mkdirSync(outDir, { recursive: true });

  await cdp.send("Network.setExtraHTTPHeaders", {
    headers: { "Cache-Control": "no-cache" },
  });

  const views = [
    { name: `${label}-mobile`, width: 390, height: 844, dsf: 2, mobile: true },
    { name: `${label}-desktop`, width: 1280, height: 800, dsf: 1, mobile: false },
  ];

  for (const view of views) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: view.width,
      height: view.height,
      deviceScaleFactor: view.dsf,
      mobile: view.mobile,
    });
    await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` });
    await wait(900);
    await cdp.evaluate(`localStorage.clear()`);
    await cdp.send("Page.reload", { ignoreCache: true });
    await wait(1100);
    const boxes = await cdp.evaluate(`(() => {
      function box(el, pad) {
        const r = el.getBoundingClientRect();
        return {
          x: Math.max(0, r.left - pad),
          y: Math.max(0, r.top - pad),
          width: r.width + pad * 2,
          height: r.height + pad * 2,
          scale: 1
        };
      }
      return {
        header: box(document.querySelector(".app-header"), 8),
        tabbar: box(document.querySelector(".tabbar"), 8)
      };
    })()`);
    await cdp.screenshot(path.join(outDir, `${view.name}-header.png`), boxes.header);
    await cdp.screenshot(path.join(outDir, `${view.name}-tabbar.png`), boxes.tabbar);
    console.log(`wrote ${view.name}-header.png and ${view.name}-tabbar.png`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const doIcons = args.includes("--icons");
  const shotIdx = args.indexOf("--shots");
  const shotLabel = shotIdx >= 0 ? args[shotIdx + 1] : null;
  if (!doIcons && !shotLabel) {
    throw new Error("usage: --icons and/or --shots before|after");
  }

  const server = await startStaticServer();
  const { chrome, cdp } = await launchChrome();
  try {
    if (doIcons) {
      await rasterizeIcons(cdp);
    }
    if (shotLabel) {
      await captureShots(cdp, shotLabel);
    }
  } finally {
    cdp.close();
    chrome.kill();
    server.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
