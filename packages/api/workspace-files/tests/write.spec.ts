/** Spec workspace/0001 AC-1, AC-2, AC-5, AC-6: version-guarded saves from the editor. */
import { readFile, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { failureOf, openWorkspace, signal, type Harness } from './harness.ts'

let h: Harness
afterEach(async () => { await h.dispose() })

describe('workspaceFiles.write', () => {
  it('AC-1: saves the new text, reports the new version, and wakes the change feed', async () => {
    h = await openWorkspace('wf-write-')
    await writeFile(join(h.workspace, 'notes.txt'), 'old\n')
    const files = h.endpoint()
    const before = await files.stat(h.scope, 'notes.txt', signal())
    const observed = vi.fn()
    h.ctx.on('fs/observed', observed)
    const saved = await files.write(h.scope, 'notes.txt', 'new text\n', before.version, signal())
    expect(await readFile(join(h.workspace, 'notes.txt'), 'utf8')).toBe('new text\n')
    expect(saved).toMatchObject({ absolutePath: before.absolutePath, bytes: 9 })
    expect(saved.version).not.toBe(before.version)
    expect(observed).toHaveBeenCalledWith(expect.anything(), { kind: 'present', version: saved.version }, undefined)
  })

  it('AC-2 and AC-5: refuses a stale version, reports the current one, and writes nothing', async () => {
    h = await openWorkspace('wf-write-')
    await writeFile(join(h.workspace, 'a.ts'), 'one')
    const files = h.endpoint()
    const loaded = await files.stat(h.scope, 'a.ts', signal())
    // Another writer (the agent) changes the file after the editor loaded it.
    await files.write(h.scope, 'a.ts', 'agent change', loaded.version, signal())
    const current = await files.stat(h.scope, 'a.ts', signal())
    expect(await failureOf(files.write(h.scope, 'a.ts', 'user change', loaded.version, signal())))
      .toEqual({ code: 'workspace-file/conflict', details: { path: 'a.ts', currentVersion: current.version } })
    expect(await readFile(join(h.workspace, 'a.ts'), 'utf8')).toBe('agent change')
  })

  it('AC-6: refuses paths outside the workspace, symbolic links, directories, and missing files', async () => {
    h = await openWorkspace('wf-write-')
    await writeFile(join(h.outside, 'secret.txt'), 'keep')
    await writeFile(join(h.workspace, 'real.txt'), 'real')
    await symlink(join(h.workspace, 'real.txt'), join(h.workspace, 'link.txt'))
    const files = h.endpoint()
    const outsidePath = join(h.outside, 'secret.txt')
    expect((await failureOf(files.write(h.scope, outsidePath, 'x', 'v', signal()))).code).toBe('workspace-file/outside-workspace')
    expect(await readFile(outsidePath, 'utf8')).toBe('keep')
    expect((await failureOf(files.write(h.scope, 'link.txt', 'x', 'v', signal()))).code).toBe('workspace-file/not-regular-file')
    expect((await failureOf(files.write(h.scope, '.', 'x', 'v', signal()))).code).toBe('workspace-file/not-regular-file')
    expect((await failureOf(files.write(h.scope, 'missing.txt', 'x', 'v', signal()))).code).toBe('workspace-file/not-found')
  })

  it('AC-6: refuses content above the editing cap or with NUL bytes', async () => {
    h = await openWorkspace('wf-write-')
    await writeFile(join(h.workspace, 'big.txt'), 'small')
    const files = h.endpoint({ maxEditableBytes: 4 })
    expect(await failureOf(files.write(h.scope, 'big.txt', 'too long', 'v', signal())))
      .toEqual({ code: 'workspace-file/too-large', details: { path: 'big.txt', limit: 4 } })
    expect((await failureOf(files.write(h.scope, 'big.txt', 'a\u0000', 'v', signal()))).code).toBe('workspace-file/not-text')
  })

  it('maps sandbox refusals and passes other failures through', async () => {
    h = await openWorkspace('wf-write-')
    await writeFile(join(h.workspace, 'locked.txt'), 'x')
    const files = h.endpoint()
    const { version } = await files.stat(h.scope, 'locked.txt', signal())
    const writeText = vi.spyOn(h.ctx.fs, 'writeText')
    writeText.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'FS_SANDBOX_DENIED' }))
    expect(await failureOf(files.write(h.scope, 'locked.txt', 'y', version, signal())))
      .toEqual({ code: 'workspace-file/write-denied', details: { path: 'locked.txt' } })
    writeText.mockRejectedValueOnce(new Error('disk full'))
    await expect(files.write(h.scope, 'locked.txt', 'y', version, signal())).rejects.toThrow('disk full')
    writeText.mockRejectedValueOnce('plain')
    await expect(files.write(h.scope, 'locked.txt', 'y', version, signal())).rejects.toBe('plain')
  })
})
