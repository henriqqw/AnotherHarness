/**
 * Browser half: register the code editor as a document preview renderer.
 *
 * The editor joins the product's own viewers in the `builtin` band and
 * registers after them, so the read-only code preview and the rendered
 * viewers (Markdown, HTML, Spreadsheet) stay the default and the editor is
 * offered as **Editor** in the viewer menu. Files no other viewer claims,
 * such as `.gitignore`, open in the editor. It starts read-only until the
 * user presses Edit. Every import from another client plugin is a type.
 *
 * The right sidebar's own tabs, splits, and fullscreen mode are the editor
 * area: each open file is a tab. Closing a tab with unsaved changes asks
 * first through a dialog in the shell overlay, and tabs follow renames and
 * deletes from the Files tree.
 */
import type { Context as ClientContext } from '@anotherharness/cordis'
import type {} from '@anotherharness/ah-api-remotes/client'
import type {} from '@anotherharness/ah-api-workspace-files/remote'
import type {} from '@anotherharness/ah-api-gateway/client'
import type {} from '@anotherharness/ah-client-locale/client'
import type {} from '@anotherharness/ah-client-ui-renderer/client'
import type {} from '@anotherharness/ah-client-ui-sidebar-documentpreview/client'
import type {} from '@anotherharness/ah-client-ui-sidebar-files/client'
import type {} from '@anotherharness/ah-client-ui-sidebar-right/client'
import type {} from '@anotherharness/ah-client-ui-layout/client'
import type { TabId } from '@anotherharness/ah-client-ui-dockkit'
import type { SessionId } from '@anotherharness/ah-session/types'
import { CODE_HIGHLIGHT_EXTENSIONS } from '@anotherharness/ah-client-ui-primitives'
import { createCloseFlow } from './close-prompt.ts'
import { ClosePrompt, type ClosePromptInjected } from './ClosePrompt.tsx'
import { DraftStore } from './drafts.ts'
import { createEditorFiles } from './files.ts'
import { followMove } from './follow-moves.ts'
import type { EditorBodyInjected } from './EditorBody.tsx'
import { LazyEditorBody } from './LazyEditorBody.tsx'
import { en, NS, zh } from './locales.ts'

export type { CodeEditorKey } from './locales.ts'
export type { EditorBodyInjected, EditorBodyProps } from './EditorBody.tsx'
export type { DraftConflict, DiskChangeOutcome, EditorViewState, FileDraft } from './drafts.ts'
export type { EditorFiles, EditorNavigation, EditorReadResult, EditorRemote, EditorSaveResult } from './files.ts'
export type {
  EditorCursorInfo, EditorNavigationHooks, EditorPosition, EditorViewSnapshot, FileEditor, FileEditorOptions,
} from './file-editor.ts'
export type { EditorTarget } from './navigation.ts'
export type { CloseChoice, CloseFlow, ClosePromptState, CloseRequest, GuardedTab } from './close-prompt.ts'
export type { ClosePromptInjected, ClosePromptProps } from './ClosePrompt.tsx'
export type { MoveEffects, OpenTab } from './follow-moves.ts'
export type { EditorLanguage } from './languages.ts'
export type { EditableText, LineEnding } from './text-codec.ts'

/** Identity of the editor renderer. */
export const CODE_EDITOR_ID = '@anotherharness/ah-client-ui-code-editor'

/** Suffixes the editor is offered for: every highlighted language, rendered formats, and common text files. */
export const EDITOR_SUFFIXES: readonly string[] = [...new Set([
  ...CODE_HIGHLIGHT_EXTENSIONS,
  'md', 'markdown', 'mdx', 'html', 'htm', 'xhtml', 'csv', 'ipynb', 'svg',
  'txt', 'text', 'gitignore', 'dockerignore', 'editorconfig', 'npmrc', 'nvmrc', 'lock',
])]

/** The right-sidebar tab kind that file previews open as. */
export const DOCUMENT_TAB_KIND = 'text'

/** Required services: slots, copy, the document preview registry, the right sidebar, and the workspace Remote. */
export const inject = ['slots', 'locale', 'documentPreviews', 'sidebarRight', 'remote', 'remote.workspaceFiles']

/**
 * Client plugin body.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const drafts = new DraftStore()
  const files = createEditorFiles(ctx.remote)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-code-editor: dictionaries')
  const t = ctx.locale.bind(NS)
  // Same band as the product's viewers and registered after them: ties go to the earlier one.
  ctx.effect(() => ctx.documentPreviews.register({
    id: CODE_EDITOR_ID, extensions: EDITOR_SUFFIXES, priority: 'builtin', title: () => t('title'), loading: 'renderer', wrap: true,
  }), 'ui-code-editor: renderer')
  const sidebar = ctx.sidebarRight
  const close = (sessionId: string, tabId: string): void => { sidebar.closeIn(sessionId as SessionId, tabId as TabId) }
  const flow = createCloseFlow(drafts, files, close)
  ctx.effect(() => sidebar.registerCloseGuard(DOCUMENT_TAB_KIND, flow.guard), 'ui-code-editor: close guard')
  const promptInjected = (): ClosePromptInjected => ({ flow })
  ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    { name: 'shell.overlay', id: 'codeEditor.close-prompt', locale: NS, inject: promptInjected }, ClosePrompt,
  )), 'ui-code-editor: close prompt')
  ctx.effect(() => ctx.on('workspace-file/moved', (sessionId, from, to) => {
    followMove(drafts, {
      tabs: () => sidebar.openTabs.getSnapshot(),
      close,
      replace: (address, tabId) => { sidebar.openResource(address, { replaceTab: tabId as TabId }) },
    }, sessionId, from, to)
  }), 'ui-code-editor: follow moves')
  const openAt: EditorBodyInjected['openAt'] = (target) => {
    drafts.setView(target.address, { kind: 'reveal', line: target.line, column: target.column })
    sidebar.openResource(target.address)
  }
  const inject = (): EditorBodyInjected => ({ drafts, files, openAt })
  ctx.effect(() => ctx.slots.inject('sidebar.right.tab.document', () => ctx.slots.register(
    { name: 'sidebar.right.tab.document', key: CODE_EDITOR_ID, locale: NS, inject }, LazyEditorBody,
  )), 'ui-code-editor: body')
  // Leaving the page with unsaved drafts asks first, like VS Code.
  // Browsers show their own wording; preventDefault alone asks for confirmation.
  const beforeUnload = (event: BeforeUnloadEvent): void => {
    if (drafts.dirty().length > 0) event.preventDefault()
  }
  ctx.effect(() => {
    globalThis.addEventListener('beforeunload', beforeUnload)
    return () => { globalThis.removeEventListener('beforeunload', beforeUnload) }
  }, 'ui-code-editor: unsaved guard')
}
