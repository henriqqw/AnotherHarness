/** Spec terminal/0001 AC-2 and AC-3: live views of agent terminals with take-over and give-back. */
import { Context } from '@anotherharness/cordis'
import type { Agent } from '@anotherharness/ah-agent'
import type { SessionId } from '@anotherharness/ah-session'
import type { TerminalSessionSnapshot } from '@anotherharness/ah-terminal'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TerminalController, type ConfigInput } from '../src/index.ts'
import { agentTerminalError, agentTerminalInfo } from '../src/agent-terminals.ts'
import type { TerminalFrame } from '../src/types.ts'

const roots: Context[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(ctx => ctx.fiber.dispose())) })

const base: ConfigInput = {
  shellCandidates: [], profiles: [], detectProfiles: false, maxTerminals: 4, maxCols: 200, maxRows: 100, scrollback: 100,
  maxBufferedBytes: 100_000, maxInputBytes: 8, disposeGraceMs: 100, unattendedTimeoutMs: 0,
  activityPollIntervalMs: 30_000, cleanupRetryMs: 60_000,
}

const codeError = (code: string) => Object.assign(new Error(code), { code })

function fakeTerminals() {
  const snapshots: TerminalSessionSnapshot[] = [
    { sessionId: 'pty-1' as never, name: 'build', type: 'shell', status: { kind: 'running' } },
  ]
  const listeners = new Set<(data: string) => void>()
  const terminals = {
    list: vi.fn(() => snapshots),
    observe: vi.fn((_owner: Agent, id: string, listener: (data: string) => void) => {
      if (id !== 'pty-1') throw codeError('NO_SESSION')
      listeners.add(listener)
      return { screen: 'ah> ', dispose: () => { listeners.delete(listener) } }
    }),
    takeOver: vi.fn(() => { snapshots[0] = { ...snapshots[0]!, controlledBy: 'user' } }),
    giveBack: vi.fn(() => { const { controlledBy: _drop, ...rest } = snapshots[0]!; snapshots[0] = rest }),
    userWrite: vi.fn(async (_owner: Agent, _id: string, data: string) => { if (data === 'denied') throw codeError('NOT_USER_CONTROLLED') }),
  }
  return { terminals, listeners, snapshots }
}

function setup(withTerminals = true) {
  const ctx = new Context()
  roots.push(ctx)
  ctx.provide('sandboxPolicy', { resolve: () => ({ mode: 'danger-full-access' }) } as never)
  ctx.provide('workingDirectory', { get: () => '/work', ensure: async () => '/work' } as never)
  ctx.provide('subprocess', {} as never)
  const fake = fakeTerminals()
  if (withTerminals) ctx.provide('terminals', fake.terminals as never)
  const controller = new TerminalController(ctx, TerminalController.Config(base))
  const agent = { id: 'session' as SessionId, ctx, session: { id: 'session' as SessionId, header: { cwd: '/work' } } } as unknown as Agent
  return { controller, agent, ...fake }
}

async function next(iterator: AsyncIterator<TerminalFrame>): Promise<TerminalFrame> {
  const result = await iterator.next()
  if (result.done === true) throw new Error('stream ended')
  return result.value
}

