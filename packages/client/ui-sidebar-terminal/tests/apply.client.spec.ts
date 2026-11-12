// @vitest-environment jsdom
/** Terminal views, copy, and tab retention follow the plugin lifetime. */
import { createElement } from 'react'
import { createSnapshotStore } from '@anotherharness/ah-client-store'
import { renderToStaticMarkup } from 'react-dom/server'
import { cleanup, render, waitFor } from '@testing-library/react'
import { Context } from '@anotherharness/cordis'
import type { ShortcutCommand } from '@anotherharness/ah-client-shortcuts/client'
import { afterEach, expect, it, vi } from 'vitest'
import type { SessionId } from '@anotherharness/ah-session/types'
import type { WebTerminalId, WebTerminalInfo } from '@anotherharness/ah-api-terminal-controller/types'
import { SidebarRightTabRegistry } from '@anotherharness/ah-client-ui-sidebar-right/src/client/tab-registry.ts'
import type { SidebarRightCloseHandler } from '@anotherharness/ah-client-ui-sidebar-right/client'
import type { SidebarRightOpenTab } from '@anotherharness/ah-client-ui-sidebar-right/client'
import { apply, inject, TERMINAL_CONTROLLER_ENTRY } from '../src/client/index.ts'
import { apply as hostApply } from '../src/index.ts'
import { AgentTerminalGuide, type AgentTerminalGuideInjected } from '../src/client/AgentTerminalGuide.tsx'
import { TerminalGuide, type TerminalGuideInjected } from '../src/client/TerminalGuide.tsx'
import { LazyTerminalBody } from '../src/client/LazyTerminalBody.tsx'
import { TerminalTitle } from '../src/client/TerminalTitle.tsx'
import type { TerminalBodyInjected } from '../src/client/face.ts'
import { en, zh } from '../src/client/locales.ts'

vi.mock('@xterm/xterm', () => ({ Terminal: vi.fn() }))
const SHORTCUT_CATALOG: readonly never[] = []

const renderedTerminal = vi.hoisted(() => vi.fn(() => null))
vi.mock('../src/client/terminal.tsx', () => ({ TerminalBody: renderedTerminal }))

afterEach(() => { cleanup(); renderedTerminal.mockClear() })

interface FakeForms { get: (entryId: string) => { set: (field: string, value: unknown) => Promise<boolean> } }

