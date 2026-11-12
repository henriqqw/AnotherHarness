/** Spec workspace/0001 AC-7, AC-10, AC-11, AC-12: close prompt, Save all, following moves, and navigation targets. */
import { describe, expect, it, vi } from 'vitest'
import { RemoteError } from '@anotherharness/ah-client-test-runtime'
import { createCloseFlow } from '../src/client/close-prompt.ts'
import { DraftStore } from '../src/client/drafts.ts'
import { createEditorFiles, type EditorFiles, type EditorRemote, type EditorSaveResult } from '../src/client/files.ts'
import { followMove, movedAddress, nameOfAddress, type OpenTab } from '../src/client/follow-moves.ts'
import { targetsOf, workspaceRootOf } from '../src/client/navigation.ts'

const A = 'ah-resource://file/session/s-1/src/a.ts'
const B = 'ah-resource://file/session/s-1/src/b.ts'
const signal = new AbortController().signal
const loaded = (drafts: DraftStore, address: string, text = 'x'): void => {
  drafts.loaded(address, { text, eol: 'LF', bom: false }, 'v1')
}

function remote() {
  const readBytes = vi.fn<EditorRemote['workspaceFiles']['readBytes']>()
  const write = vi.fn<EditorRemote['workspaceFiles']['write']>()
  const navigate = vi.fn<EditorRemote['workspaceFiles']['navigate']>()
  return { readBytes, write, navigate, workspaceFiles: { readBytes, write, navigate } }
}

function fakeFiles(result: EditorSaveResult): EditorFiles & { save: ReturnType<typeof vi.fn<EditorFiles['save']>> } {
  return {
    pathOf: () => '', sessionOf: () => '', rootOf: () => undefined, targetsOf: () => [], read: vi.fn(), saveAll: vi.fn(), navigate: vi.fn(),
    save: vi.fn<EditorFiles['save']>(() => Promise.resolve(result)),
  }
}

describe('close flow', () => {
  it('AC-7: lets clean tabs close and asks for dirty ones; Cancel keeps the tab and draft', async () => {
    const drafts = new DraftStore()
    const close = vi.fn()
    const flow = createCloseFlow(drafts, fakeFiles({ kind: 'saved', version: 'v2' }), close)
    const listener = vi.fn()
    const off = flow.subscribe(listener)
    loaded(drafts, A)
    expect(flow.guard('s-1', { id: 't1', contentId: A })).toBe(true)
    drafts.edit(A, 'changed')
    expect(flow.guard('s-1', { id: 't1', contentId: A })).toBe(false)
    expect(flow.getSnapshot().request).toEqual({ sessionId: 's-1', tabId: 't1', address: A })
    await flow.choose('cancel')
    expect(flow.getSnapshot().request).toBeUndefined()
    expect(drafts.isDirty(A)).toBe(true)
    expect(close).not.toHaveBeenCalled()
    await flow.choose('save')
    expect(listener).toHaveBeenCalledTimes(2)
    off()
  })

  it('Don\'t save drops the draft and closes; a draft gone clean meanwhile closes without saving', async () => {
    const drafts = new DraftStore()
    const close = vi.fn()
    const files = fakeFiles({ kind: 'saved', version: 'v2' })
    const flow = createCloseFlow(drafts, files, close)
    loaded(drafts, A)
    drafts.edit(A, 'changed')
    flow.guard('s-1', { id: 't1', contentId: A })
    await flow.choose('discard')
    expect(drafts.get(A)).toBeUndefined()
    expect(close).toHaveBeenCalledWith('s-1', 't1')
    loaded(drafts, B)
    drafts.edit(B, 'changed')
    flow.guard('s-1', { id: 't2', contentId: B })
    drafts.discard(B)
    await flow.choose('save')
    expect(files.save).not.toHaveBeenCalled()
    expect(close).toHaveBeenLastCalledWith('s-1', 't2')
  })

  it('Save writes then closes; a conflict or failure keeps the prompt open with the reason', async () => {
    const drafts = new DraftStore()
    const close = vi.fn()
    const files = fakeFiles({ kind: 'conflict', version: 'v9' })
    const flow = createCloseFlow(drafts, files, close)
    loaded(drafts, A)
    drafts.edit(A, 'changed')
    flow.guard('s-1', { id: 't1', contentId: A })
    let release: (result: EditorSaveResult) => void = () => {}
    files.save.mockReturnValueOnce(new Promise((resolve) => { release = resolve }))
    const saving = flow.choose('save')
    expect(flow.getSnapshot().busy).toBe(true)
    await flow.choose('save')
    release({ kind: 'conflict', version: 'v9' })
    await saving
    expect(flow.getSnapshot()).toMatchObject({ busy: false, conflict: true })
    files.save.mockResolvedValueOnce({ kind: 'failed', message: 'denied' })
    await flow.choose('save')
    expect(flow.getSnapshot()).toMatchObject({ busy: false, conflict: false, error: 'denied' })
    expect(close).not.toHaveBeenCalled()
    files.save.mockResolvedValueOnce({ kind: 'saved', version: 'v10' })
    await flow.choose('save')
    expect(close).toHaveBeenCalledWith('s-1', 't1')
    expect(drafts.get(A)).toBeUndefined()
    await flow.choose('cancel')
  })
})

