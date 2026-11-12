/**
 * Workspace file service: read-only file previews, workspace directory
 * listings, and the filesystem-observation change feed, exposed as
 * `workspaceFiles`.
 *
 * File reads follow the composed filesystem's read access, including paths
 * outside the workspace. The selected Session header supplies the base for
 * relative paths, with the sandbox policy root as its no-cwd fallback, not a
 * read-containment restriction. Directory listings and change observations
 * remain workspace-scoped. File-kind checks and configured read caps apply to
 * every preview. The editor's saves, creates, renames, and deletes stay inside
 * the workspace and run under a workspace-write sandbox policy. When `ctx.lsp`
 * is mounted, `navigate` answers hover, definition, and reference queries.
 *
 * A page is cut from `streamText`, which decodes and rejects non-UTF-8 as it
 * goes, so the file is read only up to the first character past the page and
 * never held whole in memory; the NUL scan runs on the page itself.
 *
 * This is NOT modelled on `session.openWorkspacePath`. That endpoint hands a
 * path to the local opener and leaves the effect on the machine; this one sends
 * file content across the wire, which is a different level of exposure.
 */

import { posix, win32 } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@anotherharness/cordis'
import z from '@anotherharness/schemastery'
import type {} from '@anotherharness/ah-fs'
import type { LspLocation, LspQueryResult } from '@anotherharness/ah-lsp'
import type { FsDirEntry, FsInfo, FsPathInfo, FsTarget, FsVersion } from '@anotherharness/ah-fs'
import type { SandboxExecutionPolicy } from '@anotherharness/ah-sandbox'
import type {} from '@anotherharness/ah-sandbox-policy'
import type {} from '@anotherharness/ah-session'
import type {} from '@anotherharness/ah-session-persistence'
import type { SessionId } from '@anotherharness/ah-session/types'
import { Remote, RemoteError, TypertRemoteService, type TypertLookup } from '@anotherharness/ah-typert-protocol'
import { WorkspaceChangeFeed } from './changes.ts'
import type {
  WorkspaceByteRange,
  WorkspaceByteReadOptions,
  WorkspaceDirectoryEntry,
  WorkspaceDirectoryListing,
  WorkspaceFileBytes,
  WorkspaceFileRange,
  WorkspaceFileStat,
  WorkspaceFileText,
  WorkspaceFileWatchFrame,
  WorkspaceNavigation,
  WorkspaceNavigationLocation,
  WorkspaceNavigationOperation,
  WorkspaceNavigationPosition,
} from './types.ts'

export type * from './types.ts'

declare module '@anotherharness/cordis' {
  interface Context {
    /** Host owner of the `workspaceFiles` Remote namespace. */
    workspaceFiles: WorkspaceFiles
  }
}

/** Header-derived file resolution context for one Session identity. */
export interface WorkspaceFileScope {
  /** Session identity received on the wire. */
  readonly sessionId: SessionId
  /** Session workspace root, or the deployment fallback when its header has no cwd. */
  readonly workspaceRoot: string
}

declare module '@anotherharness/ah-typert-protocol' {
  interface TypertLookupMap {
    /** Resolve a Session id to its workspace root without loading its event body or activating an Agent. */
    workspaceFileScope: TypertLookup<WorkspaceFileScope, SessionId>
  }
}

/** Deployment caps on one page or one listing. */
export interface Config {
  /**
   * Inclusive byte cap on one page's text and on one byte window.
   *
   * A page above this fails; it is not shortened, because a silently cut page
   * reads as the whole page. A byte window asking for more is refused the same
   * way. The file itself has no size cap: a caller pages through it.
   */
  readonly maxBytes: number
  /** Inclusive byte cap on a complete-file read; larger files are refused, never truncated. */
  readonly maxFileBytes: number
  /** Largest file content, in UTF-8 bytes, the editor may save; larger content is refused. */
  readonly maxEditableBytes: number
  /** Default and largest page size in lines; a request asking for more is refused. */
  readonly maxLines: number
  /** Cap on returned directory entries; the rest is dropped and reported cut. */
  readonly maxEntries: number
}

/** One page cut from a decoded text stream. */
interface Page {
  readonly text: string
  /** Lines in `text`; `0` for a page past the last line. */
  readonly lines: number
  readonly eof: boolean
}

