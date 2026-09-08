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
- **Filipe:** product owner for decisions marked `[DECISION REQUIRED]`.

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

Use the identity and status tags defined in `AGENTS.md`. A complete handoff
comment must say:

1. what changed or was learned;
2. where the evidence is;
3. what remains;
4. who owns the next action;
5. whether human approval is required.

## Task state machine

`OPEN → CLAIMED → PLANNED → IN PROGRESS → PR READY → IN REVIEW → CHANGES REQUESTED | APPROVED → COMPLETE`

Only one agent owns implementation at a time. A reviewer may create tests or a
minimal reproduction, but must not concurrently rewrite the same production
files without coordinating first.

A claim expires when the owner explicitly releases it or posts no update for 24
hours. Before taking over an apparently stale claim, ask in the issue and allow
a reasonable response window.

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
- legal/regulatory positioning.

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

## Review standard

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
2. Respond to new `[CODEX]` handoffs.
3. Continue the highest-priority issue already claimed by Grok.
4. If idle, claim the oldest unblocked issue explicitly assigned to Grok.
5. Update the issue, push the feature branch, or respond to review.
6. Do not merge or deploy.
7. Notify Filipe only for `[DECISION REQUIRED]`.

Retries must be idempotent: check the current issue, branch, and PR before
creating anything.

### Codex loop

When a PR or issue handoff arrives:

1. Read the complete issue, PR, diff, test evidence, and prior review.
2. Review and verify independently.
3. Post a tagged review or routine decision.
4. If changes are required, hand ownership back to Grok.
5. If serious, create a concise decision request for Filipe.
6. Do not expose repository secrets or private health data.

## Initial discovery rule

Discovery is read-only until Product Specification v1 is approved. Discovery
Bots may create reports and issues, but must not modify application code,
configuration, infrastructure, or production services.