describe('following moves', () => {
  const tabs: OpenTab[] = [
    { sessionId: 's-1', tabId: 't1', contentId: A },
    { sessionId: 's-1', tabId: 't2', contentId: 'ah-resource://file/session/s-1/src/deep/c.ts' },
    { sessionId: 's-1', tabId: 't3', contentId: 'ah-resource://file/session/s-1/srcx/d.ts' },
    { sessionId: 's-2', tabId: 't4', contentId: A },
  ]

  it('maps addresses under a moved entry and names files', () => {
    const src = 'ah-resource://file/session/s-1/src'
    const lib = 'ah-resource://file/session/s-1/lib'
    expect(movedAddress(A, src, lib)).toBe('ah-resource://file/session/s-1/lib/a.ts')
    expect(movedAddress(A, A, B)).toBe(B)
    expect(movedAddress(A, src, undefined)).toBeUndefined()
    expect(movedAddress('ah-resource://file/session/s-1/srcx/d.ts', src, lib)).toBeNull()
    expect(nameOfAddress('ah-resource://file/session/s-1/src/my%20file.ts?x=1')).toBe('my file.ts')
    expect(nameOfAddress(A)).toBe('a.ts')
  })

  it('AC-11: moves drafts and reopens tabs after a rename, and closes tabs after a delete', () => {
    const drafts = new DraftStore()
    loaded(drafts, A)
    loaded(drafts, 'ah-resource://file/session/s-1/other.ts')
    drafts.setView(A, { kind: 'reveal', line: 3, column: 1 })
    const effects = { tabs: () => tabs, close: vi.fn(), replace: vi.fn() }
    const src = 'ah-resource://file/session/s-1/src'
    const lib = 'ah-resource://file/session/s-1/lib'
    followMove(drafts, effects, 's-1', src, lib)
    expect(drafts.get(A)).toBeUndefined()
    expect(drafts.get(`${lib}/a.ts`)?.address).toBe(`${lib}/a.ts`)
    expect(drafts.takeView(`${lib}/a.ts`)).toEqual({ kind: 'reveal', line: 3, column: 1 })
    expect(effects.replace.mock.calls).toEqual([[`${lib}/a.ts`, 't1'], [`${lib}/deep/c.ts`, 't2']])
    followMove(drafts, effects, 's-1', src, undefined)
    expect(effects.close.mock.calls).toEqual([['s-1', 't1'], ['s-1', 't2']])
  })
})

