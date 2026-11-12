/**
 * File operations the tree offers: create a file or folder, rename, and
 * delete. Each call goes through the workspace-files Remote, which confines
 * the paths to the Session workspace and refuses symbolic links.
 */
import type { RemoteFailure, RemoteResult } from '@anotherharness/ah-api-remotes/client'
import type { WorkspaceFileStat } from '@anotherharness/ah-api-workspace-files/types'
import type { SessionId } from '@anotherharness/ah-session/types'

/** The slice of the Client Remote the operations call. */
export interface WorkspaceFilesMutationRemote {
  readonly workspaceFiles: {
    create(
      sessionId: SessionId, path: string, kind: 'file' | 'directory', content: string | undefined, signal?: AbortSignal,
    ): Promise<RemoteResult<WorkspaceFileStat>>
    rename(sessionId: SessionId, from: string, to: string, signal?: AbortSignal): Promise<RemoteResult<WorkspaceFileStat>>
    deleteEntry(
      sessionId: SessionId, path: string, recursive: boolean, signal?: AbortSignal,
    ): Promise<RemoteResult<{ readonly removed: true }>>
  }
}

/** Outcome of one operation: done, or the failure to show. */
export type FileOperationResult = { readonly ok: true } | { readonly ok: false; readonly failure: RemoteFailure }

/** File operations bound to one Remote. */
export interface FileOperations {
  /** @param sessionId - owning Session. @param path - absolute path. @param kind - file or folder. @returns the outcome. */
  readonly create: (sessionId: SessionId, path: string, kind: 'file' | 'directory') => Promise<FileOperationResult>
  /** @param sessionId - owning Session. @param from - absolute source. @param to - absolute destination. @returns the outcome. */
  readonly rename: (sessionId: SessionId, from: string, to: string) => Promise<FileOperationResult>
  /** @param sessionId - owning Session. @param path - absolute path. @param recursive - delete folder contents. @returns the outcome. */
  readonly remove: (sessionId: SessionId, path: string, recursive: boolean) => Promise<FileOperationResult>
}

const outcome = (result: RemoteResult<unknown>): FileOperationResult => result.ok ? { ok: true } : { ok: false, failure: result.error }

/**
 * Bind the operations to a Remote.
 * @param remote - the Client Remote carrying `workspaceFiles`.
 * @returns the bound operations.
 */
export function createFileOperations(remote: WorkspaceFilesMutationRemote): FileOperations {
  return {
    create: async (sessionId, path, kind) => outcome(await remote.workspaceFiles.create(sessionId, path, kind, undefined)),
    rename: async (sessionId, from, to) => outcome(await remote.workspaceFiles.rename(sessionId, from, to)),
    remove: async (sessionId, path, recursive) => outcome(await remote.workspaceFiles.deleteEntry(sessionId, path, recursive)),
  }
}

/**
 * Check a name typed for a new or renamed entry.
 * @param name - the typed name.
 * @returns the trimmed name, or undefined when it is empty, `.`/`..`, or holds a path separator other than `/`.
 */
export function validEntryName(name: string): string | undefined {
  const trimmed = name.trim()
  if (trimmed === '' || trimmed.includes('\\') || trimmed.startsWith('/') || trimmed.endsWith('/')) return undefined
  if (trimmed.split('/').some(segment => segment === '' || segment === '.' || segment === '..')) return undefined
  return trimmed
}

/**
 * Join a directory and a typed relative name, keeping the directory's separator style.
 * @param directory - absolute directory path.
 * @param name - validated name, possibly with `/` for nested folders.
 * @returns the absolute path.
 */
export function joinEntry(directory: string, name: string): string {
  const separator = directory.includes('\\') && !directory.includes('/') ? '\\' : '/'
  const base = directory.endsWith(separator) ? directory : `${directory}${separator}`
  return base + name.split('/').join(separator)
}

/**
 * The directory holding an absolute path.
 * @param path - absolute path.
 * @returns its parent directory.
 */
export function parentOf(path: string): string {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return index <= 0 ? path.slice(0, index + 1) : path.slice(0, index)
}

/**
 * The last segment of an absolute path.
 * @param path - absolute path.
 * @returns its name.
 */
export function nameOf(path: string): string {
  return path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1)
}