describe('agent terminals', () => {
  it('lists the agent PTY sessions, and none without a terminal service', () => {
    const { controller, agent } = setup()
    expect(controller.agentList(agent)).toEqual([{ id: 'pty-1', title: 'build', state: 'running', controlledBy: 'agent' }])
    const bare = setup(false)
    expect(bare.controller.agentList(bare.agent)).toEqual([])
  })

  it('AC-2 and AC-3: streams the screen and output, and broadcasts take-over and give-back', async () => {
    const { controller, agent, terminals, listeners } = setup()
    const abort = new AbortController()
    const stream = controller.followAgent(agent, 'pty-1', abort.signal)[Symbol.asyncIterator]()
    expect(await next(stream)).toMatchObject({ type: 'snapshot', screen: 'ah> ', info: { id: 'pty-1', title: 'build', agentControl: 'agent' } })
    for (const listener of listeners) listener('ls\n')
    expect(await next(stream)).toEqual({ type: 'output', sequence: 1, data: 'ls\n' })
    controller.takeOverAgent(agent, 'pty-1')
    expect(await next(stream)).toMatchObject({ type: 'state', info: { agentControl: 'user' } })
    await controller.writeAgent(agent, 'pty-1', 'pwd\r')
    expect(terminals.userWrite).toHaveBeenCalledWith(agent, 'pty-1', 'pwd\r')
    controller.giveBackAgent(agent, 'pty-1')
    expect(await next(stream)).toMatchObject({ type: 'state', info: { agentControl: 'agent' } })
    abort.abort()
    await stream.next()
    expect(listeners.size).toBe(0)
    controller.takeOverAgent(agent, 'pty-1')
    expect(terminals.takeOver).toHaveBeenCalledTimes(2)
  })

  it('keeps other followers streaming when one detaches, and lists user control', async () => {
    const { controller, agent, listeners } = setup()
    const first = new AbortController()
    const second = new AbortController()
    const a = controller.followAgent(agent, 'pty-1', first.signal)[Symbol.asyncIterator]()
    const b = controller.followAgent(agent, 'pty-1', second.signal)[Symbol.asyncIterator]()
    await next(a)
    await next(b)
    first.abort()
    await a.next()
    expect(listeners.size).toBe(1)
    controller.takeOverAgent(agent, 'pty-1')
    expect(await next(b)).toMatchObject({ type: 'state', info: { agentControl: 'user' } })
    expect(controller.agentList(agent)[0]).toMatchObject({ controlledBy: 'user' })
    second.abort()
    await b.next()
  })

  it('maps missing sessions and refusals, and caps input', async () => {
    const { controller, agent, terminals } = setup()
    await expect(controller.followAgent(agent, 'pty-9', new AbortController().signal)[Symbol.asyncIterator]().next())
      .rejects.toMatchObject({ code: 'terminal/unavailable' })
    terminals.list.mockReturnValueOnce([{ sessionId: 'pty-9' as never, type: 'shell', status: { kind: 'running' } }])
    await expect(controller.followAgent(agent, 'pty-9', new AbortController().signal)[Symbol.asyncIterator]().next())
      .rejects.toMatchObject({ code: 'terminal/unavailable' })
    terminals.takeOver.mockImplementationOnce(() => { throw codeError('FOREIGN_SESSION') })
    expect(() => { controller.takeOverAgent(agent, 'pty-1') }).toThrow(expect.objectContaining({ code: 'terminal/unavailable' }) as Error)
    terminals.giveBack.mockImplementationOnce(() => { throw codeError('UNSUPPORTED') })
    expect(() => { controller.giveBackAgent(agent, 'pty-1') }).toThrow('UNSUPPORTED')
    await expect(controller.writeAgent(agent, 'pty-1', 'denied')).rejects.toThrow('NOT_USER_CONTROLLED')
    await expect(controller.writeAgent(agent, 'pty-1', 'too long input')).rejects.toThrow('exceeds the configured limit')
    const bare = setup(false)
    expect(() => { bare.controller.takeOverAgent(bare.agent, 'pty-1') }).toThrow(expect.objectContaining({ code: 'terminal/unavailable' }) as Error)
  })

  it('projects exited sessions and passes unknown failures through', () => {
    expect(agentTerminalInfo({ sessionId: 'pty-2' as never, type: 'shell', status: { kind: 'exited', exitCode: 3, signal: null } }))
      .toMatchObject({ id: 'pty-2', title: 'shell', state: 'exited', exitCode: 3, agentControl: 'agent' })
    const plain = new Error('boom')
    expect(agentTerminalError(plain)).toBe(plain)
    expect(agentTerminalError('text')).toBe('text')
  })
})
