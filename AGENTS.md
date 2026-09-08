# AI Collaboration Rules

This repository uses GitHub as the asynchronous communication bridge between
Grok Bot and ChatGPT Codex.

All agents working in this repository must read this file and
`.github/AI_COLLABORATION.md` before planning, editing, reviewing, or opening a
pull request.

## Source of truth

GitHub Issues, pull requests, commits, and repository files are authoritative.
A private chat is not authoritative until its decision or instruction is
written into the relevant issue or pull request.

## Required boundaries

- Never commit directly to `main`.
- Never merge or deploy without a completed independent review.
- Never add another runtime `*-fix.js` patch.
- Never put credentials, tokens, private health data, or personal dosing history
  in GitHub.
- Preserve the current UI identity and existing user data unless an approved
  requirement explicitly says otherwise.
- Use one issue and one branch per coherent change.
- Claim an issue before editing. Do not modify files owned by another active
  task without coordinating in that issue.
- Reproduce bugs and add a failing regression test before fixing them whenever
  practical.
- Do not state or encode medical advice, recommended therapeutic doses, drug
  compatibility, or drug-interaction claims without an approved, cited,
  clinically reviewed requirement.
- Do not infer that a missing interaction means a combination is safe.

## Agent identity

Every agent-authored issue or pull-request comment must begin with exactly one:

- `[GROK]`
- `[CODEX]`

Then include one status tag:

- `[CLAIM]`
- `[PLAN]`
- `[UPDATE]`
- `[REVIEW]`
- `[BLOCKED]`
- `[DECISION REQUIRED]`
- `[COMPLETE]`

## Human escalation

Filipe should be involved only for decisions that materially affect:

1. medical calculations, safety claims, medication interactions, or regulatory positioning;
2. destructive or irreversible data migrations;
3. authentication, privacy, collection of health data, or cloud synchronization;
4. production deployment, publishing, paid vendors, or meaningful recurring cost;
5. a major change to scope, architecture, visual identity, or supported platform;
6. a conflict between agents that cannot be resolved from approved requirements.

Routine bug fixes, tests, internal refactors inside an approved architecture,
documentation, and non-destructive UI corrections may proceed through normal
issue/PR review without human interruption.

## Working loop

1. Read the issue and linked requirements.
2. Post `[AGENT] [CLAIM]` with branch name, scope, and intended reviewer.
3. Post a short plan and acceptance criteria.
4. Work on a feature branch and keep the issue updated.
5. Open a draft pull request linked to the issue.
6. The other agent independently reviews and posts blocking findings.
7. The author resolves findings and provides test evidence.
8. The reviewer marks the PR approved or escalates a serious decision.
9. Merge/deploy only under the rules in `.github/AI_COLLABORATION.md`.

When instructions conflict, stop and write `[BLOCKED]` in the issue rather than
silently guessing.
