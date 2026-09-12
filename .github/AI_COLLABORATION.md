# Grok Bot ↔ Codex Collaboration Protocol

## Purpose

GitHub is the mailbox, work queue, audit log, and handoff surface shared by Grok
Bot and ChatGPT Codex. Neither agent needs direct access to the other's private
conversation.

## Roles

- **Grok Bot team:** discovery, product specification, implementation on feature
  branches, test evidence, and responses to review.
- **Codex:** backlog refinement, independent code/PR review, verification,
  routine technical decisions inside approved requirements, and escalation of
  serious decisions to Filipe.
- **Filipe:** product owner for decisions marked `[DECISION REQUIRED]` or
  `[OWNER_REQUIRED]`.

Roles may be reassigned in an issue, but the author of production code should
not be its only reviewer.

## GitHub objects

### Issues are tasks

Every actionable unit starts as one issue titled with one of:

- `[DISCOVERY]`
- `[BUG]`
- `[FEATURE]`
- `[SECURITY]`
- `[DECISION]`

The issue body must contain:

- Outcome
- Evidence/current behavior
- Scope
- Out of scope
- Requirement IDs, if available
- Acceptance criteria
- Risk class: routine / elevated / serious
- Data migration and rollback
- Owner
- Reviewer
- Dependencies

### Pull requests are deliverables

A PR must:

- link one primary issue;
- use a feature branch;
- remain draft until tests pass;
- contain no unrelated cleanup;
- include test commands and exact results;
- document privacy/security, migration, and rollback;
- include screenshots for user-visible changes;
- identify any unverified assumptions.

### Comments are handoffs

Use the identity and status tags defined in `AGENTS.md` and restated under
**Identity and review-response tags** below.

A complete issue or planning handoff comment must say:

1. what changed or was learned;
2. where the evidence is;
3. what remains;
4. who owns the next action;
5. whether human approval is required.

**Actionable Codex review requests are PR-first.** Every such request must be
posted as a **new** `[GROK] [REVIEW]` comment on the applicable pull request.
Do not place the only copy of a review handoff in Issue #2, another issue, or
chat. Issues remain the location for binding specifications, decisions, and
project history. The PR handoff must include direct links to the applicable
issue comments.

## Task state machine

`OPEN → CLAIMED → PLANNED → IN PROGRESS → PR READY → IN REVIEW → CHANGES_REQUIRED | APPROVED → COMPLETE`

`CHANGES REQUESTED` remains recognized as the legacy wording for
`CHANGES_REQUIRED`. `[NEXT_STAGE_AUTHORIZED]` and `[OWNER_REQUIRED]` are
Codex review outcomes that sit beside this machine: the former authorizes the
named next stage; the latter stops work pending Filipe.

Only one agent owns implementation at a time. A reviewer may create tests or a
minimal reproduction, but must not concurrently rewrite the same production
files without coordinating first.

A claim expires when the owner explicitly releases it or posts no update for 24
hours. Before taking over an apparently stale claim, ask in the issue and allow
a reasonable response window.

## Identity and review-response tags

Keep `[GROK]` / `[CODEX]` as the only identity tags. Do not invent a third
identity.

### Shared status tags

- `[CLAIM]`
- `[PLAN]`
- `[UPDATE]`
- `[REVIEW]`
- `[BLOCKED]`
- `[DECISION REQUIRED]`
- `[COMPLETE]`
- `[APPROVED]`
- `[MERGE AUTHORIZED]`

`[REVIEW]`, `[APPROVED]`, `[MERGE AUTHORIZED]`, and `[DECISION REQUIRED]` remain
valid for compatibility. `[APPROVED]` accepts the reviewed head and does not by
itself authorize merge or deploy. `[MERGE AUTHORIZED]` is the explicit merge
signal and still requires every other protocol gate.

### Codex review-response tags

Codex posts one of these on the pull request after reviewing an exact commit
head:

- `[CHANGES_REQUIRED]` — Grok implements only the requested corrections within
  approved scope, runs required tests, pushes to the same branch, and posts a
  new `[GROK] [REVIEW]` for the new exact commit SHA. Legacy wording
  `[CHANGES REQUESTED]` remains recognized as the same signal.
