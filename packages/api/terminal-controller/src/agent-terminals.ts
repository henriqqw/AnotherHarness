/** Live, read-only views of the agent's own PTY sessions, with an explicit user take-over. */
import type { Agent } from '@anotherharness/ah-agent'
import type { TerminalSessionId, TerminalSessionService, TerminalSessionSnapshot } from '@anotherharness/ah-terminal'
import { RemoteError } from '@anotherharness/ah-typert-protocol'
import { TerminalFollower } from './stream.ts'
import type { AgentTerminalInfo, TerminalFrame, WebTerminalId, WebTerminalInfo } from './types.ts'

/** Terminal service failures that mean the session is gone or belongs elsewhere. */
const UNAVAILABLE_CODES = new Set(['NO_SESSION', 'FOREIGN_SESSION'])

/**
 * Map a terminal service failure to the controller's Remote vocabulary.
 * @param error - the failure.
 * @returns a `terminal/unavailable` Remote error for missing sessions, otherwise the original error.
 */
export function agentTerminalError(error: unknown): unknown {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
  if (typeof code === 'string' && UNAVAILABLE_CODES.has(code)) {
    return new RemoteError('terminal/unavailable', 'Agent terminal no longer exists in this Session', {})
  }
  return error
}

/**
 * Project one agent PTY snapshot onto the browser terminal metadata.
 * @param snapshot - the terminal service snapshot.
 * @returns metadata with the agent control marker.
 */
export function agentTerminalInfo(snapshot: TerminalSessionSnapshot): WebTerminalInfo {
  const exited = snapshot.status.kind === 'exited'
  return {
    id: snapshot.sessionId as string as WebTerminalId,
    title: snapshot.name ?? snapshot.type,
    shell: { path: snapshot.type, name: snapshot.type, args: [] },
    cwd: '',
    cols: 80,
    rows: 24,
    state: exited ? 'exited' : 'running',
    exitCode: snapshot.status.kind === 'exited' ? snapshot.status.exitCode : null,
    agentControl: snapshot.controlledBy ?? 'agent',
  }
}

/** Bridges the agent's PTY sessions to browser streams and user control. */
export class AgentTerminals {
  private readonly followers = new Map<string, Set<TerminalFollower>>()

  /** @param maxBufferedBytes - queued output bound for one follower. */
  constructor(private readonly maxBufferedBytes: number) {}

  /**
   * List the agent's PTY sessions.
   * @param terminals - the terminal service, when mounted.
   * @param agent - the conversation's agent.
   * @returns one entry per session, or none without the service.
   */
  list(terminals: TerminalSessionService | undefined, agent: Agent): AgentTerminalInfo[] {
    return (terminals?.list(agent) ?? []).map((snapshot) => {
      const info = agentTerminalInfo(snapshot)
      return { id: info.id, title: info.title, state: info.state, controlledBy: snapshot.controlledBy ?? 'agent' }
    })
  }

  /**
   * Stream one agent session: its retained screen, then output and control changes.
   * @param terminals - the terminal service.
   * @param agent - the session owner.
   * @param id - the PTY session.
   * @param signal - stream cancellation; never stops the session.
   * @yields the snapshot, output, and state frames.
   */
  async *follow(terminals: TerminalSessionService, agent: Agent, id: string, signal: AbortSignal): AsyncIterable<TerminalFrame> {
    signal.throwIfAborted()
    const follower = new TerminalFollower(this.maxBufferedBytes)
    let sequence = 0
    const snapshot = this.snapshot(terminals, agent, id)
    let attachment
    try {
      attachment = terminals.observe(agent, id as TerminalSessionId, (data) => {
        sequence += 1
        follower.push({ type: 'output', sequence, data })
      })
    } catch (error) {
      throw agentTerminalError(error)
    }
    const key = this.key(agent, id)
    const watchers = this.followers.get(key) ?? new Set<TerminalFollower>()
    this.followers.set(key, watchers)
    watchers.add(follower)
    try {
      yield { type: 'snapshot', sequence, screen: attachment.screen, info: agentTerminalInfo(snapshot) }
      yield* follower.read(signal)
    } finally {
      attachment.dispose()
      watchers.delete(follower)
      if (watchers.size === 0) this.followers.delete(key)
    }
  }

  /**
   * Give the user the keyboard and tell every follower.
   * @param terminals - the terminal service.
   * @param agent - the session owner.
   * @param id - the PTY session.
   */
  takeOver(terminals: TerminalSessionService, agent: Agent, id: string): void {
    this.run(() => { terminals.takeOver(agent, id as TerminalSessionId) })
    this.broadcast(terminals, agent, id)
  }

  /**
   * Return the keyboard to the agent and tell every follower.
   * @param terminals - the terminal service.
   * @param agent - the session owner.
   * @param id - the PTY session.
   */
  giveBack(terminals: TerminalSessionService, agent: Agent, id: string): void {
    this.run(() => { terminals.giveBack(agent, id as TerminalSessionId) })
    this.broadcast(terminals, agent, id)
  }

  /**
   * Deliver user input to a session the user controls.
   * @param terminals - the terminal service.
   * @param agent - the session owner.
   * @param id - the PTY session.
   * @param data - raw input.
   * @returns when the backend accepted the input.
   */
  async write(terminals: TerminalSessionService, agent: Agent, id: string, data: string): Promise<void> {
    try {
      await terminals.userWrite(agent, id as TerminalSessionId, data)
    } catch (error) {
      throw agentTerminalError(error)
    }
  }

  private snapshot(terminals: TerminalSessionService, agent: Agent, id: string): TerminalSessionSnapshot {
    const snapshot = terminals.list(agent).find(candidate => candidate.sessionId === id)
    if (snapshot === undefined) throw new RemoteError('terminal/unavailable', 'Agent terminal no longer exists in this Session', {})
    return snapshot
  }

  private broadcast(terminals: TerminalSessionService, agent: Agent, id: string): void {
    const watchers = this.followers.get(this.key(agent, id))
    if (watchers === undefined) return
    const info = agentTerminalInfo(this.snapshot(terminals, agent, id))
    for (const follower of watchers) follower.push({ type: 'state', info })
  }

  private run(operation: () => void): void {
    try {
      operation()
    } catch (error) {
      throw agentTerminalError(error)
    }
  }

  private key(agent: Agent, id: string): string {
    return `${agent.id}\u0000${id}`
  }
}
