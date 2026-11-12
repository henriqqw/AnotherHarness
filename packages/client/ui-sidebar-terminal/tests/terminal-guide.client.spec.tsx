// @vitest-environment jsdom
/** Guide shell discovery, direct launch and cancellation stay within the entry lifetime. */
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { makeTranslate } from '@anotherharness/ah-client-test-runtime'
import type { TerminalLaunchShells } from '@anotherharness/ah-api-terminal-controller/client'
import type { GlobalStandardProps, SessionStandardProps } from '@anotherharness/ah-client-ui-slots'
import type { SessionId } from '@anotherharness/ah-session/types'
import type { PaneId, TabId } from '@anotherharness/ah-client-ui-dockkit'
import type { ShortcutCommandId, ShortcutCatalogEntry } from '@anotherharness/ah-client-shortcuts/client'
import { TerminalGuide, type TerminalGuideProps } from '../src/client/TerminalGuide.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)
const SESSION = 's-terminal-guide' as SessionId
const unused = (): never => { throw new Error('This isolated component does not consume framework hooks') }
const standard: GlobalStandardProps & SessionStandardProps = {
  sessionId: SESSION, useSession: unused, useProjection: unused, useConversation: unused,
  useInput: unused, useChat: unused, useTrajectory: unused,
  usePanelInfo: unused, useSessions: unused, useSessionStatus: unused,
  useSessionRetainInfo: unused, useResource: unused, useWorkspaces: unused,
  inputActions: { captureInsertion: unused, insertText: unused, setDraft: unused, persistDraft: unused,
    addAttachments: unused, removeAttachment: unused, pruneAttachments: unused, submit: unused },
}
const choices: TerminalLaunchShells = {
  shells: [
    { id: 'bash', name: 'bash', path: '/bin/bash', args: ['-i'], icon: 'bash', source: 'detected' },
    { id: 'wsl-ubuntu', name: 'Ubuntu (WSL)', path: 'wsl.exe', args: ['-d', 'Ubuntu'], icon: 'wsl', source: 'detected' },
    { id: 'zsh', name: 'zsh', path: '/bin/zsh', args: ['-i'], icon: 'zsh', source: 'detected' },
  ],
  selectedShell: 'zsh',
  defaultProfileId: 'wsl-ubuntu',
}

type GuideShortcut = Pick<ShortcutCatalogEntry, 'keys' | 'aria'>
const catalogEntry = (shortcut: GuideShortcut): ShortcutCatalogEntry => ({
  id: 'terminal.new' as ShortcutCommandId, label: en.new, aliases: [], binding: null,
  modified: false, conflicts: [], issue: null, ...shortcut,
})

function mount(description: string | undefined = en.description, shortcut?: GuideShortcut, setDefaultProfile?: TerminalGuideProps['setDefaultProfile']) {
  const loadShells = vi.fn<TerminalGuideProps['loadShells']>(async () => choices)
  const selectShell = vi.fn()
  const openTab = vi.fn()
  let shortcuts = shortcut === undefined ? [] : [catalogEntry(shortcut)]
  const props: TerminalGuideProps = {
    ...standard,
    useShortcuts: <T,>(selector: (entries: readonly ShortcutCatalogEntry[]) => T): T => selector(shortcuts),
    entryId: 'new', kind: 'terminal', title: en.new, description, t: makeTranslate(en),
    useTabInfo: () => ({ sidebar: { expanded: true, fullscreen: false }, panel: { id: 'pane-guide' as PaneId },
      tab: { id: 'tab-guide' as TabId, kind: 'guide', contentId: 'sidebar://guide', title: 'Start',
        visible: true, signal: new AbortController().signal,
        navigation: { address: 'sidebar://guide', params: undefined, revision: 0 },
        actions: { openTab, bindCommands: vi.fn(() => vi.fn()), openResource: vi.fn(), close: vi.fn() } } }),
    loadShells, selectShell, setDefaultProfile,
  }
  const view = render(<TerminalGuide {...props} />)
  const open = () => fireEvent.click(view.getByRole('button', { name: en.shell }))
  const setShortcut = (next: GuideShortcut) => {
    shortcuts = [catalogEntry(next)]
    view.rerender(<TerminalGuide {...props} />)
  }
  return { view, props, open, loadShells, selectShell, openTab, setShortcut }
}

it('opens the default shell from the main button without querying a menu', () => {
  const h = mount()
  fireEvent.click(h.view.getByRole('button', { name: /^New terminal/u }))
  expect(h.openTab).toHaveBeenCalledExactlyOnceWith('terminal', { replaceTab: true })
  expect(h.loadShells).not.toHaveBeenCalled()
  expect(h.view.container.querySelector('button button')).toBeNull()
})