async function mountPlugin(options: { forms?: FakeForms } = {}) {
  const ctx = new Context()
  if (options.forms !== undefined) ctx.provide('configForms', options.forms as never)
  const tabs = new SidebarRightTabRegistry(ctx)
  ctx.provide('sidebarRightTabs', tabs)
  const entries: {
    name: string
    key?: string
    id?: string
    locale: string
    component: unknown
    inject: (id: SessionId) => unknown
  }[] = []
  const dictionaries = new Map<string, unknown>()
  const closeHandlers = new Map<string, SidebarRightCloseHandler>()
  const model = { state: {} }
  const terminals = {
    retainTabs: vi.fn(), view: vi.fn(() => model), close: vi.fn(), closeFailures: {}, retryClose: vi.fn(),
    launchShells: vi.fn(async () => ({ shells: [], selectedShell: undefined })), selectShell: vi.fn(),
    recover: vi.fn(async (_sessionId: SessionId): Promise<WebTerminalInfo[]> => []),
    agentView: vi.fn(() => model), releaseAgentView: vi.fn(),
    agentTerminals: vi.fn(async () => [{ id: 'pty-1', title: 'build', state: 'running', controlledBy: 'agent' }]),
  }
  let params: { terminalId: WebTerminalId } | { profileId: string } | { shellPath: string } | undefined
  const occurrence = vi.fn(() => ({ navigation: { getSnapshot: () => ({ params, address: 'sidebar://terminal/content' }) } }))
  const openTabIn = vi.fn()
  const tabsIn = vi.fn(() => [] as { id: string; kind: string }[])
  const openTabs = createSnapshotStore<readonly SidebarRightOpenTab[]>([])
  const commandTarget = vi.fn(), openTabFromTarget = vi.fn()
  const commands: ShortcutCommand[] = []
  ctx.provide('webTerminals', terminals as never)
  ctx.provide('sidebarRight', {
    tabDomain: { occurrence }, openTabIn, tabsIn, openTabs, commandTarget, openTabFromTarget,
    registerCloseHandler: (kind: string, handler: SidebarRightCloseHandler) => {
      closeHandlers.set(kind, handler)
      return () => { closeHandlers.delete(kind) }
    },
  } as never)
  ctx.provide('slots', {
    inject: (_name: string, register: () => () => void) => register(),
    register: (options: Omit<typeof entries[number], 'component'>, component: unknown) => { const entry = { ...options, component }; entries.push(entry); return () => { entries.splice(entries.indexOf(entry), 1) } },
  } as never)
  ctx.provide('shortcuts', { register: (command: ShortcutCommand) => {
    commands.push(command)
    return () => { commands.splice(commands.indexOf(command), 1) }
  }, catalog: { getSnapshot: () => SHORTCUT_CATALOG, subscribe: () => () => {} } } as never)
  ctx.provide('locale', {
    bind: () => (key: string) => key,
    register: (name: string, values: unknown) => { dictionaries.set(name, values); return () => { dictionaries.delete(name) } },
  } as never)
  const theme = { preference: 'light' as const, fontSizes: { text: 14, code: 11, terminal: 13 }, fontFamilies: { text: '', code: '', terminal: '' }, active: { id: 'light', colorScheme: 'light' as const, tokens: {} }, themes: [], revision: 0 }
  ctx.provide('theme', { getTheme: () => theme } as never)
  const fiber = await ctx.plugin({ inject, apply })
  return {
    tabs, entries, dictionaries, terminals, model, occurrence, openTabIn, tabsIn, openTabs, theme,
    commandTarget, openTabFromTarget, commands,
    emitTheme() { ctx.emit('theme/change', theme) },
    get closeHandler() { return closeHandlers.get('terminal') },
    get agentCloseHandler() { return closeHandlers.get('agent-terminal') },
    setParams(next: typeof params) { params = next },
    async dispose() { await fiber.dispose(); await ctx.fiber.dispose() },
  }
}

it('registers agent terminal tabs that follow without closing the agent shell (spec terminal/0001 AC-2)', async () => {
  const h = await mountPlugin()
  try {
    const definition = h.tabs.get('agent-terminal')!
    expect(definition.title('sidebar://agent-terminal')).toBe('agentTitle')
    expect(definition.multiple).toBe(true)
    expect(definition.guide?.map(entry => [entry.order, entry.title(), entry.description?.()])).toEqual([[21, 'agentTitle', 'agentDescription']])
    const sessionId = 'session' as SessionId
    const guide = h.entries[3]!.inject(sessionId) as AgentTerminalGuideInjected
    const signal = new AbortController().signal
    expect(await guide.loadAgentTerminals(signal)).toEqual([{ id: 'pty-1', title: 'build', state: 'running', controlledBy: 'agent' }])
    expect(h.terminals.agentTerminals).toHaveBeenCalledWith(sessionId, signal)
    const body = h.entries[4]!.inject(sessionId) as TerminalBodyInjected
    h.setParams({ terminalId: 'pty-1' } as never)
    expect(body.view('tab')).toBe(h.model)
    expect(h.terminals.agentView).toHaveBeenLastCalledWith(sessionId, 'tab', 'pty-1')
    h.setParams(undefined)
    expect(body.keyedHooks.terminal('tab')).toBe(h.model.state)
    expect(h.terminals.agentView).toHaveBeenLastCalledWith(sessionId, 'tab', '')
    expect(body.hooks.theme.getSnapshot()).toBe(h.theme)
    h.agentCloseHandler?.(sessionId, { id: 'tab', contentId: 'sidebar://agent-terminal' } as Parameters<SidebarRightCloseHandler>[1])
    expect(h.terminals.releaseAgentView).toHaveBeenCalledWith(sessionId, 'tab')
    expect(h.terminals.close).not.toHaveBeenCalled()
  } finally {
    await h.dispose()
  }
})