describe('navigation targets', () => {
  it('derives the workspace root from a file and its relative path', () => {
    expect(workspaceRootOf('/w/src/a.ts', 'src/a.ts')).toBe('/w')
    expect(workspaceRootOf('C:\\w\\src\\a.ts', 'src/a.ts')).toBe('C:/w')
    expect(workspaceRootOf('/w/src/a.ts', '/w/src/a.ts')).toBeUndefined()
    expect(workspaceRootOf('/w/src/a.ts', 'C:/a.ts')).toBeUndefined()
    expect(workspaceRootOf('/w/a.ts', '')).toBeUndefined()
    expect(workspaceRootOf('/w/other.ts', 'src/a.ts')).toBeUndefined()
  })

  it('AC-12: turns zero-based locations into one-based targets with workspace labels', () => {
    const at = (absolutePath: string) => ({ absolutePath, start: { line: 4, character: 2 }, end: { line: 4, character: 3 } })
    const [inside, outside] = targetsOf('s-1', '/w/', [at('/w/src/b.ts'), at('/elsewhere/x.ts')])
    expect(inside).toEqual({ address: B, line: 5, column: 3, label: 'src/b.ts' })
    expect(outside).toMatchObject({ line: 5, column: 3, label: '/elsewhere/x.ts' })
    expect(outside?.address.endsWith('elsewhere/x.ts')).toBe(true)
    expect(targetsOf('s-1', undefined, [at('/w/src/b.ts')])[0]?.label).toBe('/w/src/b.ts')
  })
})

describe('editor files: Save all and navigate', () => {
  it('AC-10: saves every dirty draft except those saving or in conflict', async () => {
    const r = remote()
    const files = createEditorFiles(r)
    const drafts = new DraftStore()
    const C = 'ah-resource://file/session/s-1/c.ts'
    const D = 'ah-resource://file/session/s-1/d.ts'
    for (const address of [A, B, C, D]) loaded(drafts, address)
    for (const address of [A, C, D]) drafts.edit(address, 'changed')
    drafts.conflicted(C, 'v3')
    drafts.saving(D)
    r.write.mockResolvedValue({ ok: true, value: { absolutePath: '/w/src/a.ts', version: 'v2' } })
    expect(await files.saveAll(drafts)).toEqual([{ kind: 'saved', version: 'v2' }])
    expect(r.write).toHaveBeenCalledOnce()
    expect(files.sessionOf(A)).toBe('s-1')
    expect(files.pathOf(A)).toBe('src/a.ts')
    expect(files.rootOf(A, '/w/src/a.ts')).toBe('/w')
    const location = { absolutePath: '/w/src/b.ts', start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }
    expect(files.targetsOf(A, '/w', [location])).toEqual([{ address: B, line: 1, column: 1, label: 'src/b.ts' }])
  })

  it('AC-12: returns language-server results, "unavailable" without a server, and failures', async () => {
    const r = remote()
    const files = createEditorFiles(r)
    const position = { line: 1, character: 2 }
    r.navigate.mockResolvedValueOnce({ ok: true, value: { kind: 'hover', contents: 'type' } })
    expect(await files.navigate(A, position, 'hover', signal)).toEqual({ kind: 'hover', contents: 'type' })
    expect(r.navigate).toHaveBeenCalledWith('s-1', 'src/a.ts', position, 'hover', signal)
    r.navigate.mockResolvedValueOnce({ ok: false, error: new RemoteError('workspace-file/no-language-server', 'none', { path: 'src/a.ts' }) })
    expect(await files.navigate(A, position, 'goToDefinition', signal)).toEqual({ kind: 'unavailable' })
    r.navigate.mockResolvedValueOnce({ ok: false, error: new RemoteError('workspace-file/not-found', 'gone', { path: 'src/a.ts' }) })
    expect(await files.navigate(A, position, 'findReferences', signal)).toEqual({ kind: 'failed', message: 'gone' })
  })
})
