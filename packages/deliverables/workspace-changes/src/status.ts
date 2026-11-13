/**
 * The working tree's current git status, for source-control decorations in
 * file trees: which files are modified, added, deleted, untracked, or in
 * conflict compared with HEAD and the index. Ignored files are left out.
 */
import { resolve } from 'node:path'
import type { GitRunner } from './git.ts'
import { toPosix } from './paths.ts'

/** One file's working-tree state, as source-control views letter it (M, A, D, U, C). */
export type GitFileState = 'modified' | 'added' | 'deleted' | 'untracked' | 'conflicted'

/** One changed file. */
export interface GitStatusEntry {
  /** Absolute, slash-separated path of the file. */
  absolutePath: string
  /** Its state. */
  state: GitFileState
}

/** The status of the repository enclosing a directory. */
export interface GitStatus {
  /** Whether the directory is inside a git repository; false yields no entries. */
  repository: boolean
  /** Changed files in git's order, capped at `limit`. */
  entries: GitStatusEntry[]
  /** True when more files changed than `limit`. */
  truncated: boolean
}

/** The empty status of a directory outside any repository. */
const NO_REPOSITORY: GitStatus = { repository: false, entries: [], truncated: false }

/**
 * Classify one porcelain v1 `XY` code.
 * @param code - the two status letters.
 * @returns the file state.
 */
export function stateOf(code: string): GitFileState {
  if (code === '??') return 'untracked'
  if (code.includes('U') || code === 'AA' || code === 'DD') return 'conflicted'
  if (code.includes('D')) return 'deleted'
  if (code[0] === 'A') return 'added'
  return 'modified'
}

/**
 * Parse `git status --porcelain=v1 -z --no-renames` output.
 * @param stdout - NUL-separated records `XY path`.
 * @param root - repository top level the paths are relative to.
 * @param limit - most entries to keep.
 * @returns the entries and whether any were dropped.
 */
export function parsePorcelain(stdout: string, root: string, limit: number): { entries: GitStatusEntry[]; truncated: boolean } {
  const records = stdout.split('\0').filter(record => record.length > 3)
  const entries = records.slice(0, limit).map(record => ({
    absolutePath: toPosix(resolve(root, record.slice(3))),
    state: stateOf(record.slice(0, 2)),
  }))
  return { entries, truncated: records.length > limit }
}

/**
 * Read the working-tree status of the repository enclosing a directory.
 * @param git - command runner.
 * @param cwd - absolute directory inside the repository.
 * @param limit - most entries to return.
 * @param signal - cancellation.
 * @returns the status; a directory outside any repository yields `repository: false`.
 * @throws when git fails for another reason.
 */
export async function readGitStatus(git: GitRunner, cwd: string, limit: number, signal: AbortSignal): Promise<GitStatus> {
  const top = await git.run(['rev-parse', '--show-toplevel'], { cwd, signal })
  if (top.exitCode === 128 && /not a git repository/i.test(top.stderr)) return NO_REPOSITORY
  if (top.exitCode !== 0) throw new Error(`git rev-parse failed: ${top.stderr.trim()}`)
  const root = resolve(cwd, top.stdout.trim())
  const status = await git.run(['status', '--porcelain=v1', '-z', '--no-renames', '--untracked-files=all'], { cwd, signal })
  if (status.exitCode !== 0) throw new Error(`git status failed: ${status.stderr.trim()}`)
  const parsed = parsePorcelain(status.stdout, root, limit)
  return { repository: true, entries: parsed.entries, truncated: parsed.truncated || status.truncated }
}
