import { describe, expect, it } from 'vitest'
import { Context } from '@anotherharness/cordis'
import SessionStore, { SessionId } from '@anotherharness/ah-session'
import TypertRegistry from '@anotherharness/ah-typert-registry'

describe('Session Typert provider', () => {
  it('contributes live Session lookup in either service load order', async () => {
    const ctx = new Context()
    const sessionFiber = ctx.plugin(SessionStore)
    await sessionFiber
    await ctx.plugin(TypertRegistry)
    const session = ctx.sessions.create(SessionId('remote-session'))

    const lookup = ctx.typert.lookups.get('session')
    expect(lookup).toMatchObject({
      parameter: 'session',
      wire: 'sessionId',
      hostTypeSymbol: '@anotherharness/ah-session#Session',
      wireTypeSymbol: '@anotherharness/ah-session/types#SessionId',
    })
    expect(lookup?.resolve(session.id)).toBe(session)

    await sessionFiber.dispose()
    expect(ctx.typert.lookups.get('session')).toBeUndefined()
  })
})
