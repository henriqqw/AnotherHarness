// @vitest-environment jsdom
/** Spec workspace/0001 AC-7, AC-11: plugin wiring, the close guard and prompt, and tabs following moves. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { Context } from '@anotherharness/cordis'
import { makeTranslate } from '@anotherharness/ah-client-test-runtime'
import { apply, CODE_EDITOR_ID, DOCUMENT_TAB_KIND, EDITOR_SUFFIXES, inject } from '../src/client/index.ts'
import { apply as hostApply } from '../src/index.ts'
import { ClosePrompt, type ClosePromptInjected } from '../src/client/ClosePrompt.tsx'
import type { EditorBodyInjected } from '../src/client/EditorBody.tsx'
import { LazyEditorBody } from '../src/client/LazyEditorBody.tsx'
import type { GuardedTab } from '../src/client/close-prompt.ts'
import { en, zh } from '../src/client/locales.ts'

const A = 'ah-resource://file/session/s-1/src/a.ts'

interface Recorded {
  readonly name: string
  readonly key?: string
  readonly id?: string
  readonly inject: () => unknown
  readonly component: unknown
}

afterEach(() => { cleanup() })

async function boot() {
  const ctx = new Context()
  const registered: Recorded[] = []
  const previews: { id: string; extensions: readonly string[]; priority: string; title: () => string }[] = []
  const guards: ((sessionId: string, tab: GuardedTab) => boolean)[] = []
  const sidebar = {
    registerCloseGuard: vi.fn((kind: string, guard: (sessionId: string, tab: GuardedTab) => boolean) => {
      expect(kind).toBe(DOCUMENT_TAB_KIND)
      guards.push(guard)
      return () => { guards.splice(guards.indexOf(guard), 1) }
    }),
    closeIn: vi.fn(),
    openResource: vi.fn(),
    openTabs: { getSnapshot: () => [{ sessionId: 's-1', tabId: 't1', contentId: A }], subscribe: () => () => {} },
  }
  const write = vi.fn(() => Promise.resolve({ ok: true, value: { absolutePath: '/w/src/a.ts', version: 'v2' } }))
  const workspaceFiles = { readBytes: vi.fn(), write, navigate: vi.fn() }
  ctx.provide('slots', {
    inject: (_name: string, register: () => () => void) => register(),
    register: (options: Omit<Recorded, 'component'>, component: unknown) => {
      const entry = { ...options, component }
      registered.push(entry)
      return () => { registered.splice(registered.indexOf(entry), 1) }
    },
  } as never)
  ctx.provide('locale', { bind: () => (key: string) => key, register: () => () => {} } as never)
  ctx.provide('documentPreviews', {
    register: (definition: (typeof previews)[number]) => {
      previews.push(definition)
      return () => {}
    },
  } as never)
  ctx.provide('sidebarRight', sidebar as never)
  ctx.provide('remote', { workspaceFiles } as never)
  ctx.provide('remote.workspaceFiles', workspaceFiles as never)
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, registered, previews, guards, sidebar, write, fiber }
}

describe('ui-code-editor apply', () => {
  it('keeps the host entry inert and registers the renderer in the builtin band with its body and the prompt', async () => {
    expect(hostApply).not.toThrow()
    const { registered, previews } = await boot()
    expect(previews.map(entry => [entry.id, entry.priority, entry.title()])).toEqual([[CODE_EDITOR_ID, 'builtin', 'title']])
    expect(previews[0]?.extensions).toBe(EDITOR_SUFFIXES)
    for (const suffix of ['ts', 'md', 'csv', 'gitignore']) expect(EDITOR_SUFFIXES).toContain(suffix)
    expect(new Set(EDITOR_SUFFIXES).size).toBe(EDITOR_SUFFIXES.length)
    expect(registered.map(entry => [entry.name, entry.key ?? entry.id, entry.component])).toEqual([
      ['shell.overlay', 'codeEditor.close-prompt', ClosePrompt],
      ['sidebar.right.tab.document', CODE_EDITOR_ID, LazyEditorBody],
    ])
    expect(Object.keys(en)).toEqual(Object.keys(zh))
  })

  it('AC-7: a dirty tab asks before closing; the prompt saves and then closes it', async () => {
    const { registered, guards, sidebar, write } = await boot()
    const body = registered[1]?.inject() as EditorBodyInjected
    body.drafts.loaded(A, { text: 'a', eol: 'LF', bom: false }, 'v1')
    expect(guards[0]?.('s-1', { id: 't1', contentId: A })).toBe(true)
    body.drafts.edit(A, 'b')
    const prompt = registered[0]?.inject() as ClosePromptInjected
    const view = render(<ClosePrompt flow={prompt.flow} t={makeTranslate(zh)} />)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    act(() => { expect(guards[0]?.('s-1', { id: 't1', contentId: A })).toBe(false) })
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(zh['close.title'].replace('{name}', 'a.ts'))
    await act(async () => { fireEvent.click(document.querySelector('[data-close-save]')!) })
    expect(write).toHaveBeenCalledWith('s-1', 'src/a.ts', 'b', 'v1')
    expect(sidebar.closeIn).toHaveBeenCalledWith('s-1', 't1')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    view.unmount()
  })

  it('shows save failures and conflicts, and Cancel or Don\'t save end the prompt', async () => {
    const { registered, guards, sidebar, write } = await boot()
    const body = registered[1]?.inject() as EditorBodyInjected
    const prompt = registered[0]?.inject() as ClosePromptInjected
    render(<ClosePrompt flow={prompt.flow} t={makeTranslate(zh)} />)
    body.drafts.loaded(A, { text: 'a', eol: 'LF', bom: false }, 'v1')
    body.drafts.edit(A, 'b')
    act(() => { guards[0]?.('s-1', { id: 't1', contentId: A }) })
    write.mockResolvedValueOnce({ ok: false, error: { code: 'workspace-file/write-denied', message: 'denied', details: { path: 'src/a.ts' } } } as never)
    await act(async () => { fireEvent.click(document.querySelector('[data-close-save]')!) })
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(zh['save.failed'].replace('{message}', 'denied'))
    write.mockResolvedValueOnce({
      ok: false, error: { code: 'workspace-file/conflict', message: 'stale', details: { path: 'src/a.ts', currentVersion: 'v3' } },
    } as never)
    await act(async () => { fireEvent.click(document.querySelector('[data-close-save]')!) })
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(zh['close.conflict'])
    await act(async () => { fireEvent.click(document.querySelector('[data-close-cancel]')!) })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    act(() => { guards[0]?.('s-1', { id: 't1', contentId: A }) })
    let release: (value: unknown) => void = () => {}
    write.mockReturnValueOnce(new Promise((resolve) => { release = resolve }) as never)
    act(() => { fireEvent.click(document.querySelector('[data-close-save]')!) })
    expect(document.querySelector('[data-close-save]')?.textContent).toBe(zh.saving)
    await act(async () => { release({ ok: false, error: { code: 'x', message: 'later', details: {} } }) })
    await act(async () => { fireEvent.click(document.querySelector('[data-close-discard]')!) })
    expect(sidebar.closeIn).toHaveBeenCalledWith('s-1', 't1')
    expect(body.drafts.get(A)).toBeUndefined()
  })

  it('AC-11: follows moves from the Files tree and opens definitions at a position', async () => {
    const { ctx, registered, sidebar } = await boot()
    const body = registered[1]?.inject() as EditorBodyInjected
    ctx.emit('workspace-file/moved', 's-1', A, 'ah-resource://file/session/s-1/src/b.ts')
    expect(sidebar.openResource).toHaveBeenCalledWith('ah-resource://file/session/s-1/src/b.ts', { replaceTab: 't1' })
    ctx.emit('workspace-file/moved', 's-1', A, undefined)
    expect(sidebar.closeIn).toHaveBeenCalledWith('s-1', 't1')
    body.openAt({ address: A, line: 4, column: 2, label: 'src/a.ts' })
    expect(body.drafts.takeView(A)).toEqual({ kind: 'reveal', line: 4, column: 2 })
    expect(sidebar.openResource).toHaveBeenLastCalledWith(A)
  })

  it('asks before leaving the page only while drafts are unsaved', async () => {
    const { registered, fiber } = await boot()
    const body = registered[1]?.inject() as EditorBodyInjected
    const leave = (): boolean => {
      const event = new Event('beforeunload', { cancelable: true })
      globalThis.dispatchEvent(event)
      return event.defaultPrevented
    }
    expect(leave()).toBe(false)
    body.drafts.loaded(A, { text: 'a', eol: 'LF', bom: false }, 'v1')
    body.drafts.edit(A, 'b')
    expect(leave()).toBe(true)
    await fiber.dispose()
    expect(leave()).toBe(false)
  })
})
