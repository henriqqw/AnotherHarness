/** Edit-and-continue orchestration for one sent user message (spec session/0001 AC-5, AC-6). */

import type { Context } from '@anotherharness/cordis'
import type { SessionId } from '@anotherharness/ah-session/types'
import type { ModelSelection, ModelSelectionProjection } from '@anotherharness/ah-api-session-controller/types'
import type { ChatSnapshot } from './contract/snapshot.ts'

declare module '@anotherharness/ah-api-session-controller/client' {
  interface SessionReferenceSourceMap {
    /** An edited message waiting for its continuation Session to admit it. */
    messageEdit: unknown
  }
}

/**
 * Resolve where an edited message continues: the end of the completed turn
 * before the edited one, or undefined when the edited message opened the
 * conversation.
 * @param snapshot - the source Chat snapshot.
 * @param turn - the turn whose user message was edited.
 * @returns the fork boundary seq, or undefined for a fresh Session.
 * @throws {Error} when the previous turn has not completed.
 */
export function editBoundary(snapshot: ChatSnapshot, turn: number): number | undefined {
  const order = snapshot.timeline.turnOrder
  const index = order.indexOf(turn)
  if (index <= 0) return undefined
  const previousTurn = order[index - 1] as number
  const end = snapshot.timeline.turns.get(previousTurn)?.end?.seq
  if (end === undefined) throw new Error(`turn ${previousTurn} has not completed`)
  return end
}

/**
 * The model the source Session will use next, read before forking: a fork
 * replays history only up to its boundary, so a model switched to after that
 * point would otherwise be lost.
 * @param ctx - the Client root Context.
 * @param sourceId - the Session whose message was edited.
 * @returns the source's next model selection, or undefined when none is known.
 */
export function chosenModel(ctx: Context, sourceId: SessionId): ModelSelection | undefined {
  const projected = ctx.sessions.binding(sourceId)?.session.projections.faceOf('modelSelection').getSnapshot()
  return (projected as ModelSelectionProjection | undefined)?.next ?? undefined
}

/**
 * Continue from an edited message in a new Session: fork the source at the
 * end of the previous completed turn (or start a Session in the same
 * directory for the first message), send the edited text, open the new
 * Session, and archive the source. The child keeps the model the source
 * was on at submission, not the one it had at the fork boundary. The source
 * is archived only after the edited text was admitted, so any earlier
 * failure leaves it untouched.
 * @param ctx - the Client root Context.
 * @param sourceId - the Session whose message was edited.
 * @param snapshot - the source Chat snapshot at submission.
 * @param turn - the turn whose user message was edited.
 * @param text - the edited message text.
 * @returns the continuation Session id.
 */
export async function continueFromEdit(
  ctx: Context,
  sourceId: SessionId,
  snapshot: ChatSnapshot,
  turn: number,
  text: string,
): Promise<SessionId> {
  const boundary = editBoundary(snapshot, turn)
  const model = chosenModel(ctx, sourceId)
  const cwd = ctx.sessions.list.getSnapshot().byId[sourceId]?.cwd
  const childId = boundary === undefined
    ? await ctx.sessions.create(cwd === undefined ? {} : { cwd })
    : await ctx.sessions.fork({ sessionId: sourceId, atSeq: boundary, increaseTitle: true })
  const reference = ctx.sessions.retain(childId, { source: 'messageEdit' })
  try {
    if (model !== undefined) {
      const selected = await ctx.remote.session.selectModel({ sessionId: childId, ...model })
      // TODO(human): in message-edit.ts, replace this line with 2–5 lines
      // that handle selected.ok === false (stop + throw, or carry on silently).
      void selected
    }
    ctx.uiWorkspace.openSession(childId)
    const result = await reference.binding.session.prompt([{ type: 'text', text }], 'queue')
    if (!result.ok) throw new Error(`edited message was not admitted: ${result.error.code}`)
  } finally {
    reference[Symbol.dispose]()
  }
  await ctx.uiWorkspace.archiveSession(sourceId)
  return childId
}
