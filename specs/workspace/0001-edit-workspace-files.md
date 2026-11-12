# 0001 — Workspace code editor

| Field | Value |
| --- | --- |
| Status | approved |
| Area | workspace (api/workspace-files, client ui-sidebar-documentpreview, ui-sidebar-files, new ui-code-editor) |
| Owner | henriqqw |
| Created | 2026-11-12 |
| Related | [spec terminal/0001](../terminal/0001-live-agent-terminals-and-profiles.md), research report "Agent harness features research" (local) |

## Problem

The Web UI shows workspace files read-only: the workspace-files service exposes no mutation, and the file preview renders code through the read-only Shiki `CodeBlock`. To fix a typo, change a config value, adjust what the agent wrote, or create a file, the user must leave the product. When the agent and the user touch the same file, nothing warns either side.

## Goals

- A VS Code-style code editor built on CodeMirror 6, with AnotherHarness's own look: VS Code key bindings, multiple cursors, search and replace, folding, minimap, autocomplete, and a status bar.
- Edit in the file preview tab or in a full-screen editor with tabs, and save to disk like VS Code (Ctrl/Cmd+S, unsaved-changes markers, close confirmation).
- Version-guarded saves with conflict handling in both directions between the user and the agent.
- Create, rename, and delete files and folders from the Files tree.
- Hover, go to definition, and find references when a language server is configured.

## Non-goals

- VS Code extensions, debugger, integrated source control (the Review tab and diff cards stay the review surfaces), settings sync.
- Language-server completion and diagnostics: the `ctx.lsp` seam exposes navigation and hover only. Autocomplete uses words, language keywords, and snippets.
- Editing binary files, files above the editable size cap, or anything outside the workspace root.
- Real-time collaborative editing; several browsers share only the version check.
- Undo or checkpoints of agent edits.

## User-visible behavior

- **Open** — a text file opens read-only in the right-sidebar preview, as today. **Editor** in the preview's viewer menu opens it in the editor, and **Edit** there turns on input; **Open in editor** (or double-click in the Files tree) opens the full-screen editor area, which holds one tab per open file.
- **Editing** — syntax highlighting for the common languages (TypeScript/JavaScript/JSX, Python, JSON, CSS, HTML, Markdown, YAML, Rust, Go, Java, C/C++, SQL, PHP, XML, shell, Dockerfile, TOML), line numbers, active-line and matching-bracket highlight, auto-closing brackets and quotes, smart indentation, indentation guides, code folding, word wrap toggle, whitespace rendering toggle, and a minimap.
- **VS Code keys** — multiple cursors (Alt+Click, Ctrl/Cmd+D, Ctrl/Cmd+Alt+Up/Down), column selection (Shift+Alt+drag), move and copy lines (Alt/Shift+Alt+Up/Down), toggle comment (Ctrl/Cmd+/), indent and outdent, go to line (Ctrl+G), search (Ctrl/Cmd+F) and replace (Ctrl/Cmd+H) with case, whole-word, and regex options, select all occurrences (Ctrl/Cmd+Shift+L).
- **Autocomplete** — suggestions from words in open files, the language's keywords, and built-in snippets; Tab or Enter accepts, Escape dismisses.
- **Status bar** — cursor line and column, selection size, language (changeable), indentation (spaces or tabs and width, changeable), line endings (LF or CRLF), and encoding (UTF-8).
- **Saving** — a dot marks unsaved tabs; Ctrl/Cmd+S saves the focused file, Ctrl/Cmd+Alt+S saves all. Closing a tab or the editor with unsaved changes asks to Save, Don't save, or Cancel.
- **Conflicts** — when the file changed on disk since it was loaded (the agent edited it, or another browser saved it), saving writes nothing and shows a banner: **Reload** (discard the draft), **Compare** (side-by-side diff of disk and draft), **Overwrite** (save over the disk version after confirming). The banner also appears as soon as a change arrives while the draft is dirty; a clean editor reloads silently.
- **Agent awareness** — after the user saves, the agent's next write or edit of that file fails with its existing "file changed since you read it" message, so it re-reads the user's version.
- **Files tree** — New File, New Folder, Rename (F2), and Delete (with a confirmation naming the item; folders list how many entries they hold) from the context menu and toolbar. Open editor tabs follow renames and close on deletion, keeping unsaved drafts recoverable from a prompt.
- **Language intelligence** — with a language server configured for the file's extension: hover shows types and docs, F12 or Ctrl/Cmd+Click goes to the definition (opening the target file at the line), Shift+F12 lists references in a panel. Without one, these actions are hidden.

## Acceptance criteria

