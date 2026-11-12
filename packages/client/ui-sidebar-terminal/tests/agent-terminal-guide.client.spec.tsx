// @vitest-environment jsdom
/** Spec terminal/0001 AC-2: listing the agent's terminals and opening one as a tab. */
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { makeTranslate } from '@anotherharness/ah-client-test-runtime'
import type { AgentTerminalInfo } from '@anotherharness/ah-api-terminal-controller/types'
import { AgentTerminalGuide, type AgentTerminalGuideProps } from '../src/client/AgentTerminalGuide.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const terminals: AgentTerminalInfo[] = [
  { id: 'pty-1' as never, title: 'build', state: 'running', controlledBy: 'agent' },
  { id: 'pty-2' as never, title: 'server', state: 'running', controlledBy: 'user' },
]

function mount(load: AgentTerminalGuideProps['loadAgentTerminals'], description: string | undefined = en.agentDescription) {
  const openTab = vi.fn()
  const props = {
    entryId: 'agents', kind: 'agent-terminal', title: en.agentTitle, description, t: makeTranslate(en),
    useTabInfo: () => ({ tab: { id: 'guide', actions: { openTab } } }),
    loadAgentTerminals: load,
  } as unknown as AgentTerminalGuideProps
  const view = render(<AgentTerminalGuide {...props} />)
  return { view, openTab, open: () => { fireEvent.click(view.getByRole('button', { name: en.agentChoose })) } }
}

it('lists agent terminals on demand and opens the chosen one as an agent tab', async () => {
  const load = vi.fn<AgentTerminalGuideProps['loadAgentTerminals']>(async () => terminals)
  const h = mount(load)
  h.open()
  await h.view.findByRole('menuitem', { name: 'build' })
  expect(h.view.getByRole('menuitem', { name: 'server (you control)' })).toBeTruthy()
  fireEvent.click(h.view.getByRole('menuitem', { name: 'build' }))
  expect(h.openTab).toHaveBeenCalledExactlyOnceWith('agent-terminal', { replaceTab: true, params: { terminalId: 'pty-1' } })
  fireEvent.click(h.view.getByRole('button', { name: `${en.agentTitle} ${en.agentDescription}` }))
  await h.view.findByRole('menuitem', { name: 'build' })
  fireEvent.keyDown(h.view.getByRole('menu'), { key: 'Escape' })
  expect(load.mock.calls.at(-1)![0].aborted).toBe(true)
})

it('shows loading and an empty list, and retries after a failure', async () => {
  const pending = Promise.withResolvers<readonly AgentTerminalInfo[]>()
  const load = vi.fn<AgentTerminalGuideProps['loadAgentTerminals']>()
    .mockReturnValueOnce(pending.promise)
    .mockRejectedValueOnce(new Error('offline'))
    .mockRejectedValueOnce('plain')
    .mockResolvedValue(terminals)
  const h = mount(load, undefined)
  h.open()
  expect(h.view.getByRole('menuitem', { name: en.agentLoading })).toBeTruthy()
  pending.resolve([])
  await h.view.findByRole('menuitem', { name: en.agentEmpty })
  fireEvent.keyDown(h.view.getByRole('menu'), { key: 'Escape' })
  h.open()
  await h.view.findByRole('menuitem', { name: en.retry })
  fireEvent.click(h.view.getByRole('menuitem', { name: en.retry }))
  await h.view.findByRole('menuitem', { name: en.retry })
  fireEvent.click(h.view.getByRole('menuitem', { name: en.retry }))
  await h.view.findByRole('menuitem', { name: 'build' })
  expect(h.openTab).not.toHaveBeenCalled()
})
