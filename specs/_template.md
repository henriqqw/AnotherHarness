# <NNNN> — <Capability title>

| Field | Value |
| --- | --- |
| Status | draft / approved / implemented / superseded |
| Area | <package group, e.g. session, core, client> |
| Owner | <GitHub handle> |
| Created | <YYYY-MM-DD> |
| Related | <links to specs, issues, PRs> |

## Problem

What is wrong or missing today, and who feels it. One or two paragraphs.

## Goals

- ...

## Non-goals

- ...

## User-visible behavior

Describe the behavior from the user's point of view (CLI, Web, Desktop, SDK).

## Acceptance criteria

- **AC-1** — Given <context>, when <action>, then <observable result>.
- **AC-2** — ...

## Contracts

- Service definitions, types, and events added or changed.
- Session-log impact: new events, format version, reader compatibility.
- Configuration fields (name, type, default, validation).

## Design

Packages touched, capability seams (definition / provider / consumer), data flow, and alternatives considered.

## Risks and mitigations

- ...

## Rollout

Feature flag or profile, migration steps, upgrade-guide entry if breaking.

## Implementation plan

1. ...

## Verification

| Criterion | Test | Verified |
| --- | --- | --- |
| AC-1 | `packages/.../tests/....spec.ts` | ☐ |