- **AC-1** — Given a UTF-8 text file under the editable cap, when the user edits and saves it, then the file on disk holds the new text and the tab shows no unsaved marker.
- **AC-2** — Given the file changed on disk after it was loaded, when the user saves, then nothing is written and the conflict banner appears.
- **AC-3** — Given the conflict banner, when the user chooses Overwrite and confirms, then the draft is written over the current disk version; Reload replaces the draft with the disk text; Compare shows both versions side by side.
- **AC-4** — Given unsaved changes, when the agent changes the file, then the draft is kept and the conflict banner appears; given no unsaved changes, the editor reloads the new text.
- **AC-5** — Given the agent read a file and the user then saved it, when the agent writes or edits that file, then its tool call fails with the stale-version message.
- **AC-6** — Given a path outside the workspace, a symbolic link, a binary file, or content above the cap, when a save, create, rename, or delete is requested, then it is refused with an actionable error and nothing changes.
- **AC-7** — Given unsaved changes, when the user closes the tab, then Save, Don't save, and Cancel are offered, and Cancel keeps the tab and draft.
- **AC-8** — Given the editor, when the user uses the listed VS Code key bindings (multiple cursors, move line, toggle comment, search and replace with regex, go to line), then they behave as in VS Code.
- **AC-9** — Given a file in a supported language, when it opens, then it is highlighted, foldable, and shown in the minimap, and the status bar shows its language, indentation, and line endings.
- **AC-10** — Given the editor area, when the user opens several files, then each has a tab, switching keeps each draft and scroll position, and Save all writes every dirty file.
- **AC-11** — Given the Files tree, when the user creates, renames, or deletes a file or folder, then the workspace reflects it, open tabs follow renames, and deletions ask for confirmation first.
- **AC-12** — Given a configured language server, when the user hovers a symbol, presses F12, or presses Shift+F12, then hover text, the definition, or the references appear; without one, these actions are absent.
- **AC-13** — Given typing in the editor, when completions are available, then suggestions from file words, keywords, and snippets appear and Tab or Enter accepts one.

## Contracts

- **Remote `workspaceFiles`** (all take `sessionId`; writes require workspace containment, refuse final symbolic links, and use a workspace-write sandbox policy rooted at the Session workspace):
  - `write({ path, content, expectedVersion })` → `WorkspaceFileStat`. Errors: `workspace-file/conflict { path, currentVersion }`, `outside-workspace`, `not-regular-file`, `too-large`, `not-text`, `write-denied`.
  - `create({ path, kind: 'file' | 'directory', content? })` → `WorkspaceFileStat`; `workspace-file/exists` when the path is taken.
  - `rename({ from, to, expectedVersion? })` → `WorkspaceFileStat`; `exists` when the target is taken.
  - `deleteEntry({ path, recursive })` → `{ removed: true }`; a non-empty directory needs `recursive`. (`remove` is a reserved member of the Client namespace service.)
  - `navigate({ path, line, column, operation: 'hover' | 'goToDefinition' | 'findReferences' })` → the `ctx.lsp` result, or `workspace-file/no-language-server` when `ctx.lsp` is absent or no provider handles the file.
- **Filesystem seam** — `ctx.fs` gains `rename` and `remove` with version guards if absent; `writeText` with `replaceIfVersion` already exists. Every mutation emits `fs/observed` without an agent actor, so the change feed updates all open views and no agent is credited.
- **Configuration** — `workspace-files.maxEditableBytes` (number, default 1 MiB).
- **Session log** — unchanged; user edits are not Session events.

## Design

