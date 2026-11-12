/** Spec session/0001 AC-7, AC-8, AC-9 at the persistence boundary. */
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@anotherharness/cordis'
import { SessionAlreadyOwnedError } from '@anotherharness/ah-session-persistence'
import { SessionId, SessionSeq } from '@anotherharness/ah-session'
import { afterEach, describe, expect, it } from 'vitest'
import JsonlSessionPersistence from '../src/index.ts'

const roots: string[] = []
const contexts: Context[] = []
afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

async function persistence() {
  const root = await mkdtemp(join(tmpdir(), 'ah-delete-'))
  roots.push(root)
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(JsonlSessionPersistence, { root, compression: 'none' })
  return { root, store: ctx.sessionPersistence }
}

const header = (id: string, cwd: string) => ({
  version: 4 as const, id: SessionId(id), createdAt: 1, cwd, isSeeded: false, delegationDepth: 0,
})

async function materialize(store: Awaited<ReturnType<typeof persistence>>['store'], id: string, cwd: string) {
  const handle = await store.create(header(id, cwd))
  await handle.append([{ type: 'turn/start', seq: SessionSeq(0), time: 1, data: { turn: 1 } }] as never)
  await handle.close()
}

describe('JSONL Session deletion', () => {
  it('AC-7: removes a stored Session and its emptied project directory', async () => {
    const { root, store } = await persistence()
    await materialize(store, 'session-a', '/work/project')
    await materialize(store, 'session-b', '/work/project')
    expect(await store.delete(SessionId('session-a'))).toBe(true)
    expect(await store.stat(SessionId('session-a'))).toBeUndefined()
    expect((await store.list()).map(snapshot => snapshot.header.id)).toEqual(['session-b'])
    expect(await store.delete(SessionId('session-b'))).toBe(true)
    expect(await readdir(root)).toEqual([])
  })

  it('reports an absent Session without removing anything', async () => {
    const { store } = await persistence()
    await materialize(store, 'session-kept', '/work/kept')
    expect(await store.delete(SessionId('session-missing'))).toBe(false)
    expect(await store.stat(SessionId('session-kept'))).toBeDefined()
  })

  it('AC-8: refuses a Session whose write handle is open and keeps it intact', async () => {
    const { store } = await persistence()
    await materialize(store, 'session-open', '/work/open')
    const handle = await store.open(SessionId('session-open'), 'write')
    await expect(store.delete(SessionId('session-open'))).rejects.toBeInstanceOf(SessionAlreadyOwnedError)
    await handle.close()
    expect(await store.stat(SessionId('session-open'))).toBeDefined()
    expect(await store.delete(SessionId('session-open'))).toBe(true)
  })

  it('honors cancellation before removal', async () => {
    const { store } = await persistence()
    await materialize(store, 'session-cancel', '/work/cancel')
    const controller = new AbortController()
    controller.abort(new Error('cancelled'))
    await expect(store.delete(SessionId('session-cancel'), { signal: controller.signal })).rejects.toThrow('cancelled')
    expect(await store.stat(SessionId('session-cancel'))).toBeDefined()
  })

  it('AC-9: a fork child stays readable after its parent is deleted', async () => {
    const { store } = await persistence()
    await materialize(store, 'session-parent', '/work/tree')
    const child = await store.create({ ...header('session-child', '/work/tree'), parentSession: SessionId('session-parent') })
    await child.append([{ type: 'turn/start', seq: SessionSeq(0), time: 2, data: { turn: 1 } }] as never)
    await child.close()
    expect(await store.delete(SessionId('session-parent'))).toBe(true)
    const reopened = await store.open(SessionId('session-child'), 'read')
    expect((await reopened.read()).events.length).toBeGreaterThan(0)
    await reopened.close()
  })
})
