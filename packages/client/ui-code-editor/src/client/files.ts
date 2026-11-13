/**
 * The editor's file face: read a whole file for editing and save it with the
 * version it was loaded at. Views get these functions injected, so they never
 * hold the Remote client.
 */
import type { RemoteResult } from '@anotherharness/ah-api-remotes/client'
import type {
  WorkspaceFileBytes, WorkspaceFileStat, WorkspaceNavigation, WorkspaceNavigationOperation, WorkspaceNavigationPosition,
} from '@anotherharness/ah-api-workspace-files/types'
import type { SessionId } from '@anotherharness/ah-session/types'
import { parseFileAddress } from '@anotherharness/ah-util-workspace-path'
import { decodeEditable, encodeEditable, type DecodeRefusal, type EditableText } from './text-codec.ts'
import type { DraftStore, FileDraft } from './drafts.ts'
import { targetsOf, workspaceRootOf, type EditorTarget } from './navigation.ts'
import type { WorkspaceNavigationLocation } from '@anotherharness/ah-api-workspace-files/types'

/** Largest file the editor opens, matching the Host's default save cap; larger files stay in the read-only viewers. */
export const MAX_EDITABLE_BYTES = 1024 * 1024

/** The slice of the Client Remote the editor calls. */
export interface EditorRemote {
  readonly workspaceFiles: {
    readBytes(
      sessionId: SessionId, path: string, options: Record<string, never>, signal?: AbortSignal,
    ): Promise<RemoteResult<WorkspaceFileBytes>>
    write(
      sessionId: SessionId, path: string, content: string, expectedVersion: string, signal?: AbortSignal,
    ): Promise<RemoteResult<WorkspaceFileStat>>
    navigate(
      sessionId: SessionId, path: string, position: WorkspaceNavigationPosition, operation: WorkspaceNavigationOperation,
      signal?: AbortSignal,
    ): Promise<RemoteResult<WorkspaceNavigation>>
  }
}

/** What a language-server query found, or that no server handles the file. */
export type EditorNavigation =
  | WorkspaceNavigation
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'failed'; readonly message: string }

/** A file read for editing. */
export type EditorReadResult =
  | { readonly kind: 'text'; readonly text: EditableText; readonly version: string; readonly absolutePath: string }
  | { readonly kind: 'refused'; readonly reason: DecodeRefusal }
  | { readonly kind: 'failed'; readonly message: string }

/** How a save ended. */
export type EditorSaveResult =
  | { readonly kind: 'saved'; readonly version: string }
  | { readonly kind: 'conflict'; readonly version: string | undefined }
  | { readonly kind: 'failed'; readonly message: string }

/** File operations bound to one Remote. */
export interface EditorFiles {
  /** @param address - file resource address. @returns the workspace path it names. */
  pathOf(address: string): string
  /** @param address - file resource address. @returns the Session it belongs to. */
  sessionOf(address: string): string
  /**
   * The workspace root a read file implies.
   * @param address - the file address read.
   * @param absolutePath - the absolute path the read reported.
   * @returns the root, when the address carries a workspace-relative path.
   */
  rootOf(address: string, absolutePath: string): string | undefined
  /**
   * Language-server locations as editor targets in the file's Session.
   * @param address - the file the query ran on.
   * @param root - its workspace root, when known.
   * @param locations - the locations found.
   * @returns one target per location.
   */
  targetsOf(address: string, root: string | undefined, locations: readonly WorkspaceNavigationLocation[]): EditorTarget[]
  /** @param address - file resource address. @param signal - cancellation. @returns the decoded file or why it cannot be edited. */
  read(address: string, signal: AbortSignal): Promise<EditorReadResult>
  /**
   * Save a draft, guarded by its base version, and record the outcome in the store.
   * @param drafts - the draft store to update.
   * @param draft - the draft to save.
   * @param expectedVersion - the version to guard against; defaults to the draft's base.
   * @returns how the save ended.
   */
  save(drafts: DraftStore, draft: FileDraft, expectedVersion?: string): Promise<EditorSaveResult>
  /**
   * Save every dirty draft that is not waiting on a conflict.
   * @param drafts - the draft store.
   * @returns each save's outcome, in draft order.
   */
  saveAll(drafts: DraftStore): Promise<readonly EditorSaveResult[]>
  /**
   * Ask the language server about a position.
   * @param address - file resource address.
   * @param position - zero-based line and UTF-16 column.
   * @param operation - hover, goToDefinition, or findReferences.
   * @param signal - cancellation.
   * @returns what it found, or that no server handles the file.
   */
  navigate(
    address: string, position: WorkspaceNavigationPosition, operation: WorkspaceNavigationOperation, signal: AbortSignal,
  ): Promise<EditorNavigation>
}