- `[NEXT_STAGE_AUTHORIZED]` — Grok proceeds with the authorized stage without
  waiting for Filipe unless the work crosses a Serious boundary.
- `[OWNER_REQUIRED]` — Grok stops and waits for Filipe.

## PR-first Codex review handoffs

Filipe locked this procedure on 2026-09-11 for
`lotustemplar/peptide-calculator-v2`.

### Binding rules

1. Every actionable Codex review request must be posted as a **new** comment
   on the applicable pull request. Do not place the only copy of a handoff in
   Issue #2, another issue, or chat.
2. Issues remain the location for binding specifications, decisions, and
   project history. PR handoffs must include direct links to the applicable
   issue comments.
3. Use the required `[GROK] [REVIEW]` field format below.
4. Post a fresh `[GROK] [REVIEW]` after every correction push, with the new
   exact full commit SHA. Never ask Codex to review an old head. One handoff
   per exact commit head — do not repeatedly repost unchanged handoffs.
5. When Codex posts `[CODEX] [CHANGES_REQUIRED]` (also accept legacy wording
   `CHANGES REQUESTED`): implement only the requested corrections within
   approved scope, run required tests, push to the same branch, and post a new
   review handoff.
6. When Codex posts `[CODEX] [NEXT_STAGE_AUTHORIZED]`: proceed with the
   authorized stage without waiting for Filipe unless the work crosses a
   Serious boundary.
7. When Codex posts `[CODEX] [OWNER_REQUIRED]`: stop and wait.
8. Serious boundaries: medical/formula/safety decisions, privacy or cloud
   changes, destructive changes, major redesigns, paid services, production
   release, owner-only access, and anything explicitly classified as Serious.
9. Do not merge, deploy, expose credentials, bypass CI, broaden scope, or
   alter frozen calculator formulas without the required authorization.
10. Spec-only / inventory-only reviews still need a draft PR (docs or Spec
    deliverable) so Codex receives the handoff via PR events. Binding Spec
    text stays on the issue and is linked from the PR `[REVIEW]`.

### Required `[GROK] [REVIEW]` format

Every review request uses this exact field set:

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

Field intent:

- **Stage:** named recovery, P0, docs, Spec, or inventory stage under review.
- **PR:** pull-request URL or number.
- **Exact full commit SHA:** the 40-character tip being reviewed, not a branch
  name, short SHA, or older head.
- **Binding specification:** direct links to the issue comments that bind this
  change. Do not paste the only copy of binding Spec text into the PR comment.
- **Changes made:** what this exact head contains.
- **Tests performed:** commands and exact results.
- **CI status:** current checks for this SHA.
- **Evidence:** links to logs, screenshots, or docs that support the change.
- **Known limitations:** unverified assumptions and leftover risk.
- **Decision requested from Codex:** the specific review outcome Grok needs
  (`CHANGES_REQUIRED`, `NEXT_STAGE_AUTHORIZED`, `OWNER_REQUIRED`, `APPROVED`,
  or a scoped finding list).

## Decision policy

### Routine: agents may resolve

Examples:

- correcting a confirmed bug within approved behavior;
- adding tests or CI;
- internal refactoring without user-visible or persisted-data changes;
- accessibility corrections that preserve the approved design;
- documentation;
- non-destructive import validation;
- dependency patching after tests pass and no breaking change is involved.

Resolution requires a written rationale and independent review.

### Elevated: proceed only with explicit cross-agent agreement

Examples:

- user-visible workflow changes within the approved product specification;
- a reversible schema migration;
- adding a dependency or changing a notification implementation;
- performance or maintainability changes across several modules.

Both Grok and Codex must agree in the issue. If they disagree, escalate.

### Serious: Filipe must decide

Examples:

- formulas, units, rounding rules, dose presentation, safety warnings, or
  medication-interaction behavior;
- collecting, transmitting, or storing personal health information;
- authentication, cloud sync, analytics, or third-party health integrations;
- destructive migration or loss of backup compatibility;
- framework/platform rewrite or major visual redesign;
- new paid service or recurring cost;
- production deployment, store release, or public launch;
- legal/regulatory positioning;
- owner-only access;
- altering frozen calculator formulas;
- anything explicitly classified as Serious.

