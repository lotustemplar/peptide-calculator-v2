"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { DEFAULT_ROOT } = require("./lib");

function gitRoot() {
  return process.env.FITGEN_CI_GIT_ROOT || DEFAULT_ROOT;
}

function resolveBaseRef() {
  if (process.env.FITGEN_CI_BASE_REF) {
    return process.env.FITGEN_CI_BASE_REF;
  }
  if (process.env.GITHUB_BASE_REF) {
    return `origin/${process.env.GITHUB_BASE_REF}`;
  }
  return "origin/main";
}

function git(args, cwd = gitRoot()) {
  return spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });
}

function baseRefAvailable() {
  if (process.env.FITGEN_CI_BASE_ROOT) {
    return true;
  }
  const ref = resolveBaseRef();
  const result = git(["rev-parse", "--verify", ref]);
  return result.status === 0;
}

function requireBaseRef() {
  if (baseRefAvailable()) {
    return;
  }
  if (process.env.FITGEN_CI_ALLOW_MISSING_BASE === "1") {
    return;
  }
  const ref = resolveBaseRef();
  console.error(
    `SR-CI-001: cannot resolve CI base ref '${ref}'. Fetch the PR base (git fetch origin <base>) or set FITGEN_CI_BASE_ROOT. Do not use pull_request_target.`
  );
  process.exit(1);
}

function readBaseFile(relPath) {
  if (process.env.FITGEN_CI_BASE_ROOT) {
    const abs = path.join(process.env.FITGEN_CI_BASE_ROOT, relPath);
    if (!fs.existsSync(abs)) {
      return null;
    }
    return fs.readFileSync(abs, "utf8");
  }

  if (process.env.FITGEN_CI_ALLOW_MISSING_BASE === "1" && !baseRefAvailable()) {
    return null;
  }

  const ref = resolveBaseRef();
  const result = git(["show", `${ref}:${relPath}`]);
  if (result.status !== 0) {
    return null;
  }
  return result.stdout;
}

function listChangedFiles() {
  if (process.env.FITGEN_CI_LINT_FILES) {
    return process.env.FITGEN_CI_LINT_FILES.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }

  if (process.env.FITGEN_CI_BASE_ROOT) {
    return [];
  }

  if (process.env.FITGEN_CI_ALLOW_MISSING_BASE === "1" && !baseRefAvailable()) {
    return [];
  }

  const ref = resolveBaseRef();
  const result = git(["diff", "--name-only", "--diff-filter=ACMRT", ref]);
  if (result.status !== 0) {
    console.error(`SR-CI-001: git diff against '${ref}' failed.`);
    if (result.stderr) {
      console.error(result.stderr.trim());
    }
    process.exit(1);
  }

  const tracked = result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const untracked = git(["ls-files", "--others", "--exclude-standard"]);
  const extra = untracked.status === 0
    ? untracked.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    : [];
  return [...new Set([...tracked, ...extra])].sort();
}

module.exports = {
  baseRefAvailable,
  gitRoot,
  listChangedFiles,
  readBaseFile,
  requireBaseRef,
  resolveBaseRef,
};
