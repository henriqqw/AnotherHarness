/** Spec session/0001 AC-5 and AC-6: edit-and-continue orchestration. */
import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@anotherharness/cordis'
import type { SessionId } from '@anotherharness/ah-session/types'
import { continueFromEdit, editBoundary } from '../src/client/message-edit.ts'
import type { ChatSnapshot } from '../src/client/contract/snapshot.ts'

const SOURCE = 'source-session' as SessionId
const CHILD = 'child-session' as SessionId

const snapshot = (turns: ReadonlyArray<readonly [number, number | undefined]>): ChatSnapshot => ({
  timeline: {
    turnOrder: turns.map(([turn]) => turn),
    turns: new Map(turns.map(([turn, end]) => [turn, end === undefined ? {} : { end: { seq: end } }])),
  },
}) as never

function harness(options: { cwd?: string; promptOk?: boolean } = {}) {
  const dispose = vi.fn()
  const prompt = vi.fn(() => Promise.resolve(options.promptOk === false
    ? { ok: false, error: { code: 'session/busy', message: 'busy' } }
    : { ok: true, value: { accepted: true } }))
  const sessions = {
    list: { getSnapshot: () => ({ byId: options.cwd === undefined ? {} : { [SOURCE]: { cwd: options.cwd } } }) },
    create: vi.fn(() => Promise.resolve(CHILD)),
    fork: vi.fn(() => Promise.resolve(CHILD)),
    retain: vi.fn(() => ({ binding: { session: { prompt } }, [Symbol.dispose]: dispose })),
  }
  const uiWorkspace = { openSession: vi.fn(), archiveSession: vi.fn(() => Promise.resolve()) }
  const ctx = { sessions, uiWorkspace } as never as Context
  return { ctx, sessions, uiWorkspace, prompt, dispose }
}

describe('editBoundary', () => {
  it('continues after the previous completed turn, or fresh for the opening turn', () => {
    const chat = snapshot([[1, 10], [2, 20], [3, undefined]])
    expect(editBoundary(chat, 1)).toBeUndefined()
    expect(editBoundary(chat, 9)).toBeUndefined()
    expect(editBoundary(chat, 3)).toBe(20)
    expect(() => editBoundary(snapshot([[1, undefined], [2, undefined]]), 2)).toThrow('turn 1 has not completed')
  })
})

describe('continueFromEdit', () => {
  it('AC-5: forks at the previous turn end, sends the edit, opens the child, then archives the source', async () => {
    const h = harness({ cwd: '/proj' })
    expect(await continueFromEdit(h.ctx, SOURCE, snapshot([[1, 10], [2, 20], [3, 30]]), 3, 'edited')).toBe(CHILD)
    expect(h.sessions.fork).toHaveBeenCalledWith({ sessionId: SOURCE, atSeq: 20, increaseTitle: true })
    expect(h.sessions.create).not.toHaveBeenCalled()
    expect(h.sessions.retain).toHaveBeenCalledWith(CHILD, { source: 'messageEdit' })
    expect(h.uiWorkspace.openSession).toHaveBeenCalledWith(CHILD)
    expect(h.prompt).toHaveBeenCalledWith([{ type: 'text', text: 'edited' }], 'queue')
    expect(h.dispose).toHaveBeenCalledOnce()
    expect(h.uiWorkspace.archiveSession).toHaveBeenCalledWith(SOURCE)
  })

  it('AC-6: starts a Session in the same directory when the first message is edited', async () => {
    const h = harness({ cwd: '/proj' })
    await continueFromEdit(h.ctx, SOURCE, snapshot([[1, 10]]), 1, 'first')
    expect(h.sessions.create).toHaveBeenCalledWith({ cwd: '/proj' })
    expect(h.sessions.fork).not.toHaveBeenCalled()
    const bare = harness()
    await continueFromEdit(bare.ctx, SOURCE, snapshot([[1, 10]]), 1, 'first')
    expect(bare.sessions.create).toHaveBeenCalledWith({})
  })

  it('leaves the source unarchived when the edited message is not admitted', async () => {
    const h = harness({ promptOk: false })
    await expect(continueFromEdit(h.ctx, SOURCE, snapshot([[1, 10], [2, 20]]), 2, 'edited'))
      .rejects.toThrow('edited message was not admitted: session/busy')
    expect(h.dispose).toHaveBeenCalledOnce()
    expect(h.uiWorkspace.archiveSession).not.toHaveBeenCalled()
  })
})