- **`ui-code-editor` (new client package)** — owns the CodeMirror 6 composition behind a `FileEditor` interface (`mount`, `setText`, `getText`, `onChange`, `setReadOnly`, `focus`, `reveal(line, column)`, `dispose`), loaded lazily in its own chunk. It composes the CodeMirror `basicSetup` set, the VS Code key map, `@codemirror/search`, `@codemirror/autocomplete`, the language packages (and `@codemirror/legacy-modes` for shell, Dockerfile, TOML), indentation markers, and the MIT-licensed `@replit/codemirror-minimap`. Colors come from the client theme tokens, so light and dark themes match the rest of AnotherHarness. Hover, definition, and references are CodeMirror extensions that call the `navigate` Remote method.
- **Editor area** — the right sidebar's own tabs, splits, and fullscreen mode, with one tab per open file; a second tab system would duplicate them. Closing a dirty tab is vetoed through `ctx.sidebarRight.registerCloseGuard` and answered by a dialog in `shell.overlay`. Renames and deletes reach open tabs through the client event `workspace-file/moved` from the Files tree.
- **Draft model** — per open file `{ path, baseVersion, draft, dirty, conflict?, viewState }`, React-free and testable. The change feed drives conflicts: a different version while dirty sets `conflict`; while clean it reloads. Compare reuses the `DiffBlock` primitive in a side-by-side layout.
- **Host (`api/workspace-files`)** — new Remote methods reuse the existing file location checks, add containment through the same `confine` used by `list`, and call the filesystem seam with version guards. `FS_STALE_VERSION` maps to `workspace-file/conflict`. The README drops "no mutations" and documents the methods (EN/ZH).
- **Agent awareness** — the fs observation policy already records versions per agent; any user mutation changes the version, so the agent's next write refuses with `FS_STALE_VERSION` and re-reads.
- **Files tree (`ui-sidebar-files`)** — context menu and toolbar actions call the new methods; deletion uses the shared confirmation dialog.
- **Alternatives considered** — Monaco (VS Code parity but several megabytes, weak on mobile, hard to restyle); embedding openvscode-server (full VS Code, but a separate product inside AnotherHarness that writes to disk outside the version check); a `<textarea>` with a Shiki overlay (no real undo, find, or multi-cursor).

## Risks and mitigations

- New dependencies → CodeMirror 6 and the minimap are MIT-licensed, loaded lazily, recorded in third-party notices, and isolated behind `FileEditor`.
- Lost edits → version-guarded saves, drafts that survive conflicts and disk changes, close confirmation, and recoverable drafts after rename or delete.
- Destructive file operations → containment, version guards, confirmation naming the item, and no recursive delete without an explicit flag.
- Bundle size → the editor chunk loads on first Edit; read-only previews keep Shiki.
- Key conflicts with the app's shortcuts → editor bindings apply only while the editor has focus, through the existing shortcut regions.

## Rollout

Ships in the `web-app` composition with no flag; language intelligence activates when an LSP provider is configured. The user guide gets an "Edit code" page (EN/ZH), and the touched package READMEs document their new surfaces. No migration.

## Implementation plan

1. Host: `write` with containment, version guard, errors, and config; tests (AC-1, AC-2, AC-5, AC-6).
2. `ui-code-editor` package: CodeMirror composition, languages, VS Code keys, search and replace, folding, minimap, autocomplete, theme, `FileEditor` interface; tests (AC-8, AC-9, AC-13).
3. Draft model and in-place editing in the preview: dirty marker, save, conflict banner, Reload, Overwrite, Compare, close confirmation (AC-1 to AC-4, AC-7).
4. Full-screen editor area with tabs, Save all, and the status bar (AC-9, AC-10).
5. File operations: Host `create`/`rename`/`deleteEntry`, Files tree actions, tabs following renames (AC-6, AC-11).
6. Language intelligence through `navigate` (AC-12).
7. Docs, third-party notices, catalogs, gates. Each step lands as its own commit after the gates pass.

## Verification

| Criterion | Test | Verified |
| --- | --- | --- |
| AC-1 | api/workspace-files/tests/write.spec.ts, ui-code-editor/tests/drafts.client.spec.ts, files.client.spec.ts | ☑ |
| AC-2 | write.spec.ts, files.client.spec.ts, drafts.client.spec.ts | ☑ |
| AC-3 | drafts.client.spec.ts (reload, overwrite with the current version); Compare view not yet checked in a browser | ☐ |
| AC-4 | drafts.client.spec.ts | ☑ |
| AC-5 | write.spec.ts (stale version leaves the file unchanged; the agent refusal is the existing fs observation policy) | ☑ |
| AC-6 | write.spec.ts, file-operations.spec.ts | ☑ |
| AC-7 | ui-code-editor/tests/flows.client.spec.ts, apply.client.spec.tsx; ui-sidebar-right/tests/service.client.spec.ts | ☑ |
| AC-8 | CodeMirror VS Code key map composition; manual browser check pending | ☐ |
| AC-9 | languages.client.spec.ts; highlighting and minimap checked in the browser on a TOML file | ☑ |
| AC-10 | flows.client.spec.ts (Save all), drafts view state; tab switching not yet checked in a browser | ☐ |
| AC-11 | file-operations.spec.ts, ui-sidebar-files/tests/file-actions.client.spec.tsx, flows.client.spec.ts, apply.client.spec.tsx | ☑ |
| AC-12 | api/workspace-files/tests/navigate.spec.ts, flows.client.spec.ts; no language server in the default web app, so not checked in a browser | ☐ |
| AC-13 | CodeMirror word completion composition; manual browser check pending | ☐ |