/** The byte text never carries: its presence marks a page as binary. */
const NUL = String.fromCharCode(0)

/** Refuse anything the wire schema admits as a number but a window cannot use: only safe integers index a file. */
function integerAtLeast(value: number, min: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < min) {
    throw new RemoteError('gateway/bad-request', `${name} must be a safe integer of at least ${min}`, {})
  }
  return value
}

/**
 * Cut lines `offset` through `offset + limit - 1` from decoded chunks, stopping
 * at the first character past the page so the rest of the file is never read.
 * Lines before the page are counted, not kept, and the page is refused the
 * moment its bytes exceed `maxBytes`, so one giant line cannot grow memory past
 * the cap either.
 */
async function cutPage(
  chunks: AsyncIterable<string>,
  offset: number,
  limit: number,
  maxBytes: number,
  path: string,
): Promise<Page> {
  const last = offset + limit - 1
  const lines: string[] = []
  let current = ''
  let bytes = 0
  let lineNumber = 1
  const admit = (size: number): void => {
    bytes += size
    if (bytes > maxBytes) {
      throw new RemoteError(
        'workspace-file/too-large',
        `lines ${offset}-${last} of "${path}" exceed the ${maxBytes} byte cap`,
        { path, limit: maxBytes },
      )
    }
  }
  const complete = (): void => {
    if (lines.length > 0) admit(1)
    lines.push(current)
    current = ''
  }
  for await (const chunk of chunks) {
    let position = 0
    while (position < chunk.length) {
      if (lineNumber > last) return { text: lines.join('\n'), lines: lines.length, eof: false }
      const newline = chunk.indexOf('\n', position)
      const segment = newline === -1 ? chunk.slice(position) : chunk.slice(position, newline)
      if (lineNumber >= offset) {
        admit(Buffer.byteLength(segment, 'utf8'))
        current += segment
      }
      if (newline === -1) break
      if (lineNumber >= offset) complete()
      lineNumber += 1
      position = newline + 1
    }
  }
  // Only an in-page line can be pending here: earlier lines were never kept,
  // and a character past the page returned above.
  if (current.length > 0) complete()
  return { text: lines.join('\n'), lines: lines.length, eof: true }
}

/**
 * Workspace path of `target` relative to `root`, derived from the two canonical
 * `file:` URIs so the answer is `/`-joined on every platform. Empty for the root.
 */
function workspacePathOf(rootUrl: string, targetUrl: string): string {
  const root = new URL(rootUrl).pathname.replace(/\/+$/, '')
  const target = new URL(targetUrl).pathname
  if (target === root) return ''
  return target.slice(root.length + 1).split('/').map(decodeURIComponent).join('/')
}

/** Strip the resolved child target: the wire carries names and metadata only. */
function directoryEntry(child: FsDirEntry): WorkspaceDirectoryEntry {
  return {
    name: child.name,
    type: child.type,
    ...child.size === undefined ? {} : { size: child.size },
  }
}

/** The refusal for a file no language server handles. */
function noLanguageServer(path: string, cause?: unknown): RemoteError {
  return new RemoteError('workspace-file/no-language-server', `no language server handles "${path}"`, { path }, { cause })
}

/** A `file:` location as an editor target; other schemes have no file to open. */
function locationOf(location: LspLocation): WorkspaceNavigationLocation[] {
  if (!location.uri.startsWith('file:')) return []
  const { start, end } = location.range
  return [{ absolutePath: fileURLToPath(location.uri), start: { ...start }, end: { ...end } }]
}

/** Host Remote file reads and workspace directory observations over the composed filesystem. */
export class WorkspaceFiles extends TypertRemoteService {
  static inject = ['fs', 'sandboxPolicy', 'sessions', 'typert']