it('stores the default profile through the terminal controller settings form when one is mounted', async () => {
  const set = vi.fn(async () => true)
  const get = vi.fn(() => ({ set }))
  const h = await mountPlugin({ forms: { get } })
  try {
    const launcher = h.entries[0]!.inject('session' as SessionId) as TerminalGuideInjected
    expect(await launcher.setDefaultProfile?.('wsl-ubuntu')).toBe(true)
    expect(get).toHaveBeenCalledWith(TERMINAL_CONTROLLER_ENTRY)
    expect(set).toHaveBeenCalledWith('defaultProfile', 'wsl-ubuntu')
  } finally {
    await h.dispose()
  }
})

it('registers terminal views without recovery or cleanup slots, then releases contributions on unload', async () => {
  expect(hostApply).not.toThrow()
  const h = await mountPlugin()
  try {
    const definition = h.tabs.get('terminal')!
    expect(definition.title('sidebar://terminal')).toBe('title')
    expect(definition.guide?.map(entry => [entry.order, entry.title(), entry.description?.()])).toEqual([[20, 'new', 'description']])
    const Icon = definition.guide?.[0]?.icon
    if (Icon === undefined) throw new Error('Terminal guide icon was not registered')
    expect(renderToStaticMarkup(createElement(Icon, { size: 22 }))).toContain('width="22"')
    expect(renderToStaticMarkup(createElement(Icon))).toContain('width="36"')
    expect(definition.multiple).toBe(true)
    expect(h.dictionaries.get('sidebarTerminal')).toEqual({ en, zh })
    expect(h.entries.map(entry => [entry.name, entry.component, entry.locale])).toEqual([
      ['sidebar.right.tab.guide.entry', TerminalGuide, 'sidebarTerminal'],
      ['sidebar.right.pane.tab', LazyTerminalBody, 'sidebarTerminal'],
      ['sidebar.right.pane.tab.title', TerminalTitle, 'sidebarTerminal'],
      ['sidebar.right.tab.guide.entry', AgentTerminalGuide, 'sidebarTerminal'],
      ['sidebar.right.pane.tab', LazyTerminalBody, 'sidebarTerminal'],
    ])
    const sessionId = 'session' as SessionId
    const launcher = h.entries[0]!.inject(sessionId) as TerminalGuideInjected
    const signal = new AbortController().signal
    await launcher.loadShells(signal)
    expect(h.terminals.launchShells).toHaveBeenCalledWith(sessionId, signal)
    launcher.selectShell('/bin/bash')
    expect(h.terminals.selectShell).toHaveBeenCalledWith('/bin/bash')
    expect(launcher.setDefaultProfile).toBeUndefined()
    const face = h.entries[1]!.inject(sessionId) as TerminalBodyInjected
    expect(face.hooks.theme.getSnapshot()).toBe(h.theme)
    const changed = vi.fn()
    const unsubscribe = face.hooks.theme.subscribe(changed)
    h.emitTheme()
    expect(changed).toHaveBeenCalledOnce()
    unsubscribe()
    h.emitTheme()
    expect(changed).toHaveBeenCalledOnce()
    expect(face.view('tab')).toBe(h.model)
    expect(h.terminals.view).toHaveBeenLastCalledWith(sessionId, 'tab', 'sidebar://terminal/content', undefined, undefined)
    const terminalId = 'retained' as WebTerminalId
    h.setParams({ terminalId })
    h.setParams({ shellPath: '/bin/bash' })
    face.view('tab')
    expect(h.terminals.view).toHaveBeenLastCalledWith(sessionId, 'tab', 'sidebar://terminal/content', undefined, { shellPath: '/bin/bash' })
    h.setParams({ profileId: 'wsl-ubuntu' })
    face.view('tab')
    expect(h.terminals.view).toHaveBeenLastCalledWith(sessionId, 'tab', 'sidebar://terminal/content', undefined, { profileId: 'wsl-ubuntu' })
    h.setParams({ terminalId })
    expect(face.keyedHooks.terminal('tab')).toBe(h.model.state)
    expect(h.terminals.view).toHaveBeenLastCalledWith(sessionId, 'tab', 'sidebar://terminal/content', terminalId, undefined)
    expect(h.occurrence).toHaveBeenLastCalledWith(sessionId, { id: 'tab' })
    if (h.closeHandler === undefined) throw new Error('Terminal close handler was not registered')
    h.closeHandler(sessionId, { id: 'tab', contentId: 'sidebar://terminal/content' } as Parameters<SidebarRightCloseHandler>[1])
    expect(h.terminals.close).toHaveBeenLastCalledWith(sessionId, 'tab', 'sidebar://terminal/content', terminalId)
    h.setParams(undefined)
    h.closeHandler(sessionId, { id: 'new-tab', contentId: 'sidebar://terminal/new' } as Parameters<SidebarRightCloseHandler>[1])
    expect(h.terminals.close).toHaveBeenLastCalledWith(sessionId, 'new-tab', 'sidebar://terminal/new', undefined)
    expect(h.terminals.recover).not.toHaveBeenCalled()
    expect(h.terminals.retryClose).not.toHaveBeenCalled()
    expect(h.openTabIn).not.toHaveBeenCalled()
  } finally {
    await h.dispose()
  }
  expect(h.closeHandler).toBeUndefined()
  expect(h.agentCloseHandler).toBeUndefined()
  expect(h.tabs.get('terminal')).toBeUndefined()
  expect(h.entries).toEqual([])
  expect(h.dictionaries.size).toBe(0)
})