Create or update a `[DECISION]` issue and post:

`[AGENT] [DECISION REQUIRED]`

Then provide:

- one-sentence decision;
- recommended option first;
- two or three mutually exclusive options;
- impact, cost, risk, and reversibility of each;
- evidence and recommendation;
- safe default while waiting.

Do not continue the affected work until Filipe answers. Unaffected work may
continue.

Do not merge, deploy, expose credentials, bypass CI, broaden scope, or alter
frozen calculator formulas without the required authorization.
`[CODEX] [NEXT_STAGE_AUTHORIZED]` does not waive a Serious boundary.

## Review standard

Codex reviews the exact commit SHA named in the latest `[GROK] [REVIEW]` on
the pull request. Do not review an older head when a newer handoff exists.

Codex review should verify:

- linked requirements and acceptance criteria;
- root cause, not only symptom suppression;
- calculation and unit tests;
- time-zone, DST, restart, permission, and duplicate-reminder behavior when relevant;
- storage schema, import validation, rollback, and backward compatibility;
- privacy-safe logging and absence of secrets;
- accessibility and mobile behavior;
- no new runtime monkey patch;
- reproducible test output.

Blocking findings must be numbered and include file evidence plus the expected
correction. Non-blocking suggestions must be labeled as such.

## Conflict avoidance

- Branch naming:
  - Grok: `grok/<issue-number>-<short-name>`
  - Codex: `codex/<issue-number>-<short-name>`
- Do not reuse branches.
- Do not combine multiple active issues in one branch.
- Before touching a file named in another active claim, coordinate in both
  issues and name the integration owner.
- Rebase/update from `main` before final review and rerun relevant tests.

## Automation loop

### Grok Bot routine

On a recurring schedule, inspect open repository issues and PR notifications.

1. Read `AGENTS.md` and this protocol.
2. Respond to new `[CODEX]` handoffs on pull requests (`[CHANGES_REQUIRED]`,
   `[NEXT_STAGE_AUTHORIZED]`, `[OWNER_REQUIRED]`, `[APPROVED]`,
   `[MERGE AUTHORIZED]`, or `[DECISION REQUIRED]`).
3. Continue the highest-priority issue already claimed by Grok.
4. If idle, claim the oldest unblocked issue explicitly assigned to Grok.
5. Update the issue, push the feature branch, and post a new `[GROK] [REVIEW]`
   on the applicable PR for the new exact commit SHA.
6. Do not merge or deploy. Do not expose credentials, bypass CI, broaden
   scope, or alter frozen calculator formulas without the required
   authorization.
7. Notify Filipe only for `[DECISION REQUIRED]` or `[OWNER_REQUIRED]`.
8. Spec-only / inventory-only work still opens a draft PR so Codex receives
   the review handoff via PR events.

Retries must be idempotent: check the current issue, branch, and PR before
creating anything.

### Codex loop

When a PR review handoff arrives:

1. Read the complete issue, the linked binding specification comments, the PR,
   the exact named commit SHA, the diff, test evidence, and prior review.
2. Review and verify independently against that exact head.
3. Post a tagged review on the pull request:
   `[CHANGES_REQUIRED]`, `[NEXT_STAGE_AUTHORIZED]`, `[OWNER_REQUIRED]`,
   `[APPROVED]`, `[MERGE AUTHORIZED]`, or `[DECISION REQUIRED]`.
4. If `[CHANGES_REQUIRED]`, hand ownership back to Grok for those items only.
5. If Serious or `[OWNER_REQUIRED]`, stop the affected work and create a
   concise decision request for Filipe.
6. Do not treat an issue-only or chat-only note as the review request when no
   matching PR `[GROK] [REVIEW]` exists.
7. Do not expose repository secrets or private health data.

## Initial discovery rule

Discovery is read-only until Product Specification v1 is approved. Discovery
Bots may create reports and issues, but must not modify application code,
configuration, infrastructure, or production services.
