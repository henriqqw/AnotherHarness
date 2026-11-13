/**
 * Show a file in the operating system's file manager (Explorer, Finder) on
 * the Host, through the Session Remote's reveal, which selects the file.
 */
import type { RemoteResult } from '@anotherharness/ah-api-remotes/client'

/** The slice of the Session Remote the reveal calls. */
export interface WorkspaceRevealRemote {
  readonly session: {
    /** Whether the Host can hand a path to a desktop file manager. */
    canOpenWorkspacePath(): Promise<RemoteResult<boolean>>
    /** Reveal one absolute Host path in the file manager. */
    openWorkspacePath(request: { readonly path: string; readonly action: 'reveal' }): Promise<RemoteResult<unknown>>
  }
}

/** File-manager reveal bound to one Remote. */
export interface FileReveal {
  /** @returns whether the Host has a desktop file manager; asked once per page. */
  readonly available: () => Promise<boolean>
  /** @param path - absolute Host path. @returns whether the Host showed it. */
  readonly reveal: (path: string) => Promise<boolean>
}

/**
 * Bind the reveal to a Remote.
 * @param remote - the Client Remote carrying `session`.
 * @returns the reveal face.
 */
export function createFileReveal(remote: WorkspaceRevealRemote): FileReveal {
  let available: Promise<boolean> | undefined
  return {
    available: () => {
      available ??= remote.session.canOpenWorkspacePath().then(result => result.ok && result.value, () => false)
      return available
    },
    reveal: async (path) => {
      try {
        return (await remote.session.openWorkspacePath({ path, action: 'reveal' })).ok
      } catch {
        // An unreachable Host failed the gesture like a refusing one.
        return false
      }
    },
  }
}