it('opens a terminal for the command target and refuses without a selected Session', async () => {
  const h = await mountPlugin()
  try {
    const command = h.commands[0]!
    const input = { region: 'page', modal: null, target: null } as const
    expect(command.resolve(input)).toEqual({ status: 'blocked', reason: 'shortcut.noSession' })
    const target = { sessionId: 'terminal-session' }
    h.commandTarget.mockReturnValue(target)
    const result = command.resolve(input)
    if (result.status !== 'handled') throw new Error('Expected terminal command to be available')
    result.run()
    expect(h.openTabFromTarget).toHaveBeenCalledWith('terminal', target)
  } finally { await h.dispose() }
  expect(h.commands).toEqual([])
})

it('loads the terminal body implementation when its registered wrapper mounts', async () => {
  render(createElement(LazyTerminalBody, {} as never))
  await waitFor(() => { expect(renderedTerminal).toHaveBeenCalledOnce() })
})

it('retains terminal metadata from dormant layouts and releases its inventory subscription on unload', async () => {
  const h = await mountPlugin()
  const terminal = { sessionId: 'inactive' as SessionId, tabId: 't', kind: 'terminal', contentId: 'terminal' } as SidebarRightOpenTab
  h.openTabs.set([terminal, { ...terminal, kind: 'documentPreview', contentId: 'file' }])
  await expect.poll(() => h.terminals.retainTabs).toHaveBeenLastCalledWith([terminal])
  await h.dispose()
  expect(h.terminals.retainTabs).toHaveBeenLastCalledWith([])
  const calls = h.terminals.retainTabs.mock.calls.length
  h.openTabs.set([terminal])
  await Promise.resolve()
  expect(h.terminals.retainTabs).toHaveBeenCalledTimes(calls)
})
