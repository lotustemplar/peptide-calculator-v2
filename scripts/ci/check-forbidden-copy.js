"use strict";

const fs = require("fs");
const path = require("path");
const { allowlistDir, fail, readText, relPosix, repoRoot, walkFiles } = require("./lib");

const SCAN_EXTENSIONS = new Set([
  ".js",
  ".html",
  ".htm",
  ".css",
  ".md",
  ".webmanifest",
  ".json",
]);

const SKIP_REL_PREFIXES = [
  "scripts/ci/",
  "docs/",
];

const SKIP_REL_FILES = new Set([
  "package-lock.json",
  "backend/package-lock.json",
  "package.json",
  "backend/package.json",
]);

const PATTERNS = [
  { id: "SAFE_TO_COMBINE", re: /safe[\s-]*to[\s-]*combine/i },
  { id: "NO_INTERACTIONS_FOUND", re: /no[\s-]+interactions?[\s-]+found/i },
  { id: "ALL_CLEAR", re: /\ball[\s-]+clear\b/i },
  { id: "INJECT_AS_FOLLOWS", re: /inject[\s-]+as[\s-]+follows/i },
  { id: "CLEARING_RESEARCH", re: /clearing[\s-]+research[\s-]+peptides/i },
  { id: "STOP_DOSE", re: /\bstop[\s-]+(?:taking[\s-]+)?(?:your[\s-]+|the[\s-]+)?dose\b/i },
  { id: "START_DOSE", re: /\bstart[\s-]+(?:taking[\s-]+)?(?:your[\s-]+|the[\s-]+)?dose\b/i },
  { id: "INCREASE_DOSE", re: /\bincrease[\s-]+(?:your[\s-]+|the[\s-]+)?dose\b/i },
  { id: "DECREASE_DOSE", re: /\bdecrease[\s-]+(?:your[\s-]+|the[\s-]+)?dose\b/i },
  { id: "RECOMMENDED", re: /\bRecommended\b/ },
  { id: "SAVED_PRESCRIPTIONS", re: /Saved prescriptions/ },
  { id: "HOW_MUCH_TO_TAKE", re: /how much to take/i },
  { id: "SAFETY_FIRST", re: /safety-first/i },
  { id: "USUALLY_PREFERRED", re: /usually preferred/i },
  { id: "TAKE_AND_DRAW", re: /\bTake\s+\$\{/ },
];

function shouldSkip(relPath) {
  if (SKIP_REL_FILES.has(relPath)) {
    return true;
  }
  return SKIP_REL_PREFIXES.some((prefix) => relPath === prefix.slice(0, -1) || relPath.startsWith(prefix));
}

function globalize(re) {
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  return new RegExp(re.source, flags);
}

function collectHits(relPath, content) {
  const lines = content.split(/\r?\n/);
  const hits = [];

  lines.forEach((line, index) => {
    for (const pattern of PATTERNS) {
      const re = globalize(pattern.re);
      let match;
      while ((match = re.exec(line)) !== null) {
        hits.push({
          file: relPath,
          line: index + 1,
          patternId: pattern.id,
          match: match[0],
          excerptContext: line.trim(),
        });
      }
    }
  });

  return hits;
}

function loadAllowlist(absPath) {
  const parsed = JSON.parse(readText(absPath));
  if (!parsed || !Array.isArray(parsed.entries)) {
    throw new Error("forbidden-copy allowlist must contain an entries array");
  }
  return parsed.entries.map((entry, index) => {
    if (!entry.file || !entry.patternId || !entry.excerpt) {
      throw new Error(`allowlist entry ${index} is missing file, patternId, or excerpt`);
    }
    return {
      file: entry.file,
      patternId: entry.patternId,
      excerpt: entry.excerpt,
      used: false,
    };
  });
}

function consumeAllowlist(hit, allowlist) {
  const entry = allowlist.find((candidate) => {
    if (candidate.used) {
      return false;
    }
    if (candidate.file !== hit.file || candidate.patternId !== hit.patternId) {
      return false;
    }
    return hit.excerptContext.includes(candidate.excerpt) || candidate.excerpt.includes(hit.match);
  });
  if (entry) {
    entry.used = true;
    return true;
  }
  return false;
}

function main() {
  const root = repoRoot();
  const allowPath = path.join(allowlistDir(), "forbidden-copy.json");
  if (!fs.existsSync(allowPath)) {
    fail("SR-CI-002: forbidden-copy allowlist is missing.", [allowPath]);
  }

  const allowlist = loadAllowlist(allowPath);
  const files = walkFiles(root, { extensions: SCAN_EXTENSIONS })
    .map((abs) => ({ abs, rel: relPosix(root, abs) }))
    .filter((file) => !shouldSkip(file.rel));

  const novel = [];
  let rawHits = 0;

  for (const file of files) {
    const content = readText(file.abs);
    const hits = collectHits(file.rel, content);
    rawHits += hits.length;
    for (const hit of hits) {
      if (!consumeAllowlist(hit, allowlist)) {
        novel.push(hit);
      }
    }
  }

  if (novel.length) {
    fail(
      "SR-CI-002 / SAF-COPY-001: new forbidden clearance/clinical copy is not allowed.",
      novel.map((hit) => `${hit.file}:${hit.line} [${hit.patternId}] ${hit.match}`)
    );
  }

  const unused = allowlist.filter((entry) => !entry.used);
  console.log(`forbidden-copy gate passed (${rawHits} allowlisted match(es) on current tree).`);
  if (unused.length) {
    console.log("Unused allowlist entries (OK if P0.6 already removed the live string):");
    for (const entry of unused) {
      console.log(`  ${entry.file} [${entry.patternId}] ${entry.excerpt}`);
    }
  }
}

main();