it.each(['hover', 'focus'] as const)('keeps the terminal shortcut inline without a tooltip on %s after rebinding', (trigger) => {
  const h = mount(en.description, { keys: ['Ctrl', '`'], aria: 'Control+`' })
  const button = h.view.getByRole('button', { name: /^New terminal/u })
  if (trigger === 'hover') fireEvent.mouseEnter(button)
  else fireEvent.focus(button)
  expect(h.view.queryByRole('tooltip')).toBeNull()
  expect(Array.from(h.view.container.querySelectorAll('kbd'), key => key.textContent)).toEqual(['Ctrl', '`'])
  expect(button.getAttribute('aria-keyshortcuts')).toBe('Control+`')

  h.setShortcut({ keys: ['Alt', 'T'], aria: 'Alt+t' })
  expect(h.view.queryByRole('tooltip')).toBeNull()
  expect(Array.from(h.view.container.querySelectorAll('kbd'), key => key.textContent)).toEqual(['Alt', 'T'])
  expect(button.getAttribute('aria-keyshortcuts')).toBe('Alt+t')

  h.setShortcut({ keys: [], aria: undefined })
  expect(h.view.queryByRole('tooltip')).toBeNull()
  expect(button.hasAttribute('aria-keyshortcuts')).toBe(false)
  if (trigger === 'hover') fireEvent.mouseLeave(button)
  else fireEvent.blur(button)
  expect(h.view.queryByRole('tooltip')).toBeNull()
})

it('loads on demand, remembers a selected shell before opening, and cancels on menu dismissal', async () => {
  const h = mount()
  h.open()
  await h.view.findByRole('menuitem', { name: 'zsh' })
  expect(h.view.getByRole('menuitem', { name: 'Ubuntu (WSL) (default)' })).toBeTruthy()
  expect(h.openTab).not.toHaveBeenCalled()
  const signal = h.loadShells.mock.calls[0]![0]
  h.selectShell.mockImplementation(() => { expect(h.openTab).not.toHaveBeenCalled() })
  fireEvent.click(h.view.getByRole('menuitem', { name: 'bash' }))
  expect(h.selectShell).toHaveBeenCalledExactlyOnceWith('bash')
  expect(h.openTab).toHaveBeenCalledExactlyOnceWith('terminal', { replaceTab: true, params: { profileId: 'bash' } })
  expect(signal.aborted).toBe(true)
  h.open()
  await h.view.findByRole('menuitem', { name: 'bash' })
  fireEvent.keyDown(h.view.getByRole('menu'), { key: 'Escape' })
  expect(h.view.queryByRole('menu')).toBeNull()
  expect(h.loadShells.mock.calls[1]![0].aborted).toBe(true)
})

it('stores the preselected profile as the Host default, and offers nothing when it already is', async () => {
  const setDefaultProfile = vi.fn(async () => true)
  const h = mount(en.description, undefined, setDefaultProfile)
  h.open()
  fireEvent.click(await h.view.findByRole('menuitem', { name: 'Make zsh the default' }))
  expect(setDefaultProfile).toHaveBeenCalledExactlyOnceWith('zsh')
  expect(h.selectShell).not.toHaveBeenCalled()
  expect(h.openTab).not.toHaveBeenCalled()
  h.loadShells.mockResolvedValue({ ...choices, defaultProfileId: 'zsh' })
  h.open()
  await h.view.findByRole('menuitem', { name: 'zsh (default)' })
  expect(h.view.queryByRole('menuitem', { name: 'Make zsh the default' })).toBeNull()
  h.view.unmount()
  const plain = mount()
  plain.open()
  await plain.view.findAllByRole('menuitem', { name: 'bash' })
  expect(plain.view.queryByRole('menuitem', { name: /the default/u })).toBeNull()
})

it.each([new Error('offline'), 'offline'])('offers an in-place retry after discovery fails: %s', async (error) => {
  const h = mount()
  h.loadShells.mockRejectedValueOnce(error)
  h.open()
  await h.view.findByText('Terminal error: offline')
  fireEvent.click(h.view.getByRole('menuitem', { name: en.retry }))
  await h.view.findByRole('menuitem', { name: 'bash' })
  expect(h.loadShells).toHaveBeenCalledTimes(2)
  expect(h.openTab).not.toHaveBeenCalled()
})

it('shows empty discovery without opening a terminal and supports title-only cards', async () => {
  const h = mount()
  const { description: _description, ...titleOnly } = h.props
  h.view.rerender(<TerminalGuide {...titleOnly} />)
  h.loadShells.mockResolvedValue({ shells: [], selectedShell: undefined })
  h.open()
  await h.view.findByText(en.shellEmpty)
  expect(h.view.queryByText(en.description)).toBeNull()
  expect(h.openTab).not.toHaveBeenCalled()
})

it.each(['resolve', 'reject'] as const)('ignores a late %s after a loading entry unmounts', async (outcome) => {
  const h = mount()
  const pending = Promise.withResolvers<TerminalLaunchShells>()
  h.loadShells.mockReturnValue(pending.promise)
  h.open()
  expect(h.view.getByText(en.shellLoading)).toBeDefined()
  const signal = h.loadShells.mock.calls[0]![0]
  h.view.unmount()
  expect(signal.aborted).toBe(true)
  await act(async () => {
    if (outcome === 'resolve') pending.resolve(choices)
    else pending.reject(new Error('late failure'))
    await pending.promise.catch((_lateDiscoveryFailure: unknown) => {
      /* The cancelled entry consumes the rejection without publishing it. */
    })
  })
  expect(h.openTab).not.toHaveBeenCalled()
})
