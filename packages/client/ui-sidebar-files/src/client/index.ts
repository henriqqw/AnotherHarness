/**
 * Browser half: register `files` as a right-Sidebar tab type.
 *
 * The public two-stage path, unmodified: the type into `ctx.sidebarRightTabs`,
 * the body into the keyed `sidebar.right.pane.tab` seat and the chip title into
 * the keyed `sidebar.right.pane.tab.title` seat, both under the type's `id`.
 *
 * The file split is this package's layering: what the type IS
 * (`definition.tsx`), what it keeps (`store.ts`), how it lists (`face.ts`), what
 * it draws (`FilesBody.tsx`, `FilesTitle.tsx`), what it says (`locales.ts`),
 * and this module, which only wires them together.
 */
import type { ShortcutCommandId } from '@anotherharness/ah-client-shortcuts/client'
import type { Context as ClientContext } from '@anotherharness/cordis'
import type {} from '@anotherharness/ah-api-remotes/client'
import type {} from '@anotherharness/ah-api-session-controller/client'
import type {} from '@anotherharness/ah-client-ui-renderer/client'
import type {} from '@anotherharness/ah-client-ui-session/client'
import type {} from '@anotherharness/ah-client-ui-sidebar-right/client'
import { FILES_ID, filesDefinition } from './definition.tsx'
import { createList, createWatch, filesFace } from './face.ts'
import { createFileOperations } from './operations.ts'
import { readDecorations } from './git-status.ts'
import { createFileReveal } from './reveal.ts'
import type { FileActionsInjected } from './FilesBody.tsx'
import { FilesBody } from './FilesBody.tsx'
import { FilesTitle } from './FilesTitle.tsx'
import { en, zh } from './locales.ts'
import { createFilesStore } from './store.ts'

export type { SidebarFilesKey } from './locales.ts'
export type { DirLevel, FilesState, FilesTabState, LevelState } from './store.ts'
export type { FilesInjected, ListWorkspaceDirectory, WorkspaceFilesListRemote } from './face.ts'
export type { FileActionsInjected, FilesBodyProps } from './FilesBody.tsx'
export type { FileOperationResult, FileOperations, WorkspaceFilesMutationRemote } from './operations.ts'
export type { GitDecorations, WorkspaceGitStatusRemote } from './git-status.ts'
export type { FileReveal, WorkspaceRevealRemote } from './reveal.ts'
export type { ActionTarget, FileDialog, FileMenu } from './FileActions.tsx'

declare module '@anotherharness/cordis' {
  interface Events {
    /**
     * The Files tree renamed or deleted an entry. Open views of the entry, or of
     * anything under it when it is a folder, follow the move or close.
     * @param sessionId - the Session whose workspace changed.
     * @param from - the entry's file address before the change.
     * @param to - its file address after a rename; `undefined` after a delete.
     * @mode emit
     */
    'workspace-file/moved'(sessionId: string, from: string, to: string | undefined): void
  }
}

declare module '@anotherharness/ah-client-ui-slots' {
  interface SlotMap {
    /** Workspace directory actions after the file tree's reload control. */
    'sidebar.right.tab.files.actions': {
      kind: 'list'
      scope: 'session'
      owner: {
        /** Absolute directory path displayed by the file tree. */
        readonly absolutePath: string
      }
    }
  }
}

/** This package's copy namespace. */
const NS = 'sidebarFiles'

/**
 * Required browser services: the tab registry, the keyed seat, the Remote
 * carrier and its namespace, and copy.
 */
export const inject = ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight', 'remote', 'remote.workspaceFiles', 'remote.session']

/**
 * Client plugin body: register the type, its dictionaries, its body, and its chip title.
 * @param ctx - client root context carrying the registry, the slots, and the Remote face.
 */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  ctx.inject(['shortcuts'], (ctx) => {
    ctx.effect(() => ctx.shortcuts.register({
      id: 'workspace.files' as ShortcutCommandId, label: () => t('guide.title'), aliases: ['workspace files', 'files'],
      defaults: {
        'desktop:macos': { code: 'KeyP', modifiers: ['primary'] },
        'desktop:windows': { code: 'KeyP', modifiers: ['primary'] },
        'desktop:linux': { code: 'KeyP', modifiers: ['primary'] },
        'web:macos': { code: 'KeyP', modifiers: ['primary', 'alt'] },
        'web:windows': { code: 'KeyP', modifiers: ['primary', 'alt'] },
      },
      // Each tab plugin owns its command's availability, localized refusal, and tab kind.
      /* jscpd:ignore-start */
      regions: ['page', 'editable', 'terminal'], modals: [],
      resolve: ({ target: element }) => {
        const target = ctx.sidebarRight.commandTarget(element)
        if (target === undefined) return { status: 'blocked', reason: t('shortcut.noSession') }
        return { status: 'handled', run: () => { ctx.sidebarRight.openTabFromTarget('files', target) } }
      },
      /* jscpd:ignore-end */
    }), 'ui-sidebar-files: shortcut')
  })
  ctx.effect(() => ctx.sidebarRightTabs.register(filesDefinition(t)), 'ui-sidebar-files: files type')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-sidebar-files: dictionaries')

  const store = createFilesStore()
  const face = filesFace(createList(ctx.remote), createWatch(ctx.remote))
  const operations = createFileOperations(ctx.remote)
  const announceMove = (sessionId: string, from: string, to: string | undefined): void => {
    ctx.emit('workspace-file/moved', sessionId, from, to)
  }
  const reveal = createFileReveal(ctx.remote)
  const sourceControl: FileActionsInjected['sourceControl'] = (sessionId, root, signal) => readDecorations(ctx.remote, sessionId, root, signal)
  const inject: (...args: Parameters<typeof face>) => ReturnType<typeof face> & FileActionsInjected =
    (...args) => ({ ...face(...args), operations, announceMove, sourceControl, reveal })
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    {
      name: 'sidebar.right.pane.tab', key: FILES_ID, locale: NS, store, inject,
      children: { 'sidebar.right.tab.files.actions': { kind: 'list', scope: 'session' } },
    },
    FilesBody,
  )), 'ui-sidebar-files: files tab body')
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab.title', key: FILES_ID },
    FilesTitle,
  )), 'ui-sidebar-files: files tab title')
}
