// @vitest-environment jsdom
/** Source-control decorations, the changed-files list, and Show file location in the Files tree. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent } from '@testing-library/react'
import { RemoteError } from '@anotherharness/ah-client-test-runtime'
import type { WorkspaceGitStatus } from '@anotherharness/ah-api-workspace-files/types'
import { fileAddressFor } from '@anotherharness/ah-util-workspace-path'
import type { DirLevel } from '../src/client/store.ts'
import { zh } from '../src/client/locales.ts'
import { decorate, NO_DECORATIONS, readDecorations, slashPath, type WorkspaceGitStatusRemote } from '../src/client/git-status.ts'
import { createFileReveal, type WorkspaceRevealRemote } from '../src/client/reveal.ts'
import { mountBody, ROOT, SESSION } from './mount.client.tsx'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const LEVEL: DirLevel = {
  entries: [{ name: 'src', type: 'directory' }, { name: 'a.ts', type: 'file', size: 1 }, { name: 'b.ts', type: 'file', size: 1 }],
  truncated: false,
}

const STATUS: WorkspaceGitStatus = {
  repository: true,
  truncated: false,
  entries: [
    { absolutePath: `${ROOT}/a.ts`, state: 'modified' },
    { absolutePath: `${ROOT}/src/new.ts`, state: 'untracked' },
    { absolutePath: `${ROOT}/src/deep/c.ts`, state: 'conflicted' },
    { absolutePath: `${ROOT}/gone.ts`, state: 'deleted' },
    { absolutePath: '/elsewhere/x.ts', state: 'modified' },
  ],
}

describe('git decorations', () => {
  it('decorates files under the root and gives folders their most significant change', () => {
    const git = decorate(STATUS, `${ROOT}/`)
    expect(git.files.get(`${ROOT}/a.ts`)).toBe('modified')
    expect(git.files.has('/elsewhere/x.ts')).toBe(false)
    expect(git.folders.get(`${ROOT}/src`)).toBe('conflicted')
    expect(git.folders.get(`${ROOT}/src/deep`)).toBe('conflicted')
    expect(git.folders.get(ROOT)).toBe('conflicted')
    expect(git.changes.map(change => change.path)).toEqual([
      `${ROOT}/a.ts`, `${ROOT}/gone.ts`, `${ROOT}/src/deep/c.ts`, `${ROOT}/src/new.ts`,
    ])
    const ranks = decorate({ repository: true, truncated: true, entries: [
      { absolutePath: '/r/d/a', state: 'modified' }, { absolutePath: '/r/d/b', state: 'untracked' },
    ] }, '/r')
    expect(ranks.folders.get('/r/d')).toBe('modified')
    expect(ranks.truncated).toBe(true)
    expect(decorate({ repository: true, truncated: false, entries: [{ absolutePath: '/a.txt', state: 'added' }] }, '/').files.get('/a.txt'))
      .toBe('added')
    expect(slashPath('C:\\w\\')).toBe('C:/w')
    expect(slashPath('/')).toBe('/')
  })

  it('reads the status over the Remote and decorates nothing on failure', async () => {
    const gitStatus = vi.fn<WorkspaceGitStatusRemote['workspaceFiles']['gitStatus']>()
    const remote: WorkspaceGitStatusRemote = { workspaceFiles: { gitStatus } }
    gitStatus.mockResolvedValueOnce({ ok: true, value: STATUS })
    expect((await readDecorations(remote, SESSION, ROOT)).files.get(`${ROOT}/a.ts`)).toBe('modified')
    gitStatus.mockResolvedValueOnce({ ok: false, error: new RemoteError('gateway/internal', 'no', {}) })
    expect(await readDecorations(remote, SESSION, ROOT)).toBe(NO_DECORATIONS)
  })
})

describe('file reveal', () => {
  it('asks the Host once whether it can reveal and reports each reveal', async () => {
    const canOpenWorkspacePath = vi.fn<WorkspaceRevealRemote['session']['canOpenWorkspacePath']>(() => Promise.resolve({ ok: true, value: true }))
    const openWorkspacePath = vi.fn<WorkspaceRevealRemote['session']['openWorkspacePath']>(() => Promise.resolve({ ok: true, value: {} }))
    const reveal = createFileReveal({ session: { canOpenWorkspacePath, openWorkspacePath } })
    expect(await reveal.available()).toBe(true)
    expect(await reveal.available()).toBe(true)
    expect(canOpenWorkspacePath).toHaveBeenCalledOnce()
    expect(await reveal.reveal('/w/a.ts')).toBe(true)
    expect(openWorkspacePath).toHaveBeenCalledWith({ path: '/w/a.ts', action: 'reveal' })
    openWorkspacePath.mockRejectedValueOnce(new Error('offline'))
    expect(await reveal.reveal('/w/a.ts')).toBe(false)
    const failing = createFileReveal({ session: { canOpenWorkspacePath: () => Promise.reject(new Error('x')), openWorkspacePath } })
    expect(await failing.available()).toBe(false)
  })
})

async function tree(status = STATUS) {
  const mounted = mountBody(ROOT)
  mounted.sourceControl.mockResolvedValue(decorate(status, ROOT))
  await act(() => mounted.script.watches.ready(ROOT))
  await act(() => mounted.script.settle({ ok: true, value: LEVEL }))
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)) })
  return mounted
}

describe('Files tree source control', () => {
  it('colors changed rows with their letter and folders with a dot', async () => {
    const { view, sourceControl } = await tree()
    expect(sourceControl).toHaveBeenCalledWith(SESSION, ROOT, expect.any(AbortSignal))
    const a = view.container.querySelector(`[data-files-path="${ROOT}/a.ts"]`)!
    expect(a.querySelector('[data-files-git="modified"]')?.textContent).toBe('a.ts')
    expect(a.textContent).toContain('M')
    expect(view.container.querySelector(`[data-files-path="${ROOT}/src"] [data-files-git="conflicted"]`)).not.toBeNull()
    expect(view.container.querySelector(`[data-files-path="${ROOT}/b.ts"] [data-files-git]`)).toBeNull()
  })

  it('lists changed files and opens them, re-reading on reload and focus', async () => {
    const { view, sourceControl, tabActions } = await tree()
    fireEvent.click(view.container.querySelector('[data-files-changes-toggle]')!)
    const rows = view.container.querySelectorAll('[data-files-change]')
    expect([...rows].map(row => row.getAttribute('data-files-change'))).toEqual(['modified', 'deleted', 'conflicted', 'untracked'])
    expect(rows[2]?.textContent).toContain('src/deep')
    expect(rows[1]?.querySelector('button')?.disabled).toBe(true)
    fireEvent.click(rows[0]!.querySelector('button')!)
    expect(tabActions.openResource).toHaveBeenCalledWith(fileAddressFor(SESSION, ROOT, `${ROOT}/a.ts`))
    fireEvent.contextMenu(rows[0]!.querySelector('button')!)
    expect(document.querySelector('[data-files-menu]')).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    const calls = sourceControl.mock.calls.length
    fireEvent.click(view.container.querySelector('[data-files-reload]')!)
    act(() => { globalThis.dispatchEvent(new Event('focus')) })
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)) })
    expect(sourceControl.mock.calls.length).toBeGreaterThan(calls)
    fireEvent.click(view.container.querySelector('[data-files-changes-toggle]')!)
    expect(view.container.querySelector('[data-files-change]')).toBeNull()
  })

  it('says when nothing changed, when the list was cut, and hides the toggle outside a repository', async () => {
    const empty = await tree({ repository: true, truncated: false, entries: [] })
    fireEvent.click(empty.view.container.querySelector('[data-files-changes-toggle]')!)
    expect(empty.view.container.querySelector('[data-files-changes="empty"]')?.textContent).toBe(zh['changes.empty'])
    cleanup()
    const cut = await tree({ ...STATUS, truncated: true })
    fireEvent.click(cut.view.container.querySelector('[data-files-changes-toggle]')!)
    expect(cut.view.container.textContent).toContain(zh.truncated)
    cleanup()
    const none = await tree({ repository: false, truncated: false, entries: [] })
    expect(none.view.container.querySelector('[data-files-changes-toggle]')).toBeNull()
  })

  it('shows the no-repository line when the toggle was open and the repository went away', async () => {
    const mounted = await tree()
    fireEvent.click(mounted.view.container.querySelector('[data-files-changes-toggle]')!)
    mounted.sourceControl.mockResolvedValue(decorate({ repository: false, truncated: false, entries: [] }, ROOT))
    fireEvent.click(mounted.view.container.querySelector('[data-files-reload]')!)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)) })
    expect(mounted.view.container.querySelector('[data-files-changes="none"]')?.textContent).toBe(zh['changes.noRepository'])
  })

  it('offers Show file location when the Host can reveal, for rows and the background', async () => {
    const mounted = mountBody(ROOT)
    mounted.reveal.available.mockResolvedValue(true)
    await act(() => mounted.script.watches.ready(ROOT))
    await act(() => mounted.script.settle({ ok: true, value: LEVEL }))
    // The answer is read on mount: remount once the Host says it can reveal.
    mounted.view.unmount()
    const view = mounted.remount()
    await act(async () => { await Promise.resolve() })
    fireEvent.contextMenu(view.container.querySelector(`[data-files-path="${ROOT}/a.ts"] button`)!)
    fireEvent.click(document.querySelector('[data-files-reveal]')!)
    expect(mounted.reveal.reveal).toHaveBeenCalledWith(`${ROOT}/a.ts`)
    expect(document.querySelector('[data-files-menu]')).toBeNull()
    fireEvent.contextMenu(view.container.querySelector('[data-files-body]')!)
    fireEvent.click(document.querySelector('[data-files-reveal]')!)
    expect(mounted.reveal.reveal).toHaveBeenLastCalledWith(ROOT)
  })

  it('ignores answers that arrive after the tree unmounted', async () => {
    const mounted = mountBody(ROOT)
    let canReveal: (value: boolean) => void = () => {}
    let decorations: (value: ReturnType<typeof decorate>) => void = () => {}
    mounted.reveal.available.mockReturnValue(new Promise((resolve) => { canReveal = resolve }))
    mounted.sourceControl.mockReturnValue(new Promise((resolve) => { decorations = resolve }))
    mounted.view.unmount()
    const view = mounted.remount()
    await act(() => mounted.script.watches.ready(ROOT))
    await act(() => mounted.script.settle({ ok: true, value: LEVEL }))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)) })
    view.unmount()
    await act(async () => {
      canReveal(true)
      decorations(decorate(STATUS, ROOT))
      await Promise.resolve()
    })
    expect(mounted.sourceControl).toHaveBeenCalled()
  })

  it('hides Show file location when the Host has no file manager', async () => {
    const { view } = await tree()
    fireEvent.contextMenu(view.container.querySelector(`[data-files-path="${ROOT}/a.ts"] button`)!)
    expect(document.querySelector('[data-files-reveal]')).toBeNull()
  })
})
