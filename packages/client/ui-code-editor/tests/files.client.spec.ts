/** Spec workspace/0001 AC-1, AC-2, AC-6: the editor's read and save face over the Remote. */
import { describe, expect, it, vi } from 'vitest'
import { RemoteError } from '@anotherharness/ah-client-test-runtime'
import { DraftStore } from '../src/client/drafts.ts'
import { createEditorFiles, sessionFileOf, type EditorRemote } from '../src/client/files.ts'

const A = 'ah-resource://file/session/s-1/src/a.ts'
const signal = new AbortController().signal
const bytes = (data: Uint8Array) => ({ absolutePath: '/w/src/a.ts', version: 'v1', offset: 0, data, eof: true })

function remote() {
  const readBytes = vi.fn<EditorRemote['workspaceFiles']['readBytes']>()
  const write = vi.fn<EditorRemote['workspaceFiles']['write']>()
  const navigate = vi.fn<EditorRemote['workspaceFiles']['navigate']>()
  return { readBytes, write, workspaceFiles: { readBytes, write, navigate } }
}

describe('editor files', () => {
  it('names the Session and path of a session address and rejects others', () => {
    expect(sessionFileOf(A)).toEqual({ sessionId: 's-1', path: 'src/a.ts' })
    expect(() => sessionFileOf('ah-resource://file/absolute/etc/hosts')).toThrow('not a session file address')
  })

  it('reads text, refuses binary, and reports failures', async () => {
    const r = remote()
    const files = createEditorFiles(r)
    r.readBytes.mockResolvedValueOnce({ ok: true, value: bytes(new TextEncoder().encode('x\r\n')) })
    expect(await files.read(A, signal)).toEqual({
      kind: 'text', text: { text: 'x\n', eol: 'CRLF', bom: false }, version: 'v1', absolutePath: '/w/src/a.ts',
    })
    expect(r.readBytes).toHaveBeenCalledWith('s-1', 'src/a.ts', {}, signal)
    r.readBytes.mockResolvedValueOnce({ ok: true, value: bytes(new Uint8Array([0])) })
    expect(await files.read(A, signal)).toEqual({ kind: 'refused', reason: 'binary' })
    r.readBytes.mockResolvedValueOnce({ ok: false, error: new RemoteError('workspace-file/not-found', 'gone', { path: 'src/a.ts' }) })
    expect(await files.read(A, signal)).toEqual({ kind: 'failed', message: 'gone' })
  })

  it('AC-1: saves with the base version and the original line endings', async () => {
    const r = remote()
    const files = createEditorFiles(r)
    const drafts = new DraftStore()
    drafts.loaded(A, { text: 'a\n', eol: 'CRLF', bom: false }, 'v1')
    drafts.edit(A, 'b\n')
    r.write.mockResolvedValueOnce({ ok: true, value: { absolutePath: '/w/src/a.ts', version: 'v2' } })
    expect(await files.save(drafts, drafts.get(A)!)).toEqual({ kind: 'saved', version: 'v2' })
    expect(r.write).toHaveBeenCalledWith('s-1', 'src/a.ts', 'b\r\n', 'v1')
    expect(drafts.get(A)).toMatchObject({ baseText: 'b\n', baseVersion: 'v2' })
  })

  it('AC-2: a stale save records the conflict; other failures record the message', async () => {
    const r = remote()
    const files = createEditorFiles(r)
    const drafts = new DraftStore()
    drafts.loaded(A, { text: 'a', eol: 'LF', bom: false }, 'v1')
    drafts.edit(A, 'b')
    r.write.mockResolvedValueOnce({ ok: false, error: new RemoteError('workspace-file/conflict', 'stale', { path: 'src/a.ts', currentVersion: 'v5' }) })
    expect(await files.save(drafts, drafts.get(A)!)).toEqual({ kind: 'conflict', version: 'v5' })
    expect(drafts.get(A)?.conflict).toEqual({ version: 'v5' })
    r.write.mockResolvedValueOnce({ ok: true, value: { absolutePath: '/w/src/a.ts', version: 'v6' } })
    expect(await files.save(drafts, drafts.get(A)!, 'v5')).toEqual({ kind: 'saved', version: 'v6' })
    expect(r.write).toHaveBeenLastCalledWith('s-1', 'src/a.ts', 'b', 'v5')
    drafts.edit(A, 'c')
    r.write.mockResolvedValueOnce({ ok: false, error: new RemoteError('workspace-file/write-denied', 'denied', { path: 'src/a.ts' }) })
    expect(await files.save(drafts, drafts.get(A)!)).toEqual({ kind: 'failed', message: 'denied' })
    expect(drafts.get(A)?.error).toBe('denied')
  })
})
