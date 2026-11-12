/** Spec terminal/0001 AC-2 and AC-3 in the browser: following an agent terminal and taking it over. */
import { afterEach, expect, it, vi } from 'vitest'
import { RemoteStream, RemoteStreamCarrierError, type ClientRemote, type RemoteStreamOptions } from '@anotherharness/ah-api-gateway/client'
import { createSnapshotStore } from '@anotherharness/ah-client-store'
import { RemoteError, type RemoteResult } from '@anotherharness/ah-typert-protocol'
import { streamMethod } from '@anotherharness/ah-remote-mock'
import type {} from '@anotherharness/ah-api-terminal-controller/remote'
import type { SessionId } from '@anotherharness/ah-session/types'
import { AgentTerminalView } from '../src/client/agent-view.ts'
import type { TerminalRemote } from '../src/client/model.ts'
import type { TerminalFrame, WebTerminalId, WebTerminalInfo } from '../src/types.ts'

const sessionId = 'session' as SessionId
const info = (agentControl: 'agent' | 'user', state: WebTerminalInfo['state'] = 'running'): WebTerminalInfo => ({
  id: 'pty-1' as WebTerminalId, shell: { name: 'shell', path: 'shell', args: [] }, title: 'build', cwd: '', rows: 24, cols: 80,
  state, exitCode: null, agentControl,
})
const success = <T>(value: T): RemoteResult<T> => ({ ok: true, value })
const cleanups: (() => void | Promise<void>)[] = []
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close() })

function fixture(frames: (signal?: AbortSignal) => AsyncGenerator<TerminalFrame>) {
  const remote = {
    followAgent: vi.fn<TerminalRemote['followAgent']>(streamMethod<TerminalRemote['followAgent']>(async function* (_session, _id, signal) {
      yield* frames(signal)
    })),
    writeAgent: vi.fn<TerminalRemote['writeAgent']>(async () => success(undefined)),
    takeOverAgent: vi.fn<TerminalRemote['takeOverAgent']>(async () => success(undefined)),
    giveBackAgent: vi.fn<TerminalRemote['giveBackAgent']>(async () => success(undefined)),
  } as unknown as TerminalRemote
  const streams: RemoteStream<unknown>[] = []
  const options: RemoteStreamOptions<unknown>[] = []
  const generation = createSnapshotStore<ReturnType<ConstructorParameters<typeof RemoteStream>[0]['generation']['getSnapshot']>>(undefined)
  const gateway: Pick<ClientRemote, '$stream'> = {
    $stream: (option) => {
      options.push(option)
      const stream = new RemoteStream({ generation }, option)
      streams.push(stream)
      return stream
    },
  }
  cleanups.push(async () => { await Promise.all(streams.map(stream => stream.dispose())) })
  const view = new AgentTerminalView(sessionId, remote, gateway, 'pty-1')
  cleanups.push(() => view.dispose())
  return { view, remote, streams, options }
}

function untilAborted(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) resolve()
    else signal?.addEventListener('abort', () => { resolve() }, { once: true })
  })
}

function acknowledge(view: AgentTerminalView): void {
  const render = view.state.getSnapshot().render
  if (render !== undefined) view.acknowledge(render.revision)
}

it('follows the agent screen read-only, becomes writable after take-over, and gives control back', async () => {
  const control = { value: 'agent' as 'agent' | 'user' }
  const wake = { next: undefined as (() => void) | undefined }
  const { view, remote } = fixture(async function* (signal) {
    const aborted = (): boolean => signal?.aborted === true
    yield { type: 'snapshot', sequence: 0, screen: 'ah> ', info: info('agent') }
    yield { type: 'output', sequence: 1, data: 'ls\r\n' }
    while (!aborted()) {
      await new Promise<void>((resolve) => { wake.next = resolve; void untilAborted(signal).then(resolve) })
      if (aborted()) return
      yield { type: 'state', info: info(control.value) }
    }
  })
  const detach = view.mount()
  await expect.poll(() => view.state.getSnapshot().render?.frame.type).toBe('snapshot')
  expect(view.state.getSnapshot()).toMatchObject({ phase: 'connected', writable: false, title: 'build' })
  view.write('ignored')
  expect(remote.writeAgent).not.toHaveBeenCalled()
  acknowledge(view)
  await expect.poll(() => view.state.getSnapshot().render?.frame.type).toBe('output')
  acknowledge(view)
  view.resize()

  await view.takeOver()
  expect(remote.takeOverAgent).toHaveBeenCalledWith(sessionId, 'pty-1')
  control.value = 'user'
  wake.next?.()
  await expect.poll(() => view.state.getSnapshot().writable).toBe(true)
  view.write('pwd\r')
  await expect.poll(() => vi.mocked(remote.writeAgent).mock.calls.length).toBe(1)
  expect(remote.writeAgent).toHaveBeenCalledWith(sessionId, 'pty-1', 'pwd\r')

  await view.giveBack()
  expect(remote.giveBackAgent).toHaveBeenCalledWith(sessionId, 'pty-1')
  control.value = 'agent'
  wake.next?.()
  await expect.poll(() => view.state.getSnapshot().writable).toBe(false)
  view.acknowledge(-1)
  detach()
  view.connect()
  await view.refresh()
})

