/** React-free live view of one agent PTY session, read-only until the user takes over. */
import { createSnapshotStore, type SnapshotStore } from '@anotherharness/ah-client-store'
import { RemoteStreamCarrierError, type ClientRemote, type RemoteStream } from '@anotherharness/ah-api-gateway/client'
import { RemoteError, remoteErrorOf, type RemoteResult } from '@anotherharness/ah-typert-protocol'
import type { SessionId } from '@anotherharness/ah-session/types'
import type { TerminalFrame } from '../types.ts'
import type { TerminalRemote, TerminalScreenModel, TerminalViewState } from './model.ts'

function valueOf<T>(result: RemoteResult<T>): T {
  if (!result.ok) throw result.error
  return result.value
}

/** Follows one agent terminal; input is accepted only while the user holds its keyboard. */
export class AgentTerminalView implements TerminalScreenModel {
  /** Observable screen, control, and the next screen update awaiting acknowledgement. */
  readonly state: SnapshotStore<TerminalViewState> = createSnapshotStore<TerminalViewState>({ phase: 'idle', writable: false })
  private readonly lifetime = new AbortController()
  private readonly detaching = new Set<Promise<void>>()
  private stream: RemoteStream<TerminalFrame> | undefined
  private mounted = false
  private pendingRender: { revision: number; resolve: () => void } | undefined
  private revision = 0
  private writes: Promise<void> = Promise.resolve()

  /**
   * @param sessionId - Session owning the agent terminal.
   * @param remote - typed terminal Remote operations.
   * @param gateway - reconnecting stream factory.
   * @param terminalId - the agent PTY session.
   */
  constructor(
    private readonly sessionId: SessionId,
    private readonly remote: TerminalRemote,
    private readonly gateway: Pick<ClientRemote, '$stream'>,
    readonly terminalId: string,
  ) {}

  /**
   * Attach the DOM lifetime and start following the agent terminal.
   * @returns a detach callback that leaves the agent terminal running.
   */
  mount(): () => void {
    this.mounted = true
    this.connect()
    return () => {
      this.mounted = false
      this.detach()
    }
  }

  /**
   * Reconnect after a failure.
   * @returns once the new stream was opened.
   */
  refresh(): Promise<void> {
    this.connect()
    return Promise.resolve()
  }

  /** Open a fresh stream with the retained screen. */
  connect(): void {
    if (!this.mounted || this.lifetime.signal.aborted) return
    this.detach()
    const stream = this.gateway.$stream<TerminalFrame>({
      name: 'Agent terminal output',
      open: async function* (this: AgentTerminalView, signal: AbortSignal) {
        yield* this.remote.followAgent(this.sessionId, this.terminalId, signal)
      }.bind(this),
      ended: () => new RemoteError('terminal/view', 'attachmentEnded', { issue: 'attachmentEnded' }),
      carrierFailed: () => { if (this.stream === stream) this.patch({ phase: 'disconnected', writable: false }) },
    })
    this.stream = stream
    this.patch({ phase: 'connecting', writable: false, error: undefined, issue: undefined, render: undefined })
    void this.consume(stream)
  }

  /**
   * Release the next stream item after xterm has parsed this frame.
   * @param revision - locally delivered render revision.
   */
  acknowledge(revision: number): void {
    if (this.pendingRender?.revision !== revision) return
    this.pendingRender.resolve()
    this.pendingRender = undefined
  }

  /**
   * Type into the agent terminal while the user holds its keyboard, in order.
   * @param data - input from the terminal emulator.
   */
  write(data: string): void {
    if (!this.state.getSnapshot().writable) return
    this.writes = this.writes
      .then(async () => { valueOf(await this.remote.writeAgent(this.sessionId, this.terminalId, data)) })
      .catch((error: unknown) => { this.fail(error) })
  }

  /** Agent terminals keep the agent's dimensions. */
  resize(): void {}

  /**
   * Take the keyboard; the agent's sends are refused until {@link giveBack}.
   * @returns after the Host accepted the take-over.
   */
  async takeOver(): Promise<void> {
    try { valueOf(await this.remote.takeOverAgent(this.sessionId, this.terminalId)) } catch (error) { this.fail(error) }
  }

  /**
   * Return the keyboard to the agent.
   * @returns after the Host accepted the change.
   */
  async giveBack(): Promise<void> {
    try { valueOf(await this.remote.giveBackAgent(this.sessionId, this.terminalId)) } catch (error) { this.fail(error) }
  }

  /**
   * Stop following without touching the agent terminal.
   * @returns after the stream closed.
   */
  async dispose(): Promise<void> {
    this.mounted = false
    this.lifetime.abort()
    this.detach()
    await Promise.all(this.detaching)
  }

  private detach(): void {
    const previous = this.stream
    this.stream = undefined
    this.pendingRender?.resolve()
    this.pendingRender = undefined
    if (previous !== undefined) {
      const cleanup = previous.dispose().finally(() => { this.detaching.delete(cleanup) })
      this.detaching.add(cleanup)
    }
  }

  // A replaced stream is disposed by detach(), which ends its iteration without
  // delivering buffered items or late failures, so this loop only sees its own stream.
  private async consume(stream: RemoteStream<TerminalFrame>): Promise<void> {
    let generation = 0
    try {
      for await (const item of stream) {
        const frame = item.value
        if (generation !== item.generation) {
          if (frame.type !== 'snapshot') throw new RemoteError('terminal/view', 'Agent terminal output is missing its screen', { issue: 'invalidOutput' })
          generation = item.generation
          item.accept()
        }
        if (frame.type !== 'output') {
          this.patch({
            info: frame.info, title: frame.info.title, phase: 'connected',
            writable: frame.info.state === 'running' && frame.info.agentControl === 'user',
          })
        }
        if (frame.type !== 'state') await this.render(frame, item.signal)
      }
    } catch (error) {
      this.fail(error)
    }
  }

  private render(frame: Extract<TerminalFrame, { type: 'snapshot' | 'output' }>, signal: AbortSignal): Promise<void> {
    const revision = ++this.revision
    return new Promise<void>((resolve) => {
      const aborted = (): void => { this.acknowledge(revision) }
      this.pendingRender = { revision, resolve: () => { signal.removeEventListener('abort', aborted); resolve() } }
      signal.addEventListener('abort', aborted, { once: true })
      this.patch({ render: { revision, frame } })
    })
  }

  private patch(patch: Partial<TerminalViewState>): void {
    if (this.lifetime.signal.aborted) return
    this.state.set({ ...this.state.getSnapshot(), ...patch })
  }

  private fail(error: unknown): void {
    const failure = remoteErrorOf(error)
    const issue = failure?.code === 'terminal/view' ? failure.details.issue : failure?.code === 'terminal/unavailable' ? 'missingTerminal' : undefined
    this.patch({
      phase: error instanceof RemoteStreamCarrierError ? 'disconnected' : 'failed',
      writable: false, issue, error: error instanceof Error ? error.message : String(error),
    })
  }
}
