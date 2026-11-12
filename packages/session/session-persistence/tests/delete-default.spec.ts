/** Spec session/0001: backends without deletion report it unsupported. */
import { describe, expect, it } from 'vitest'
import { Context } from '@anotherharness/cordis'
import { SessionId } from '@anotherharness/ah-session'
import { SessionPersistence } from '../src/index.ts'

// Only the inherited default is under test; the abstract storage methods stay unimplemented.
const Backend = SessionPersistence as unknown as new (ctx: Context) => SessionPersistence

describe('SessionPersistence.delete default', () => {
  it('rejects for a backend that does not implement deletion', async () => {
    const backend = new Backend(new Context())
    await expect(backend.delete(SessionId('session-any'))).rejects.toThrow('cannot delete session "session-any"')
  })
})
