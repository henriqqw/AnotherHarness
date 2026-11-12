// @vitest-environment jsdom
/** Spec workspace/0001 AC-11: New File, New Folder, Rename, and Delete from the Files tree. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent } from '@testing-library/react'
import { RemoteError } from '@anotherharness/ah-client-test-runtime'
import { fileAddressFor } from '@anotherharness/ah-util-workspace-path'
import type { DirLevel } from '../src/client/store.ts'
import { zh } from '../src/client/locales.ts'
import {
  createFileOperations, joinEntry, nameOf, parentOf, validEntryName, type WorkspaceFilesMutationRemote,
} from '../src/client/operations.ts'
import { mountBody, ROOT, SESSION } from './mount.client.tsx'

const LEVEL: DirLevel = {
  entries: [{ name: 'src', type: 'directory' }, { name: 'a.ts', type: 'file', size: 1 }],
  truncated: false,
}

afterEach(() => { cleanup() })

async function tree() {
  const mounted = mountBody(ROOT)
  await act(() => mounted.script.watches.ready(ROOT))
  await act(() => mounted.script.settle({ ok: true, value: LEVEL }))
  return mounted
}

const row = (root: HTMLElement, path: string): HTMLElement =>
  root.querySelector(`[data-files-path="${path}"] button`) as HTMLElement
const dialogInput = (): HTMLInputElement => document.querySelector('[role="dialog"] input') as HTMLInputElement
const confirm = (): HTMLElement => document.querySelector('[data-files-dialog-confirm]') as HTMLElement

describe('file operations helpers', () => {
  it('validates names and joins paths in the directory style', () => {
    expect(validEntryName('  a.ts ')).toBe('a.ts')
    expect(validEntryName('src/x.ts')).toBe('src/x.ts')
    for (const bad of ['', '  ', '..', 'a/../b', 'a\\b', '/abs', 'dir/', 'a//b', './x']) expect(validEntryName(bad), bad).toBeUndefined()
    expect(joinEntry('/w', 'a/b.ts')).toBe('/w/a/b.ts')
    expect(joinEntry('/w/', 'a')).toBe('/w/a')
    expect(joinEntry('C:\\w', 'a/b')).toBe('C:\\w\\a\\b')
    expect(parentOf('/w/a.ts')).toBe('/w')
    expect(parentOf('/a')).toBe('/')
    expect(parentOf('C:\\w\\a')).toBe('C:\\w')
    expect(nameOf('/w/a.ts')).toBe('a.ts')
  })

  it('binds create, rename, and remove to the Remote and reports failures', async () => {
    const failure = new RemoteError('workspace-file/exists', 'taken', { path: '/w/a' })
    const create = vi.fn<WorkspaceFilesMutationRemote['workspaceFiles']['create']>(
      () => Promise.resolve({ ok: true, value: { absolutePath: '/w/a', version: 'v' } }))
    const rename = vi.fn<WorkspaceFilesMutationRemote['workspaceFiles']['rename']>(() => Promise.resolve({ ok: false, error: failure }))
    const deleteEntry = vi.fn<WorkspaceFilesMutationRemote['workspaceFiles']['deleteEntry']>(
      () => Promise.resolve({ ok: true, value: { removed: true } }))
    const remote: WorkspaceFilesMutationRemote = { workspaceFiles: { create, rename, deleteEntry } }
    const operations = createFileOperations(remote)
    expect(await operations.create(SESSION, '/w/a', 'directory')).toEqual({ ok: true })
    expect(create).toHaveBeenCalledWith(SESSION, '/w/a', 'directory', undefined)
    expect(await operations.rename(SESSION, '/w/a', '/w/b')).toEqual({ ok: false, failure })
    expect(await operations.remove(SESSION, '/w/a', true)).toEqual({ ok: true })
    expect(deleteEntry).toHaveBeenCalledWith(SESSION, '/w/a', true)
  })
})

describe('Files tree actions', () => {
  it('creates a file from the toolbar and opens it', async () => {
    const { view, operations, tabActions, script } = await tree()
    fireEvent.click(view.container.querySelector('[data-files-new-file]')!)
    fireEvent.change(dialogInput(), { target: { value: 'src/new.ts' } })
    await act(async () => { fireEvent.click(confirm()) })
    expect(operations.create).toHaveBeenCalledWith(SESSION, `${ROOT}/src/new.ts`, 'file')
    expect(tabActions.openResource).toHaveBeenCalledWith(fileAddressFor(SESSION, ROOT, `${ROOT}/src/new.ts`))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    void script
  })

  it('creates a folder with Enter, rejects invalid names, and shows a taken name', async () => {
    const { view, operations } = await tree()
    fireEvent.click(view.container.querySelector('[data-files-new-folder]')!)
    fireEvent.keyDown(dialogInput(), { key: 'Enter' })
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(zh['dialog.invalidName'])
    fireEvent.change(dialogInput(), { target: { value: 'lib' } })
    expect(document.querySelector('[role="alert"]')).toBeNull()
    operations.create.mockResolvedValueOnce({ ok: false, failure: new RemoteError('workspace-file/exists', 'taken', { path: 'lib' }) })
    await act(async () => { fireEvent.keyDown(dialogInput(), { key: 'Enter' }) })
    expect(operations.create).toHaveBeenCalledWith(SESSION, `${ROOT}/lib`, 'directory')
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(zh['dialog.exists'])
    operations.create.mockResolvedValueOnce({ ok: false, failure: new RemoteError('workspace-file/write-denied', 'denied here', { path: 'lib' }) })
    await act(async () => { fireEvent.click(confirm()) })
    expect(document.querySelector('[role="alert"]')?.textContent).toBe('denied here')
    let release: (value: { ok: true }) => void = () => {}
    operations.create.mockReturnValueOnce(new Promise((resolve) => { release = resolve }))
    fireEvent.keyDown(dialogInput(), { key: 'a' })
    fireEvent.keyDown(dialogInput(), { key: 'Enter' })
    fireEvent.keyDown(dialogInput(), { key: 'Enter' })
    await act(async () => { release({ ok: true }) })
    expect(operations.create).toHaveBeenCalledTimes(3)
  })

  it('opens the context menu on rows and the background, and closes it on Escape or outside clicks', async () => {
    const { view } = await tree()
    fireEvent.contextMenu(row(view.container, `${ROOT}/a.ts`), { clientX: 10, clientY: 20 })
    const menu = document.querySelector('[data-files-menu]') as HTMLElement
    expect([...menu.querySelectorAll('button')].map(b => b.textContent)).toEqual([
      zh['action.newFile'], zh['action.newFolder'], `${zh['action.rename']}F2`, `${zh['action.delete']}Del`,
    ])
    fireEvent.keyDown(document, { key: 'a' })
    fireEvent.pointerDown(menu)
    expect(document.querySelector('[data-files-menu]')).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.querySelector('[data-files-menu]')).toBeNull()
    fireEvent.contextMenu(view.container.querySelector('[data-files-body]')!, { clientX: 1, clientY: 1 })
    expect(document.querySelectorAll('[data-files-menu] button')).toHaveLength(2)
    fireEvent.pointerDown(document.body)
    expect(document.querySelector('[data-files-menu]')).toBeNull()
  })

  it('creates inside a folder from its context menu', async () => {
    const { view, operations } = await tree()
    fireEvent.contextMenu(row(view.container, `${ROOT}/src`))
    fireEvent.click(document.querySelectorAll('[data-files-menu] button')[1]!)
    fireEvent.change(dialogInput(), { target: { value: 'util' } })
    await act(async () => { fireEvent.click(confirm()) })
    expect(operations.create).toHaveBeenCalledWith(SESSION, `${ROOT}/src/util`, 'directory')
    fireEvent.contextMenu(row(view.container, `${ROOT}/a.ts`))
    fireEvent.click(document.querySelectorAll('[data-files-menu] button')[0]!)
    fireEvent.change(dialogInput(), { target: { value: 'b.ts' } })
    await act(async () => { fireEvent.click(confirm()) })
    expect(operations.create).toHaveBeenLastCalledWith(SESSION, `${ROOT}/b.ts`, 'file')
  })

  it('renames with F2 and from the menu; an unchanged name closes without a call', async () => {
    const { view, operations, announceMove } = await tree()
    fireEvent.keyDown(row(view.container, `${ROOT}/a.ts`), { key: 'F2' })
    expect(dialogInput().value).toBe('a.ts')
    await act(async () => { fireEvent.click(confirm()) })
    expect(operations.rename).not.toHaveBeenCalled()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    fireEvent.contextMenu(row(view.container, `${ROOT}/src`))
    fireEvent.click(document.querySelectorAll('[data-files-menu] button')[2]!)
    fireEvent.change(dialogInput(), { target: { value: 'source' } })
    await act(async () => { fireEvent.click(confirm()) })
    expect(operations.rename).toHaveBeenCalledWith(SESSION, `${ROOT}/src`, `${ROOT}/source`)
    expect(announceMove).toHaveBeenCalledWith(SESSION, fileAddressFor(SESSION, ROOT, `${ROOT}/src`), fileAddressFor(SESSION, ROOT, `${ROOT}/source`))
    fireEvent.keyDown(row(view.container, `${ROOT}/a.ts`), { key: 'Enter' })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('deletes after confirming, naming the item, recursively for folders', async () => {
    const { view, operations, announceMove } = await tree()
    fireEvent.keyDown(row(view.container, `${ROOT}/a.ts`), { key: 'Delete' })
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('a.ts')
    await act(async () => { fireEvent.click(confirm()) })
    expect(operations.remove).toHaveBeenCalledWith(SESSION, `${ROOT}/a.ts`, false)
    expect(announceMove).toHaveBeenCalledWith(SESSION, fileAddressFor(SESSION, ROOT, `${ROOT}/a.ts`), undefined)
    fireEvent.keyDown(row(view.container, `${ROOT}/src`), { key: 'Delete' })
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(zh['dialog.delete.folder'].replace('{name}', 'src'))
    let release: (value: { ok: true }) => void = () => {}
    operations.remove.mockReturnValueOnce(new Promise((resolve) => { release = resolve }))
    fireEvent.click(confirm())
    fireEvent.click(confirm())
    await act(async () => { release({ ok: true }) })
    expect(operations.remove).toHaveBeenCalledTimes(2)
    expect(operations.remove).toHaveBeenLastCalledWith(SESSION, `${ROOT}/src`, true)
    fireEvent.contextMenu(row(view.container, `${ROOT}/src`))
    fireEvent.click(document.querySelectorAll('[data-files-menu] button')[3]!)
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  })
})