it('reports a missing agent terminal and Remote refusals', async () => {
  const { view, remote } = fixture(async function* () {
    throw new RemoteError('terminal/unavailable', 'Agent terminal no longer exists in this Session', {})
  })
  view.mount()
  await expect.poll(() => view.state.getSnapshot().issue).toBe('missingTerminal')
  expect(view.state.getSnapshot().phase).toBe('failed')
  vi.mocked(remote.takeOverAgent).mockResolvedValueOnce({ ok: false, error: new RemoteError('terminal/unavailable', 'gone', {}) })
  await view.takeOver()
  expect(view.state.getSnapshot().issue).toBe('missingTerminal')
  vi.mocked(remote.giveBackAgent).mockRejectedValueOnce('plain')
  await view.giveBack()
  expect(view.state.getSnapshot()).toMatchObject({ error: 'plain', issue: undefined })
})

it('rejects a generation without its screen and surfaces input failures', async () => {
  const bad = fixture(async function* () {
    yield { type: 'output', sequence: 1, data: 'x' }
  })
  bad.view.mount()
  await expect.poll(() => bad.view.state.getSnapshot().issue).toBe('invalidOutput')

  const { view, remote } = fixture(async function* (signal) {
    yield { type: 'snapshot', sequence: 0, screen: '', info: info('user') }
    await untilAborted(signal)
  })
  view.mount()
  await expect.poll(() => view.state.getSnapshot().writable).toBe(true)
  vi.mocked(remote.writeAgent).mockRejectedValueOnce(new RemoteStreamCarrierError('offline'))
  view.write('x')
  await expect.poll(() => view.state.getSnapshot().phase).toBe('disconnected')
})

it('marks a finished stream as ended and ignores late frames after dispose', async () => {
  const { view } = fixture(async function* () {
    yield { type: 'snapshot', sequence: 0, screen: 'done', info: info('agent', 'exited') }
  })
  view.mount()
  await expect.poll(() => view.state.getSnapshot().render?.frame.type).toBe('snapshot')
  acknowledge(view)
  await expect.poll(() => view.state.getSnapshot().issue).toBe('attachmentEnded')
  await view.dispose()
  view.connect()
  expect(view.state.getSnapshot().issue).toBe('attachmentEnded')
})

it('replaces its stream on reconnect, survives a restarted generation, and ignores stale failures', async () => {
  let opened = 0
  const { view, streams, options } = fixture(async function* (signal) {
    opened += 1
    yield { type: 'snapshot', sequence: 0, screen: `screen ${opened}`, info: info('agent') }
    await untilAborted(signal)
    throw new Error('stale stream failed')
  })
  view.mount()
  await expect.poll(() => view.state.getSnapshot().render?.frame.type).toBe('snapshot')
  streams[0]!.restart()
  await expect.poll(() => opened).toBe(2)
  await expect.poll(() => (view.state.getSnapshot().render?.frame as { screen?: string } | undefined)?.screen).toBe('screen 2')
  acknowledge(view)
  view.connect()
  await expect.poll(() => opened).toBe(3)
  options[0]!.carrierFailed?.(new RemoteStreamCarrierError('late old failure'))
  expect(view.state.getSnapshot().phase).not.toBe('disconnected')
  options[1]!.carrierFailed?.(new RemoteStreamCarrierError('offline'))
  expect(view.state.getSnapshot()).toMatchObject({ phase: 'disconnected', writable: false })
  await view.dispose()
  await view.takeOver()
  expect(view.state.getSnapshot().phase).toBe('disconnected')
})

it('drops buffered frames and failures of a replaced stream, and stays quiet after dispose', async () => {
  let opened = 0
  const { view, remote } = fixture(async function* (signal) {
    opened += 1
    yield { type: 'snapshot', sequence: 0, screen: `screen ${opened}`, info: info('agent') }
    yield { type: 'output', sequence: 1, data: `buffered ${opened}` }
    await untilAborted(signal)
    throw new Error(`stream ${opened} failed late`)
  })
  view.mount()
  await expect.poll(() => view.state.getSnapshot().render?.frame.type).toBe('snapshot')
  view.connect()
  await expect.poll(() => opened).toBe(2)
  await expect.poll(() => (view.state.getSnapshot().render?.frame as { screen?: string } | undefined)?.screen).toBe('screen 2')
  expect(view.state.getSnapshot().error).toBeUndefined()
  await view.dispose()
  vi.mocked(remote.takeOverAgent).mockRejectedValueOnce(new Error('after dispose'))
  await view.takeOver()
  expect(view.state.getSnapshot().error).toBeUndefined()
})