  static Config: z<Config> = z.object({
    maxBytes: z.number().step(1).min(1).default(2 * 1024 * 1024),
    maxFileBytes: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER - 1).default(32 * 1024 * 1024),
    maxEditableBytes: z.number().step(1).min(1).default(1024 * 1024),
    maxLines: z.number().step(1).min(1).default(5000),
    maxEntries: z.number().step(1).min(1).default(2000),
  })

  private readonly feed: WorkspaceChangeFeed

  /**
   * @param ctx - Host context carrying the filesystem and the sandbox policy.
   * @param config - deployment caps on one page or one listing.
   */
  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'workspaceFiles')
    this.feed = new WorkspaceChangeFeed(ctx)
    ctx.inject(['sessions', 'typert'], (scope) => {
      scope.typert.lookups.register('workspaceFileScope', {
        parameter: 'workspaceFileScope',
        wire: 'workspaceFileScopeId',
        hostTypeSymbol: '@anotherharness/ah-api-workspace-files#WorkspaceFileScope',
        wireTypeSymbol: '@anotherharness/ah-session/types#SessionId',
        resolve: async (sessionId) => {
          const live = scope.sessions.get(sessionId)?.header
          const stored = live === undefined
            ? await scope.get('sessionPersistence')?.stat(sessionId)
            : undefined
          const header = live ?? stored?.header
          if (header === undefined) return undefined
          return {
            sessionId,
            workspaceRoot: header.cwd ?? scope.sandboxPolicy.workspaceRoot,
          }
        },
      })
    })
  }

  /**
   * Read one page of lines from a UTF-8 file readable by the filesystem backend.
   * @param workspaceFileScope - header-derived workspace root for the Session identity on the wire.
   * @param path - absolute path or path relative to the workspace root; files outside it are allowed.
   * @param range - the line window; omitted fields take the page defaults.
   * @param signal - caller cancellation.
   * @returns the page, the file's version at the stat before it, and whether it reaches the last line.
   */
  @Remote
  async read(
    workspaceFileScope: WorkspaceFileScope,
    path: string,
    range: WorkspaceFileRange,
    signal: AbortSignal,
  ): Promise<WorkspaceFileText> {
    const { offset, limit } = this.resolvePage(range)
    const { target, info } = await this.locateFile(workspaceFileScope, path, signal)
    const page = await this.cutPage(target, offset, limit, signal, path)
    if (page.text.includes(NUL)) {
      throw new RemoteError('workspace-file/not-text', `"${path}" contains NUL bytes`, { path })
    }
    return { ...this.statOf(target, info), offset, text: page.text, lines: page.lines, eof: page.eof }
  }

  /**
   * Read a complete regular file or one byte range without text decoding.
   * @param workspaceFileScope - header-derived workspace root for the Session identity on the wire.
   * @param path - target path, absolute or workspace-relative; relative to the base file's directory when provided.
   * @param options - optional base file and range; without a range the complete-file cap applies.
   * @param signal - caller cancellation.
   * @returns native bytes with the file's version and size at the preceding stat, byte offset, and EOF marker.
   */
  @Remote
  async readBytes(
    workspaceFileScope: WorkspaceFileScope,
    path: string,
    options: WorkspaceByteReadOptions,
    signal: AbortSignal,
  ): Promise<WorkspaceFileBytes> {
    const window = options.range === undefined ? undefined : this.resolveWindow(options.range, path)
    const resolved = options.baseFile === undefined ? path : await this.relativePath(workspaceFileScope, options.baseFile, path, signal)
    const { target, info } = await this.locateFile(workspaceFileScope, resolved, signal)
    if (window !== undefined) {
      const { offset, length } = window
      const data = await this.ctx.fs.readByteRange(target, window, signal)
      const eof = info.size === undefined ? data.length < length : offset + data.length >= info.size
      return { ...this.statOf(target, info), offset, data, eof }
    }
    const limit = this.config.maxFileBytes
    const data = await this.ctx.fs.readBytes(target, signal, limit).catch((cause: unknown) => {
      if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'FS_TOO_LARGE') {
        throw new RemoteError('workspace-file/too-large', `"${path}" exceeds the ${limit} byte full-file cap`, { path, limit }, { cause })
      }
      throw cause
    })
    return { ...this.statOf(target, info), offset: 0, data, eof: true }
  }

  /**
   * Save the full text of one regular file inside the workspace, guarded by the
   * version the editor loaded. A version mismatch writes nothing and reports
   * the current version, so neither the user nor the agent overwrites the
   * other's change unseen.
   * @param workspaceFileScope - header-derived workspace root for the Session identity on the wire.
   * @param path - absolute path or path relative to the workspace root; it must stay inside the workspace.
   * @param content - the complete new UTF-8 text.
   * @param expectedVersion - the version the editor loaded.
   * @param signal - caller cancellation.
   * @returns the file's absolute path, its new version, and its byte size.
   */
  @Remote
  async write(
    workspaceFileScope: WorkspaceFileScope,
    path: string,
    content: string,
    expectedVersion: string,
    signal: AbortSignal,
  ): Promise<WorkspaceFileStat> {
    this.checkEditable(path, content)
    const bytes = Buffer.byteLength(content, 'utf8')
    const { root, workspaceRoot, entry } = await this.inspect(workspaceFileScope, path, signal)
    if (entry.type !== 'file') {
      throw new RemoteError('workspace-file/not-regular-file', `"${path}" is a ${entry.type}`, { path, kind: entry.type })
    }
    const target = await this.confine(root, workspaceRoot, path, signal)
    const policy = this.writePolicy(workspaceFileScope)
    let version: FsVersion
    try {
      version = (await this.ctx.fs.writeText(target, content, { kind: 'replaceIfVersion', version: expectedVersion as FsVersion }, signal, policy)).version
    } catch (cause: unknown) {
      throw await this.writeFailure(cause, target, path, signal)
    }
    // No actor: the user's save wakes every open view without crediting an agent.
    this.ctx.emit('fs/observed', target, { kind: 'present', version }, undefined)
    return { absolutePath: this.ctx.fs.processPath(target), version, bytes }
  }

  /**
   * Create a file or a directory inside the workspace, with any missing parent
   * directories. The path must be free.
   * @param workspaceFileScope - header-derived workspace root for the Session identity on the wire.
   * @param path - absolute path or path relative to the workspace root; it must stay inside the workspace.
   * @param kind - `file` or `directory`.
   * @param content - initial UTF-8 text of a file; empty when omitted, ignored for a directory.
   * @param signal - caller cancellation.
   * @returns the new entry's absolute path and version.
   */
  @Remote
  async create(
    workspaceFileScope: WorkspaceFileScope,
    path: string,
    kind: 'file' | 'directory',
    content: string | undefined,
    signal: AbortSignal,
  ): Promise<WorkspaceFileStat> {
    const text = kind === 'file' ? content ?? '' : ''
    this.checkEditable(path, text)
    const { root, workspaceRoot } = await this.workspace(workspaceFileScope, path, signal)
    // A file standing where a parent directory should be fails resolution.
    const target = await this.confine(root, workspaceRoot, path, signal)
      .catch((cause: unknown) => { throw this.mutationFailure(cause, path) })
    if (await this.ctx.fs.lstat(path, { cwd: workspaceRoot }, signal) !== undefined) {
      throw new RemoteError('workspace-file/exists', `"${path}" already exists`, { path })
    }
    const policy = this.writePolicy(workspaceFileScope)
    try {
      if (kind === 'directory') {
        await this.ctx.fs.makeDirectory(target, signal, policy)
      } else {
        const { version } = await this.ctx.fs.writeText(target, text, { kind: 'createIfAbsent' }, signal, policy)
        this.ctx.emit('fs/observed', target, { kind: 'present', version }, undefined)
      }
    } catch (cause: unknown) {
      throw this.mutationFailure(cause, path)
    }
    return this.statAfter(target, path, signal)
  }

  /**
   * Move a file or directory to a free path inside the workspace. Symbolic
   * links are refused, so a link never moves its target.
   * @param workspaceFileScope - header-derived workspace root for the Session identity on the wire.
   * @param from - the entry to move, absolute or relative to the workspace root.
   * @param to - the destination, absolute or relative to the workspace root; it must not exist.
   * @param signal - caller cancellation.
   * @returns the moved entry's absolute path and version.
   */
  @Remote
  async rename(workspaceFileScope: WorkspaceFileScope, from: string, to: string, signal: AbortSignal): Promise<WorkspaceFileStat> {
    const { source, root, workspaceRoot } = await this.mutableEntry(workspaceFileScope, from, signal)
    if (to.length === 0) throw new RemoteError('gateway/bad-request', 'to is required', {})
    const target = await this.confine(root, workspaceRoot, to, signal)
    if (await this.ctx.fs.lstat(to, { cwd: workspaceRoot }, signal) !== undefined) {
      throw new RemoteError('workspace-file/exists', `"${to}" already exists`, { path: to })
    }
    try {
      await this.ctx.fs.rename(source.target, target, signal, this.writePolicy(workspaceFileScope))
    } catch (cause: unknown) {
      throw this.mutationFailure(cause, from)
    }
    this.ctx.emit('fs/observed', source.target, { kind: 'absent' }, undefined)
    const moved = await this.statAfter(target, to, signal)
    if (source.type === 'file') this.ctx.emit('fs/observed', target, { kind: 'present', version: moved.version as FsVersion }, undefined)
    return moved
  }

  /**
   * Delete a file or directory inside the workspace. Symbolic links and the
   * workspace root are refused; a non-empty directory needs `recursive`. Named
   * `deleteEntry` because `remove` is a member of the Client namespace service.
   * @param workspaceFileScope - header-derived workspace root for the Session identity on the wire.
   * @param path - the entry to delete, absolute or relative to the workspace root.
   * @param recursive - delete a directory with its contents.
   * @param signal - caller cancellation.
   * @returns `{ removed: true }` once the entry is gone.
   */
  @Remote
  async deleteEntry(
    workspaceFileScope: WorkspaceFileScope,
    path: string,
    recursive: boolean,
    signal: AbortSignal,
  ): Promise<{ readonly removed: true }> {
    const { source } = await this.mutableEntry(workspaceFileScope, path, signal)
    try {
      await this.ctx.fs.remove(source.target, { recursive }, signal, this.writePolicy(workspaceFileScope))
    } catch (cause: unknown) {
      throw this.mutationFailure(cause, path)
    }
    this.ctx.emit('fs/observed', source.target, { kind: 'absent' }, undefined)
    return { removed: true }
  }

  /**
   * Ask the language server about a position in a file: hover text, the
   * definition, or every reference. Refused with
   * `workspace-file/no-language-server` when no server handles the file.
   * @param workspaceFileScope - header-derived workspace root for the Session identity on the wire.
   * @param path - absolute path or path relative to the workspace root.
   * @param position - zero-based line and UTF-16 column.
   * @param operation - hover, goToDefinition, or findReferences.
   * @param signal - caller cancellation.
   * @returns hover text, or the locations found.
   */
  @Remote
  async navigate(
    workspaceFileScope: WorkspaceFileScope,
    path: string,
    position: WorkspaceNavigationPosition,
    operation: WorkspaceNavigationOperation,
    signal: AbortSignal,
  ): Promise<WorkspaceNavigation> {
    integerAtLeast(position.line, 0, 'line')
    integerAtLeast(position.character, 0, 'character')
    const { target } = await this.locateFile(workspaceFileScope, path, signal)
    const lsp = this.ctx.get('lsp')
    if (lsp === undefined) throw noLanguageServer(path)
    let result: LspQueryResult
    try {
      result = await lsp.query({
        operation,
        filePath: this.ctx.fs.processPath(target),
        position: { line: position.line, character: position.character },
        workspaceRoot: workspaceFileScope.workspaceRoot,
      }, signal)
    } catch (cause: unknown) {
      if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'LSP_UNAVAILABLE') throw noLanguageServer(path, cause)
      throw cause
    }
    if (result.kind === 'hover') return result.hover === null ? { kind: 'hover' } : { kind: 'hover', contents: result.hover.contents }
    return { kind: 'locations', locations: result.locations.flatMap(locationOf) }
  }

  /**
   * Report one regular file's identity, version, and size without its content.
   * @param workspaceFileScope - header-derived workspace root for the Session identity on the wire.
   * @param path - absolute path or path relative to the workspace root; files outside it are allowed.
   * @param signal - caller cancellation.
   * @returns the file's absolute path, current version, and byte size.
   */
  @Remote
  async stat(workspaceFileScope: WorkspaceFileScope, path: string, signal: AbortSignal): Promise<WorkspaceFileStat> {
    const { target, info } = await this.locateFile(workspaceFileScope, path, signal)
    return this.statOf(target, info)
  }

  /**
   * List the direct children of one directory inside the Session's workspace.
   * @param workspaceFileScope - header-derived workspace root for the Session identity on the wire.
   * @param path - workspace path, absolute or relative to the workspace root.
   * @param signal - caller cancellation.
   * @returns the directory's children in the backend's stable name order, bounded by the entry cap.
   */
  @Remote
  async list(workspaceFileScope: WorkspaceFileScope, path: string, signal: AbortSignal): Promise<WorkspaceDirectoryListing> {
    const { root, workspaceRoot, entry } = await this.inspect(workspaceFileScope, path, signal)
    // A final link — a Windows junction or a symlink — is listed through the
    // directory it resolves to, matching the child type `listDir` reports for
    // that entry; `read` keeps its own no-follow gate on the final component.
    if (entry.type !== 'directory' && entry.type !== 'symlink') {
      throw new RemoteError(
        'workspace-file/not-directory',
        `"${path}" is a ${entry.type}`,
        { path, kind: entry.type },
      )
    }
    const target = await this.confine(root, workspaceRoot, path, signal)
    if (entry.type === 'symlink') {
      const info = await this.ctx.fs.stat(target, signal)
      if (info?.type !== 'directory') {
        throw new RemoteError('workspace-file/not-directory', `"${path}" does not resolve to a directory`, { path, kind: 'symlink' })
      }
    }
    const children = await this.ctx.fs.listDir(target, signal)
    return {
      path: workspacePathOf(this.ctx.fs.fileUrl(root), this.ctx.fs.fileUrl(target)),
      entries: children.slice(0, this.config.maxEntries).map(directoryEntry),
      truncated: children.length > this.config.maxEntries,
    }
  }

  /**
   * Watch one file or a directory's direct entries in the Session's filesystem.
   * Files use the backend's read authority; directories remain workspace-scoped.
   * @param workspaceFileScope - header-derived workspace root for the Session identity on the wire.
   * @param path - target path; the Host determines its type and confines directories to the workspace.
   * @param signal - generation cancellation.
   * @returns `ready` once the target watch is active, then current metadata for queued and live invalidations.
   * @throws RemoteError when watching is unavailable or a directory is outside the workspace.
   */
  @Remote({ mode: 'stream' })
  changes(workspaceFileScope: WorkspaceFileScope, path: string, signal: AbortSignal): AsyncIterable<WorkspaceFileWatchFrame> {
    return this.feed.follow(workspaceFileScope.workspaceRoot, path, signal)
  }

  private async relativePath(scope: WorkspaceFileScope, baseFile: string, path: string, signal: AbortSignal): Promise<string> {
    const relative = path.replace(/\\/g, '/')
    if (relative.length === 0 || relative.startsWith('/') || /^[a-z][a-z\d+.-]*:/iu.test(relative) || relative.includes(NUL)) {
      throw new RemoteError('gateway/bad-request', 'path must be relative when baseFile is provided', {})
    }
    const { target } = await this.locateFile(scope, baseFile, signal)
    const absolute = this.ctx.fs.processPath(target)
    const paths = absolute.startsWith('/') ? posix : win32
    return paths.resolve(paths.dirname(absolute), relative)
  }

  /** Apply the page defaults and caps here, so the request never carries them implicitly. */
  private resolvePage(range: WorkspaceFileRange): { offset: number; limit: number } {
    const offset = range.offset === undefined ? 1 : integerAtLeast(range.offset, 1, 'offset')
    const limit = range.limit === undefined ? this.config.maxLines : integerAtLeast(range.limit, 1, 'limit')
    if (limit > this.config.maxLines) {
      throw new RemoteError('gateway/bad-request', `limit must be at most ${this.config.maxLines}`, {})
    }
    return { offset, limit }
  }

  /** Apply the byte-window defaults and cap; a window above the cap is refused, not shortened. */
  private resolveWindow(range: WorkspaceByteRange, path: string): { offset: number; length: number } {
    const offset = range.offset === undefined ? 0 : integerAtLeast(range.offset, 0, 'offset')
    const length = range.length === undefined ? this.config.maxBytes : integerAtLeast(range.length, 1, 'length')
    if (offset + length > Number.MAX_SAFE_INTEGER) {
      throw new RemoteError('gateway/bad-request', 'offset plus length must stay a safe integer', {})
    }
    if (length > this.config.maxBytes) {
      throw new RemoteError(
        'workspace-file/too-large',
        `${length} bytes of "${path}" exceed the ${this.config.maxBytes} byte cap`,
        { path, limit: this.config.maxBytes },
      )
    }
    return { offset, length }
  }
  /**
   * Inspect the requested path itself before resolution follows its final
   * component. Directory containment is checked separately by `list`.
   */
  private async inspect(
    workspaceFileScope: WorkspaceFileScope,
    path: string,
    signal: AbortSignal,
  ): Promise<{ root: FsTarget; workspaceRoot: string; entry: FsPathInfo }> {
    if (path.length === 0) throw new RemoteError('gateway/bad-request', 'path is required', {})
    const { workspaceRoot } = workspaceFileScope
    const root = await this.ctx.fs.resolve(workspaceRoot, { signal })
    // Gate on the path itself before anything follows it.
    const entry = await this.ctx.fs.lstat(path, { cwd: workspaceRoot }, signal)
    if (entry === undefined) {
      throw new RemoteError('workspace-file/not-found', `no entry at "${path}"`, { path })
    }
    return { root, workspaceRoot, entry }
  }

  /** Resolve an inspected path and refuse it unless the workspace contains it. */
  private async confine(root: FsTarget, workspaceRoot: string, path: string, signal: AbortSignal): Promise<FsTarget> {
    const target = await this.ctx.fs.resolve(path, { cwd: workspaceRoot, signal })
    if (!this.ctx.fs.contains(root, target)) {
      throw new RemoteError('workspace-file/outside-workspace', `"${path}" is outside the workspace`, { path })
    }
    return target
  }

  /**
   * All gates for a regular file, ending in the one stat that names its version
   * and size. The stat re-checks what `lstat` saw: the file may have gone or
   * changed kind in between.
   */
  private async locateFile(
    workspaceFileScope: WorkspaceFileScope,
    path: string,
    signal: AbortSignal,
  ): Promise<{ target: FsTarget; info: FsInfo }> {
    const { workspaceRoot, entry } = await this.inspect(workspaceFileScope, path, signal)
    if (entry.type !== 'file') {
      throw new RemoteError('workspace-file/not-regular-file', `"${path}" is a ${entry.type}`, { path, kind: entry.type })
    }
    const target = await this.ctx.fs.resolve(path, { cwd: workspaceRoot, signal })
    const info = await this.ctx.fs.stat(target, signal)
    if (info === undefined) {
      throw new RemoteError('workspace-file/not-found', `no entry at "${path}"`, { path })
    }
    if (info.type !== 'file') {
      throw new RemoteError('workspace-file/not-regular-file', `"${path}" is a ${info.type}`, { path, kind: info.type })
    }
    return { target, info }
  }

  /** Refuse editor content above the editing cap or carrying NUL bytes. */
  private checkEditable(path: string, content: string): void {
    const bytes = Buffer.byteLength(content, 'utf8')
    const limit = this.config.maxEditableBytes
    if (bytes > limit) {
      throw new RemoteError('workspace-file/too-large', `${bytes} bytes for "${path}" exceed the ${limit} byte editing cap`, { path, limit })
    }
    if (content.includes(NUL)) throw new RemoteError('workspace-file/not-text', `content for "${path}" contains NUL bytes`, { path })
  }

  /** The sandbox policy every editor mutation runs under: write access to the Session workspace only. */
  private writePolicy(workspaceFileScope: WorkspaceFileScope): SandboxExecutionPolicy {
    return { mode: 'workspace-write', workspaceRoot: workspaceFileScope.workspaceRoot, sessionId: workspaceFileScope.sessionId }
  }

  /** Resolve the workspace root for a path that may not exist yet. */
  private async workspace(
    workspaceFileScope: WorkspaceFileScope, path: string, signal: AbortSignal,
  ): Promise<{ root: FsTarget; workspaceRoot: string }> {
    if (path.length === 0) throw new RemoteError('gateway/bad-request', 'path is required', {})
    const { workspaceRoot } = workspaceFileScope
    return { root: await this.ctx.fs.resolve(workspaceRoot, { signal }), workspaceRoot }
  }

  /** An existing entry that may be moved or deleted: inside the workspace, not a link, not the root itself. */
  private async mutableEntry(
    workspaceFileScope: WorkspaceFileScope, path: string, signal: AbortSignal,
  ): Promise<{ source: { target: FsTarget; type: 'file' | 'directory' | 'other' }; root: FsTarget; workspaceRoot: string }> {
    const { root, workspaceRoot, entry } = await this.inspect(workspaceFileScope, path, signal)
    if (entry.type === 'symlink') {
      throw new RemoteError('workspace-file/not-regular-file', `"${path}" is a symlink`, { path, kind: 'symlink' })
    }
    const target = await this.confine(root, workspaceRoot, path, signal)
    if (target.targetKey === root.targetKey) {
      throw new RemoteError('gateway/bad-request', 'the workspace root itself cannot be moved or deleted', {})
    }
    return { source: { target, type: entry.type }, root, workspaceRoot }
  }

  /** Stat an entry a mutation just produced. */
  private async statAfter(target: FsTarget, path: string, signal: AbortSignal): Promise<WorkspaceFileStat> {
    const info = await this.ctx.fs.stat(target, signal)
    if (info === undefined) throw new RemoteError('workspace-file/not-found', `no entry at "${path}"`, { path })
    return this.statOf(target, info)
  }

  /** Classify a create, rename, or delete refusal into the Remote vocabulary. */
  private mutationFailure(cause: unknown, path: string): unknown {
    const code = typeof cause === 'object' && cause !== null && 'code' in cause ? cause.code : undefined
    if (code === 'FS_EXISTS' || code === 'FS_NOT_OBSERVED') {
      return new RemoteError('workspace-file/exists', `"${path}" already exists`, { path }, { cause })
    }
    if (code === 'FS_NOT_EMPTY') {
      return new RemoteError('workspace-file/not-empty', `"${path}" is a non-empty directory; delete it recursively`, { path }, { cause })
    }
    if (code === 'FS_NOT_FOUND' || code === 'FS_NOT_DIRECTORY') {
      return new RemoteError('workspace-file/not-found', `no entry at "${path}", or a parent is missing or not a directory`, { path }, { cause })
    }
    if (code === 'FS_SANDBOX_DENIED') {
      return new RemoteError('workspace-file/write-denied', `changing "${path}" is not allowed in this workspace`, { path }, { cause })
    }
    return cause
  }

  /** Classify a filesystem write refusal into the Remote vocabulary. */
  private async writeFailure(cause: unknown, target: FsTarget, path: string, signal: AbortSignal): Promise<unknown> {
    const code = typeof cause === 'object' && cause !== null && 'code' in cause ? cause.code : undefined
    if (code === 'FS_STALE_VERSION') {
      const current = await this.ctx.fs.stat(target, signal)
      return new RemoteError(
        'workspace-file/conflict',
        `"${path}" changed since it was loaded; reload, compare, or overwrite it`,
        { path, currentVersion: current?.version },
        { cause },
      )
    }
    if (code === 'FS_SANDBOX_DENIED') {
      return new RemoteError('workspace-file/write-denied', `writing "${path}" is not allowed in this workspace`, { path }, { cause })
    }
    return cause
  }

  private statOf(target: FsTarget, info: FsInfo): WorkspaceFileStat {
    return {
      absolutePath: this.ctx.fs.processPath(target),
      version: info.version,
      ...info.size === undefined ? {} : { bytes: info.size },
    }
  }

  /** Stream the file as text and cut the page, classifying the backend's non-text refusal. */
  private async cutPage(target: FsTarget, offset: number, limit: number, signal: AbortSignal, path: string): Promise<Page> {
    try {
      return await cutPage(await this.ctx.fs.streamText(target, signal), offset, limit, this.config.maxBytes, path)
    } catch (error: unknown) {
      if (isNotTextRefusal(error)) {
        throw new RemoteError('workspace-file/not-text', `"${path}" is not UTF-8 text`, { path }, { cause: error })
      }
      throw error
    }
  }
}

/**
 * The backend's non-text refusal, recognized by its code alone: the error class
 * belongs to whichever `ah-fs` instance the provider loaded, so no class
 * identity is shared across the package boundary.
 */
function isNotTextRefusal(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'FS_NOT_TEXT'
}

export default WorkspaceFiles
