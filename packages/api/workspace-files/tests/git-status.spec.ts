/** Source-control status for the Files tree, served through the workspaceChanges service. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openWorkspace, signal, type Harness } from './harness.ts'

let h: Harness
afterEach(async () => { await h.dispose() })

describe('workspaceFiles.gitStatus', () => {
  it('reports no repository without the workspaceChanges service', async () => {
    h = await openWorkspace('wf-git-')
    expect(await h.endpoint().gitStatus(h.scope, signal())).toEqual({ repository: false, entries: [], truncated: false })
  })

  it('asks the workspaceChanges service about the workspace root and keeps only the wire fields', async () => {
    h = await openWorkspace('wf-git-')
    const status = vi.fn(() => Promise.resolve({
      repository: true, truncated: true,
      entries: [{ absolutePath: '/w/a.ts', state: 'modified' as const, extra: 1 }],
    }))
    h.ctx.provide('workspaceChanges', { summary: vi.fn(), diff: vi.fn(), status } as never)
    expect(await h.endpoint().gitStatus(h.scope, signal())).toEqual({
      repository: true, truncated: true, entries: [{ absolutePath: '/w/a.ts', state: 'modified' }],
    })
    expect(status).toHaveBeenCalledWith(h.workspace, expect.any(AbortSignal))
  })
})
