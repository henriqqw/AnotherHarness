# 0001 — Conversation actions: copy, edit, rewind, fork from here, delete

| Field | Value |
| --- | --- |
| Status | implemented |
| Area | session (session-controller, workspace, persistence, client ui-chat, ui-workspace) |
| Owner | henriqqw |
| Created | 2026-11-12 |
| Related | [spec 0002](../privacy/0002-user-data-privacy-by-default.md) |

## Problem

Users cannot copy a message, edit a message they already sent, rewind a conversation to an earlier point, fork from any earlier point, or delete a conversation. Today the product offers rename, archive, fork of the whole conversation, and "Branch into a new conversation" only on the last message of a completed turn, although `session.fork` already accepts any completed-turn boundary (`atSeq`).

## Goals

- Copy any user or assistant message.
- Edit a sent user message and continue from the edited version.
- Rewind a conversation to the end of any completed turn.
- Fork from the end of any completed turn.
- Permanently delete a conversation after confirmation.

## Non-goals

- Rewriting a Session log in place: logs stay append-only; edit and rewind create a new Session.
- Restoring files the agent changed after the chosen point (workspace checkpoints are a separate capability).
- Deleting shared attachments that another Session may still reference.

## User-visible behavior

- **Copy** — every user and assistant message shows a copy button; it copies the message's visible text (Markdown for assistant replies) and shows a short confirmation.
- **Fork from here** — the branch button appears at the end of every completed turn that has a reply, not only the last one; it creates a new conversation up to that point and opens it. The source stays visible.
- **Rewind to here** — at the end of every completed turn; it forks up to that point, opens the new conversation, and archives the source so the sidebar shows the rewound conversation. The source stays recoverable under "Archived".
- **Edit** — on every sent user message; it opens an inline editor prefilled with the message text. Messages with attachments or structured blocks show the action as unavailable until attachment re-upload is supported. Submitting forks at the end of the previous completed turn, sends the edited message in the new conversation, opens it, and archives the source. Editing the first message of a conversation starts a new conversation in the same workspace with the edited message.
- **Delete** — in the session menu; a confirmation dialog names the conversation and states that it cannot be undone. Confirming removes the Session's log directory, its projection cache, and its workspace, pin, and archive entries. A running conversation must be stopped first.

## Acceptance criteria

- **AC-1** — Given a completed assistant message, when the user clicks copy, then the clipboard holds that message's visible text.
- **AC-2** — Given a sent user message, when the user clicks copy, then the clipboard holds the message text.
- **AC-3** — Given a conversation with three completed turns, when the user chooses fork from here on turn 1, then a new Session seeded through the end of turn 1 opens and the source is unchanged.
- **AC-4** — Given the same conversation, when the user chooses rewind to here on turn 2, then a new Session seeded through the end of turn 2 opens and the source is archived.
- **AC-5** — Given a sent user message in turn 3, when the user edits and submits it, then a new Session seeded through the end of turn 2 receives the edited message, opens, and the source is archived.
- **AC-6** — Given the first user message, when the user edits and submits it, then a new Session in the same workspace receives the edited message.
- **AC-7** — Given an idle conversation, when the user confirms delete, then `session.delete` removes its log directory, projection cache entry, and registry entries, and it no longer appears in `session.list`.
- **AC-8** — Given a running conversation, when delete is requested, then the request is rejected with an actionable error and nothing is removed.
- **AC-9** — Given a forked child whose parent is deleted, when the child is opened, then it loads and works, because its seed is self-contained.

## Contracts

- **New Remote method** `session.delete({ sessionId })` → `{ deleted: true }`; errors `session/not-found`, `session/active` (running), `gateway/internal`.
- **Persistence** `SessionPersistence.delete(id)` removes one stored Session; the JSONL provider removes the Session directory and an emptied project directory. Other providers implement it or report it unsupported.
- **Workspace registry** `forgetSession(id)` removes the Session from workspace, archive, and pin lists.
- **Session format** unchanged; no new events. Edit and rewind reuse `session.fork` (`atSeq`) plus the existing prompt and archive operations.

## Design

- Client orchestration in `ui-chat` composes existing operations: `fork(atSeq)` → `openSession(child)` → (`archiveSession(source)` for rewind and edit) → (`prompt(child, edited)` for edit). Failures leave the source unchanged and visible.
- `session.delete` lives in `session-controller`; it refuses a live running Agent, disposes an idle attached Agent, calls `sessionPersistence.delete`, the projection-cache eviction, and `workspaceRegistry.forgetSession`.
- Copy uses the Clipboard API with a fallback; the Desktop shell's clipboard permission already covers the Web origin.

## Risks and mitigations

- Permanent data loss → explicit confirmation naming the conversation; running conversations refuse deletion; archive remains the reversible option.
- Edit loses later turns from view → the source is archived, not deleted.
- Attachments of a deleted Session stay on disk → documented limitation; a later spec can add reference-counted collection.

## Rollout

Ships in the shipped `web-app` composition; no configuration. User guide page updated (EN/ZH).

## Implementation plan

1. Persistence `delete` (interface + JSONL) and workspace `forgetSession`, with tests.
2. `session.delete` Remote method, typert contract regeneration, tests (AC-7, AC-8, AC-9).
3. `ui-chat`: copy (AC-1, AC-2), fork from any completed turn (AC-3), rewind (AC-4), edit (AC-5, AC-6).
4. `ui-workspace`: delete menu item and confirmation dialog.
5. Docs, catalogs, gates.

## Verification

| Criterion | Test | Verified |
| --- | --- | --- |
| AC-1 | `packages/client/ui-chat/tests/chat-view.client.spec.tsx` (assistant copy, existing) | ☑ |
| AC-2 | `packages/client/ui-chat/tests/chat-view.client.spec.tsx` (user copy, existing) | ☑ |
| AC-3 | `packages/client/ui-chat/tests/chat-view.client.spec.tsx` (fork with a later steering Node), `packages/client/ui-chat/tests/conversation-node-definitions.client.spec.ts` (branching after a tool result) | ☑ |
| AC-4 | `packages/client/ui-chat/tests/chat-view.client.spec.tsx` (rewind), `packages/client/ui-chat/tests/apply-inject.client.spec.tsx` (archive after open) | ☑ |
| AC-5 | `packages/client/ui-chat/tests/message-edit.client.spec.ts`, `packages/client/ui-chat/tests/chat-view.client.spec.tsx` (inline editor) | ☑ |
| AC-6 | `packages/client/ui-chat/tests/message-edit.client.spec.ts` (first message) | ☑ |
| AC-7 | `packages/api/session-controller/tests/session-delete.host.spec.ts`, `packages/session/session-persistence-jsonl/tests/delete.spec.ts`, `packages/workspace/workspace/tests/workspace.spec.ts`, `packages/session/session-projection-cache/tests/cache.spec.ts`, `packages/client/ui-workspace/tests/session-actions.client.spec.tsx` | ☑ |
| AC-8 | `packages/api/session-controller/tests/session-delete.host.spec.ts` (running and foreign), `packages/session/session-persistence-jsonl/tests/delete.spec.ts` (open writer), `packages/client/ui-workspace/tests/session-actions.client.spec.tsx` (actionable error) | ☑ |
| AC-9 | `packages/session/session-persistence-jsonl/tests/delete.spec.ts` (child readable after parent deletion) | ☑ |
