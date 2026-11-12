/**
 * Language-server results as editor targets: which file address to open, and
 * where. Pure helpers, so the views stay thin.
 */
import type { WorkspaceNavigationLocation } from '@anotherharness/ah-api-workspace-files/types'
import { fileAddressFor } from '@anotherharness/ah-util-workspace-path'

/** One place to open: a file address and a 1-based line and column. */
export interface EditorTarget {
  readonly address: string
  readonly line: number
  readonly column: number
  /** Workspace-relative path, or the absolute path outside the workspace. */
  readonly label: string
}

const slashes = (path: string): string => path.replace(/\\/g, '/')

/**
 * The workspace root a file's absolute path implies, given its workspace-relative path.
 * @param absolutePath - the file's absolute path.
 * @param relativePath - the path its session address carries.
 * @returns the root, or `undefined` when the address carries an absolute path or the two disagree.
 */
export function workspaceRootOf(absolutePath: string, relativePath: string): string | undefined {
  const absolute = slashes(absolutePath)
  const relative = slashes(relativePath)
  if (relative === '' || relative.startsWith('/') || /^[a-z]:/i.test(relative)) return undefined
  return absolute.endsWith(`/${relative}`) ? absolute.slice(0, absolute.length - relative.length - 1) : undefined
}

/**
 * Turn language-server locations into editor targets.
 * @param sessionId - the Session the files belong to.
 * @param root - the workspace root, when known.
 * @param locations - zero-based locations with absolute paths.
 * @returns one target per location.
 */
export function targetsOf(sessionId: string, root: string | undefined, locations: readonly WorkspaceNavigationLocation[]): EditorTarget[] {
  const base = root === undefined ? undefined : slashes(root).replace(/\/+$/, '')
  return locations.map((location) => {
    const absolute = slashes(location.absolutePath)
    const label = base !== undefined && absolute.startsWith(`${base}/`) ? absolute.slice(base.length + 1) : absolute
    return {
      address: fileAddressFor(sessionId, root, location.absolutePath),
      line: location.start.line + 1,
      column: location.start.character + 1,
      label,
    }
  })
}
