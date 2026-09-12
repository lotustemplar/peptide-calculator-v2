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

Issues remain the location for binding specifications, decisions, and project
history. Actionable Codex review requests are posted as new comments on the
applicable pull request and must include direct links to the applicable issue
comments. Do not place the only copy of a review handoff in Issue #2, another
issue, or chat.

## Required boundaries

- Never commit directly to `main`.
- Never merge or deploy without a completed independent review and the
  required authorization.
- Never expose credentials, bypass CI, broaden scope, or alter frozen
  calculator formulas without the required authorization.
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

Every agent-authored issue or pull-request comment must begin with exactly one
identity tag:

- `[GROK]`
- `[CODEX]`

Do not invent a third identity tag.

### Shared Grok / planning status tags

Grok and planning comments then include one status tag:

- `[CLAIM]`
- `[PLAN]`
- `[UPDATE]`
- `[REVIEW]`
- `[BLOCKED]`
- `[DECISION REQUIRED]`
- `[COMPLETE]`
- `[MERGED]`

`[GROK] [REVIEW]` is the required Grok review-request tag on a pull request.
`[GROK] [DECISION REQUIRED]` remains the Grok form when opening or updating a
`[DECISION]` issue for Filipe. `[GROK] [MERGED]` is posted after a successful
authorized routine merge and names the PR number and merge commit SHA.

### Codex review-response tags (new output)

After reviewing an exact commit head, Codex posts exactly one of:

- `[CODEX] [APPROVED]` — independent review accepts that exact head. This does
  not by itself authorize merge or deploy.
- `[CODEX] [CHANGES_REQUIRED]` — Grok implements only the requested corrections
  within approved scope, runs required tests, pushes to the same branch, and
  posts a new `[GROK] [REVIEW]` for the new exact commit SHA.
- `[CODEX] [NEXT_STAGE_AUTHORIZED]` — Grok proceeds with the authorized stage
  without waiting for Filipe unless the work crosses a Serious boundary. This
  tag authorizes the next stage, not a new merge. Legacy: when the body also
  names an exact 40-character SHA and explicitly authorizes merge of that
  head, treat that as exact-head merge authorization (still honored). Other
  protocol gates still apply.
- `[CODEX] [MERGE_AUTHORIZED]` — exact-head merge authorization for routine
  in-scope work that is not Serious and not owner-only. The comment body must
  name the full 40-character SHA. Recommended phrasing:
  `Forge may merge exact head <SHA>`.
- `[CODEX] [OWNER_REQUIRED]` — Grok stops and waits for Filipe. Serious
  decisions are routed through this tag.

Codex may later post `[CODEX] [MERGE_AUTHORIZED]` for the same unchanged
exact head after an earlier `[APPROVED]`. That later tag is the merge
authorization; `[APPROVED]` alone still is not.

Do not post the legacy bare form `[MERGE AUTHORIZED]` (without the
`[CODEX] [MERGE_AUTHORIZED]` tag), `[DECISION REQUIRED]`,
`[CHANGES REQUESTED]`, or `[REVIEW]` as new Codex review-response tags. The
tagged form `[CODEX] [MERGE_AUTHORIZED]` is the current merge-authorization
output and is required when Codex authorizes a routine exact-head merge.

### Legacy inbound aliases

Recognize these historical inbound tags where they already appear. Do not use
them as new Codex outputs:

- `[CHANGES REQUESTED]` — treat as `[CHANGES_REQUIRED]`
- `[MERGE AUTHORIZED]` (legacy bare form, without `[CODEX] [MERGE_AUTHORIZED]`)
  — treat as `[MERGE_AUTHORIZED]` / exact-head merge authorization only when
  the body names the authorized exact SHA; otherwise do not infer a merge
- `[DECISION REQUIRED]` from Codex — treat as `[OWNER_REQUIRED]`
- `[CODEX] [REVIEW]` — historical review note, not a current decision

## Human escalation

Filipe should be involved only for decisions that materially affect:

1. medical calculations, safety claims, medication interactions, or regulatory positioning;
2. destructive or irreversible data migrations;
3. authentication, privacy, collection of health data, or cloud synchronization;
4. production deployment, publishing, paid vendors, or meaningful recurring cost;
5. a major change to scope, architecture, visual identity, or supported platform;
6. a conflict between agents that cannot be resolved from approved requirements;
7. owner-only access, production release, paid services, or anything explicitly
   classified as Serious, including frozen calculator formulas.

