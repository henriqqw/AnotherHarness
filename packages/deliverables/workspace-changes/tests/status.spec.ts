/** Working-tree git status for source-control decorations in file trees. */
import { mkdir, realpath, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@anotherharness/cordis'
import SessionStore from '@anotherharness/ah-session'
import LocalSubprocessRuntime from '@anotherharness/ah-subprocess-local'
import LocalFileSystem from '@anotherharness/ah-fs-local'
import * as WorkspaceChanges from '../src/index.ts'
import type { GitRunner, GitRunResult } from '../src/git.ts'
import { parsePorcelain, readGitStatus, stateOf } from '../src/status.ts'
import { git, scratchDir } from './support.ts'

const cleanups: Array<() => Promise<unknown>> = []
afterEach(async () => {
  for (const cleanup of cleanups.reverse()) await cleanup()
  cleanups.length = 0
  vi.restoreAllMocks()
})

const signal = new AbortController().signal

async function boot(config: Partial<WorkspaceChanges.Config> = {}) {
  const ctx = new Context()
  cleanups.push(() => ctx.fiber.dispose())
  await ctx.plugin(SessionStore)
  await ctx.plugin(LocalSubprocessRuntime)
  await ctx.plugin(LocalFileSystem)
  await ctx.plugin(WorkspaceChanges, config as WorkspaceChanges.Config)
  return ctx
}

describe('git status parsing', () => {
  it('letters each porcelain code', () => {
    expect(['??', ' M', 'M ', 'MM', 'A ', 'AM', ' D', 'D ', 'UU', 'AA', 'DD', 'AU', ' T'].map(stateOf)).toEqual([
      'untracked', 'modified', 'modified', 'modified', 'added', 'added', 'deleted', 'deleted',
      'conflicted', 'conflicted', 'conflicted', 'conflicted', 'modified',
    ])
  })

  it('resolves paths against the repository root and caps the entries', () => {
    expect(parsePorcelain(' M src/a.ts\0?? new.txt\0', '/repo', 10)).toEqual({
      entries: [{ absolutePath: '/repo/src/a.ts', state: 'modified' }, { absolutePath: '/repo/new.txt', state: 'untracked' }],
      truncated: false,
    })
    expect(parsePorcelain(' M a\0 M b\0', '/repo', 1)).toEqual({ entries: [{ absolutePath: '/repo/a', state: 'modified' }], truncated: true })
    expect(parsePorcelain('', '/repo', 1)).toEqual({ entries: [], truncated: false })
  })

  it('throws git failures other than "not a repository" and marks a cut output as truncated', async () => {
    const result = (exitCode: number, stdout = '', stderr = '', truncated = false): GitRunResult => ({ exitCode, stdout, stderr, truncated })
    const runner = (...results: GitRunResult[]): GitRunner => {
      const fake: Pick<GitRunner, 'run'> = { run: vi.fn(() => Promise.resolve(results.shift()!)) }
      return fake as GitRunner
    }
    await expect(readGitStatus(runner(result(1, '', 'broken')), '/repo', 10, signal)).rejects.toThrow('git rev-parse failed: broken')
    await expect(readGitStatus(runner(result(0, '/repo\n'), result(1, '', 'locked')), '/repo', 10, signal))
      .rejects.toThrow('git status failed: locked')
    expect(await readGitStatus(runner(result(0, '/repo\n'), result(0, ' M a\0', '', true)), '/repo', 10, signal))
      .toEqual({ repository: true, entries: [{ absolutePath: '/repo/a', state: 'modified' }], truncated: true })
  })
})

describe('workspaceChanges.status', () => {
  it('reports modified, added, deleted, and untracked files of the enclosing repository, from a subdirectory too', async () => {
    const cwd = await realpath(await scratchDir('ah-workspace-status-', cleanups))
    git(cwd, 'init', '-q', '-b', 'main')
    await mkdir(join(cwd, 'src'))
    await writeFile(join(cwd, 'src', 'a.ts'), 'a\n')
    await writeFile(join(cwd, 'gone.txt'), 'g\n')
    await writeFile(join(cwd, '.gitignore'), '*.log\n')
    git(cwd, 'add', '-A')
    git(cwd, 'commit', '-q', '-m', 'init')
    await writeFile(join(cwd, 'src', 'a.ts'), 'changed\n')
    await rm(join(cwd, 'gone.txt'))
    await writeFile(join(cwd, 'staged.txt'), 's\n')
    git(cwd, 'add', 'staged.txt')
    await writeFile(join(cwd, 'new.txt'), 'n\n')
    await writeFile(join(cwd, 'debug.log'), 'ignored\n')
    const ctx = await boot()
    const status = await ctx.workspaceChanges.status(join(cwd, 'src'), signal)
    expect(status.repository).toBe(true)
    expect(status.truncated).toBe(false)
    expect([...status.entries].sort((a, b) => a.absolutePath.localeCompare(b.absolutePath))).toEqual([
      { absolutePath: `${cwd}/gone.txt`, state: 'deleted' },
      { absolutePath: `${cwd}/new.txt`, state: 'untracked' },
      { absolutePath: `${cwd}/src/a.ts`, state: 'modified' },
      { absolutePath: `${cwd}/staged.txt`, state: 'added' },
    ])
  })

  it('reports no repository outside one or without git, and throws other git failures', async () => {
    const outside = await scratchDir('ah-workspace-status-none-', cleanups)
    const ctx = await boot()
    expect(await ctx.workspaceChanges.status(outside, signal)).toEqual({ repository: false, entries: [], truncated: false })
    await expect(ctx.workspaceChanges.status(join(outside, 'missing'), signal)).rejects.toThrow()
    const noGit = await boot()
    vi.spyOn(noGit.subprocess, 'resolveExecutable').mockRejectedValue(new Error('git: not found'))
    expect(await noGit.workspaceChanges.status(outside, signal)).toEqual({ repository: false, entries: [], truncated: false })
  })
})
