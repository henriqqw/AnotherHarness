/**
 * Source-control decorations for the tree, like VS Code's: each changed file
 * gets its state letter and color, and each folder above it takes the color
 * of its most significant change. Pure functions over the Host's status.
 */
import type { RemoteResult } from '@anotherharness/ah-api-remotes/client'
import type { WorkspaceGitFileState, WorkspaceGitStatus } from '@anotherharness/ah-api-workspace-files/types'
import type { SessionId } from '@anotherharness/ah-session/types'

/** The slice of the Client Remote the decorations read. */
export interface WorkspaceGitStatusRemote {
  readonly workspaceFiles: {
    gitStatus(sessionId: SessionId, signal?: AbortSignal): Promise<RemoteResult<WorkspaceGitStatus>>
  }
}

/** Decorations for one tree. */
export interface GitDecorations {
  /** Whether the workspace is in a git repository. */
  readonly repository: boolean
  /** Whether the Host cut the list. */
  readonly truncated: boolean
  /** Changed files under the root, by slash-separated absolute path, in path order. */
  readonly changes: readonly { readonly path: string; readonly state: WorkspaceGitFileState }[]
  /** State by slash-separated file path. */
  readonly files: ReadonlyMap<string, WorkspaceGitFileState>
  /** Most significant state below each folder, by slash-separated folder path. */
  readonly folders: ReadonlyMap<string, WorkspaceGitFileState>
}

/** The letter VS Code shows for each state. */
export const GIT_LETTERS: Readonly<Record<WorkspaceGitFileState, string>> = {
  modified: 'M', added: 'A', deleted: 'D', untracked: 'U', conflicted: 'C',
}

/** Which state a folder shows when it holds several: the higher wins. */
const RANK: Readonly<Record<WorkspaceGitFileState, number>> = { untracked: 1, added: 2, deleted: 3, modified: 4, conflicted: 5 }

/** No decorations: outside a repository, or before the first answer. */
export const NO_DECORATIONS: GitDecorations = { repository: false, truncated: false, changes: [], files: new Map(), folders: new Map() }

/**
 * Normalize a tree or Host path for lookups.
 * @param path - an absolute path with either separator.
 * @returns the path with `/` separators and no trailing slash.
 */
export function slashPath(path: string): string {
  const slashed = path.replace(/\\/g, '/')
  return slashed.length > 1 ? slashed.replace(/\/+$/, '') : slashed
}

/**
 * Build the tree's decorations from the Host's status.
 * @param status - the Host's answer.
 * @param root - the tree's root directory.
 * @returns files and folders under the root, decorated.
 */
export function decorate(status: WorkspaceGitStatus, root: string): GitDecorations {
  const base = slashPath(root)
  const prefix = base === '/' ? '/' : `${base}/`
  const files = new Map<string, WorkspaceGitFileState>()
  const folders = new Map<string, WorkspaceGitFileState>()
  for (const entry of status.entries) {
    const path = slashPath(entry.absolutePath)
    if (!path.startsWith(prefix)) continue
    files.set(path, entry.state)
    for (let folder = path.slice(0, path.lastIndexOf('/')); folder.length >= base.length; folder = folder.slice(0, folder.lastIndexOf('/'))) {
      const held = folders.get(folder)
      if (held === undefined || RANK[entry.state] > RANK[held]) folders.set(folder, entry.state)
      if (folder === base) break
    }
  }
  const changes = [...files].map(([path, state]) => ({ path, state })).sort((left, right) => left.path.localeCompare(right.path))
  return { repository: status.repository, truncated: status.truncated, changes, files, folders }
}

/**
 * Read the decorations for a Session's tree.
 * @param remote - the Client Remote.
 * @param sessionId - the Session.
 * @param root - the tree's root.
 * @param signal - cancellation.
 * @returns the decorations; a failed read decorates nothing.
 */
export async function readDecorations(
  remote: WorkspaceGitStatusRemote, sessionId: SessionId, root: string, signal?: AbortSignal,
): Promise<GitDecorations> {
  const result = await remote.workspaceFiles.gitStatus(sessionId, signal)
  return result.ok ? decorate(result.value, root) : NO_DECORATIONS
}