Routine bug fixes, tests, internal refactors inside an approved architecture,
documentation, and non-destructive UI corrections may proceed through normal
issue/PR review without human interruption.

Do not ask Filipe to perform routine merges. A routine merge into the default
development branch is not itself a production release.

Stop and request owner involvement only for: medical/formula/safety decisions,
privacy or cloud changes, destructive changes, major redesigns, new paid
services, production release/deployment, owner-only access, unapproved scope
expansion, or anything explicitly classified as Serious.

## Working loop

1. Read the issue and linked requirements.
2. Post `[AGENT] [CLAIM]` with branch name, scope, and intended reviewer.
3. Post a short plan and acceptance criteria.
4. Work on a feature branch and keep the issue updated.
5. Open a draft pull request linked to the issue. Spec-only and inventory-only
   reviews still need a draft PR (docs or Spec deliverable) so Codex receives
   the handoff via PR events; binding Spec text stays on the issue and is
   linked from the PR `[REVIEW]`.
6. Post a new `[GROK] [REVIEW]` comment on that pull request using the required
   field format in `.github/AI_COLLABORATION.md`. Include the exact full commit
   SHA and direct links to the applicable issue comments. Do not place the only
   copy of the handoff on an issue or in chat.
7. Codex independently reviews that exact commit head and posts exactly one
   of `[APPROVED]`, `[CHANGES_REQUIRED]`, `[NEXT_STAGE_AUTHORIZED]`,
   `[MERGE_AUTHORIZED]`, or `[OWNER_REQUIRED]`.
8. After every correction push, post a fresh `[GROK] [REVIEW]` with the new
   exact commit SHA. Never ask Codex to review an old head. One handoff per
   exact commit head — do not repeatedly repost unchanged handoffs.
9. Merge only under the rules in `.github/AI_COLLABORATION.md`. For routine
   in-scope work, agents may undraft and merge when Codex has posted
   exact-head `[MERGE_AUTHORIZED]` (or a still-honored legacy SHA-named
   merge authorization) and all four verify checks pass. After merging,
   post `[GROK] [MERGED]` with the PR number and merge commit SHA. Proceed
   to the next stage only if Codex has authorized it. Do not ask Filipe to
   perform routine merges. Do not treat a routine merge into the default
   development branch as a production release or deploy.

## PR-first Codex review handoffs

Filipe locked this procedure on 2026-09-11. The full field definitions live in
`.github/AI_COLLABORATION.md`.

Every actionable Codex review request must be a **new** comment on the
applicable pull request, in this form:

```text
[GROK] [REVIEW]

Stage:
PR:
Exact full commit SHA:
Binding specification:
Changes made:
Tests performed:
CI status:
Evidence:
Known limitations:
Decision requested from Codex:
```

Rules:

- Issues keep binding specifications, decisions, and history. The PR handoff
  must link the applicable issue comments.
- After every correction push, post a fresh `[GROK] [REVIEW]` with the new
  exact commit SHA. Never ask Codex to review an old head.
- One handoff per exact commit head. Do not repeatedly repost an unchanged
  handoff.
- `[CODEX] [APPROVED]`: the exact head is accepted; this is not merge
  authorization.
- `[CODEX] [CHANGES_REQUIRED]` (legacy inbound `[CHANGES REQUESTED]`):
  implement only the requested corrections within approved scope, run required
  tests, push to the same branch, and post a new review handoff.
- `[CODEX] [NEXT_STAGE_AUTHORIZED]`: proceed with the authorized stage without
  waiting for Filipe unless the work crosses a Serious boundary. This is
  next-stage authorization, not a new merge authorization. Legacy: when the
  body names an exact SHA and explicitly authorizes merge of that head,
  treat that as exact-head merge authorization (still honored).
- `[CODEX] [MERGE_AUTHORIZED]`: exact-head merge authorization for routine
  in-scope, non-Serious work. Body must name the full 40-character SHA
  (recommended: `Forge may merge exact head <SHA>`). Agents may undraft and
  merge only after the four verify checks in `.github/AI_COLLABORATION.md`.
- `[CODEX] [OWNER_REQUIRED]`: stop and wait. Serious decisions use this tag.
- Spec-only / inventory-only reviews still need a draft PR so Codex receives
  the handoff via PR events.

When instructions conflict, stop and write `[BLOCKED]` in the issue rather than
silently guessing.
