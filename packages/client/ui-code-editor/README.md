---
description: "CodeMirror 6 code editor for workspace files in the ah web client: edit and save from the right-Sidebar preview with VS Code keys, version-guarded saves, conflict handling, and language-server navigation."
kind: "package-reference"
---

# @anotherharness/ah-client-ui-code-editor

English | [中文](README.zh.md)

## Summary

Edit workspace files in the right Sidebar. Source files open in a CodeMirror 6 editor, read-only until **Edit**; saves are guarded by the version the editor loaded, so neither the user nor the agent overwrites the other's change unseen. The Sidebar's tabs and fullscreen mode are the editor area.

## Table of Contents

- [What it registers](#what-it-registers)
- [Editing and saving](#editing-and-saving)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="what-it-registers"></a>
## What it registers

- **Two document renderers** on [`ctx.documentPreviews`](../ui-sidebar-documentpreview/README.md): `@anotherharness/ah-client-ui-code-editor` in the `extension` band for source and text files, so it opens by default and the read-only code preview stays in the viewer menu as **Code**; and `…/alternative` in the `builtin` band for files with a rendered view (Markdown, HTML, CSV, notebooks, SVG), where the rendered view stays the default and **Editor** is offered beside it. Files above 1 MiB are refused with a pointer to **Code**. Both load the renderer lazily: CodeMirror and its grammars arrive in the `client.EditorBody.js` chunk on first open.
- **A close guard** for the `text` tab kind through `ctx.sidebarRight.registerCloseGuard`: closing a tab whose file has unsaved changes keeps the tab and opens the Save / Don't save / Cancel dialog, registered in `shell.overlay` under `codeEditor.close-prompt`.
- **A listener** for `workspace-file/moved`, emitted by [`ui-sidebar-files`](../ui-sidebar-files/README.md): drafts move to the new address and tabs reopen there after a rename; tabs close after a delete, asking first when they hold unsaved changes.
- **A `beforeunload` guard** while any draft is unsaved.
- **Copy** in the `codeEditor` locale namespace (zh, en).

Source files under `src/client/`: `drafts.ts` (per-file drafts and view state, React-free), `files.ts` (reads, saves, Save all, and `navigate` over the [`workspaceFiles` Remote](../../api/workspace-files/README.md)), `text-codec.ts` (UTF-8, BOM, and line endings), `close-prompt.ts` and `ClosePrompt.tsx` (the close flow), `follow-moves.ts`, `navigation.ts` (language-server targets), `file-editor.ts` (the CodeMirror composition behind `FileEditor`), `languages.ts`, `EditorBody.tsx`, `CompareView.tsx`, and `index.ts` (the wiring).

<a id="editing-and-saving"></a>
## Editing and saving

The editor composes CodeMirror's `basicSetup`, the VS Code key map, search and replace, word completion, indentation guides, the minimap (from 520px wide), and about thirty language modes. Colors come from the client theme tokens. The status bar shows cursor, selection, and cursor count, and switches indentation, line endings, language, and whitespace rendering.

A draft is keyed by file address and outlives its tab: switching tabs restores text, selection, and scroll offset. Saving sends the whole text with the draft's base version to `workspaceFiles.write`; a `workspace-file/conflict` keeps the draft and shows a banner with Reload, Compare (side by side through `@codemirror/merge`), and Overwrite. The change feed reloads clean drafts silently and marks dirty ones as conflicted. Line endings and a byte order mark are restored on save. Ctrl/Cmd+Alt+S saves every dirty draft that is not in conflict.

With a language server mounted on `ctx.lsp`, hover, F12 or Ctrl/Cmd+Click, and Shift+F12 call `workspaceFiles.navigate`. One definition opens directly at its line; several, and every reference list, appear in a panel under the editor. The first `workspace-file/no-language-server` answer turns these actions off for that view. Multi-cursor clicks use Alt+Click, as in VS Code.

<a id="model-experience"></a>
## Model Experience

None, as this package edits files in the browser and registers nothing model-facing. An agent that read a file the user then saved gets the existing stale-version refusal on its next write and re-reads the file.

#### KV Cache effect

None; editor traffic travels over the Remote and assembles no model request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>
- **Text only.** Binary files, non-UTF-8 text, and files above `workspace-files.maxEditableBytes` open with a refusal line.
- **No language-server completion or diagnostics.** The `ctx.lsp` seam offers hover and navigation only; completion uses words in the file.
- **Coverage of the view.** `EditorBody.tsx`, `CompareView.tsx`, and `file-editor.ts` need a browser layout engine and are exempt from per-file coverage; their logic lives in the covered modules.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The lazy chunk must import only types from the rest of the package, apart from its own modules, or the bundler emits a shared chunk the plugin loader cannot load. Helpers the view needs at runtime go through the injected `files` face.

</details>