/**
 * The Session and path a session file address names.
 * @param address - an `ah-resource://file/session/…` address.
 * @returns the Session id and path.
 */
export function sessionFileOf(address: string): { readonly sessionId: SessionId; readonly path: string } {
  const parsed = parseFileAddress(address)
  if (parsed?.scope !== 'session') throw new Error(`ui-code-editor: not a session file address "${address}"`)
  // The address is a string boundary: its id segment is the Session id it names.
  return { sessionId: parsed.sessionId as SessionId, path: parsed.path }
}

/**
 * Bind the editor's file operations to a Remote.
 * @param remote - the Client Remote carrying `workspaceFiles`.
 * @returns the editor's file face.
 */
export function createEditorFiles(remote: EditorRemote): EditorFiles {
  const save: EditorFiles['save'] = async (drafts, draft, expectedVersion = draft.baseVersion) => {
    const file = sessionFileOf(draft.address)
    const text = draft.text
    drafts.saving(draft.address)
    const result = await remote.workspaceFiles.write(
      file.sessionId, file.path, encodeEditable(text, draft), expectedVersion,
    )
    if (result.ok) {
      drafts.saved(draft.address, text, result.value.version)
      return { kind: 'saved', version: result.value.version }
    }
    const { error } = result
    if (error.code === 'workspace-file/conflict') {
      drafts.conflicted(draft.address, error.details.currentVersion)
      return { kind: 'conflict', version: error.details.currentVersion }
    }
    drafts.failed(draft.address, error.message)
    return { kind: 'failed', message: error.message }
  }
  return {
    pathOf: address => sessionFileOf(address).path,
    sessionOf: address => sessionFileOf(address).sessionId,
    rootOf: (address, absolutePath) => workspaceRootOf(absolutePath, sessionFileOf(address).path),
    targetsOf: (address, root, locations) => targetsOf(sessionFileOf(address).sessionId, root, locations),
    save,
    async saveAll(drafts) {
      const results: EditorSaveResult[] = []
      for (const draft of drafts.dirty()) {
        if (!draft.saving && draft.conflict === undefined) results.push(await save(drafts, draft))
      }
      return results
    },
    async navigate(address, position, operation, signal) {
      const file = sessionFileOf(address)
      const result = await remote.workspaceFiles.navigate(file.sessionId, file.path, position, operation, signal)
      if (result.ok) return result.value
      if (result.error.code === 'workspace-file/no-language-server') return { kind: 'unavailable' }
      return { kind: 'failed', message: result.error.message }
    },
    async read(address, signal) {
      const file = sessionFileOf(address)
      const result = await remote.workspaceFiles.readBytes(file.sessionId, file.path, {}, signal)
      if (!result.ok) return { kind: 'failed', message: result.error.message }
      if (result.value.data.length > MAX_EDITABLE_BYTES) return { kind: 'refused', reason: 'too-large' }
      const decoded = decodeEditable(result.value.data)
      if (typeof decoded === 'string') return { kind: 'refused', reason: decoded }
      return { kind: 'text', text: decoded, version: result.value.version, absolutePath: result.value.absolutePath }
    },
  }
}
