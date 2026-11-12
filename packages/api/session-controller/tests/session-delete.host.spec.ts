/** Spec session/0001 AC-7 and AC-8: permanent Session deletion through the Session Controller. */

import { describe, expect, it, vi } from 'vitest'
import { Context } from '@anotherharness/cordis'
import AgentRegistry from '@anotherharness/ah-agent'
import type { Agent, AgentHandle, CreateAgentOptions } from '@anotherharness/ah-agent'
import SessionStore from '@anotherharness/ah-session'
import type { SessionId } from '@anotherharness/ah-session'
import { SessionAlreadyOwnedError } from '@anotherharness/ah-session-persistence'
import SystemPrompt from '@anotherharness/ah-system-prompt'
import { WorkspaceActiveSessionError } from '@anotherharness/ah-workspace'
import { createSessionTestRemote, installSessionReadTestServices } from './test-remote.ts'

const sid = (id: string): SessionId => id as SessionId

interface Fixture {
  readonly ctx: Context
  readonly deleteStored: ReturnType<typeof vi.fn<(id: SessionId) => Promise<boolean>>>
  readonly forgetSession: ReturnType<typeof vi.fn>
  readonly forgetCache: ReturnType<typeof vi.fn>
  readonly disposed: SessionId[]
}

async function composed(options: { persistence?: boolean } = {}): Promise<Fixture> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SystemPrompt, { personaPrefix: '' })
  await ctx.plugin(AgentRegistry)
  installSessionReadTestServices(ctx)
  const forgetSession = vi.fn(() => Promise.resolve())
  ctx.provide('workspaceRegistry', { list: () => [], archivedSessionIds: [], forgetSession } as never)
  const deleteStored = vi.fn<(id: SessionId) => Promise<boolean>>(() => Promise.resolve(true))
  if (options.persistence !== false) {
    ctx.provide('sessionPersistence', { delete: deleteStored, stat: () => Promise.resolve(undefined), list: () => Promise.resolve([]) } as never)
  }
  const forgetCache = vi.fn(() => Promise.resolve(true))
  ctx.provide('sessionProjectionCache', { forget: forgetCache } as never)
  const disposed: SessionId[] = []
  ctx.agents.setFactory({
    createAgent: async (ownerCtx: Context, created: CreateAgentOptions): Promise<AgentHandle> => {
      const session = ctx.sessions.create(created.sessionId, {
        ...created.seed === undefined ? {} : { seed: [...created.seed] },
        ...created.meta === undefined ? {} : { meta: created.meta },
        ...created.inheritedEventCount === undefined ? {} : { inheritedEventCount: created.inheritedEventCount },
      })
      const agent = {} as Agent
      Object.assign(agent, { id: session.id, session, status: 'idle', ctx: ownerCtx })
      await created.setup?.(ownerCtx, agent)
      await ctx.agents.register(agent)
      return { agent, dispose: () => { disposed.push(session.id); return Promise.resolve() } }
    },
    resume: () => Promise.reject(new Error('delete test sessions are created')),
  })
  return { ctx, deleteStored, forgetSession, forgetCache, disposed }
}

const remote = (ctx: Context) => createSessionTestRemote(ctx, {
  defaultModelSelection: () => ({ provider: 'default-provider', model: 'default-model' }),
  cwd: '/tmp',
})

async function created(ctx: Context, id: string): Promise<Agent> {
  const result = await remote(ctx).create({ sessionId: sid(id), cwd: '/tmp/delete-project' })
  if (!result.ok) throw result.error
  return ctx.agents.get(sid(id))!
}

describe('session.delete', () => {
  it('AC-7: releases an idle Web Agent, forgets the Session everywhere, and removes its log', async () => {
    const { ctx, deleteStored, forgetSession, forgetCache, disposed } = await composed()
    try {
      await created(ctx, 'session-idle')
      const result = await remote(ctx).delete({ sessionId: sid('session-idle') })
      expect(result).toEqual({ ok: true, value: { deleted: true } })
      expect(disposed).toEqual(['session-idle'])
      expect(forgetSession).toHaveBeenCalledWith('session-idle')
      expect(deleteStored).toHaveBeenCalledWith('session-idle')
      expect(forgetCache).toHaveBeenCalledWith('session-idle')
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('deletes a cold Session that no Agent holds', async () => {
    const { ctx, deleteStored, disposed } = await composed()
    try {
      expect(await remote(ctx).delete({ sessionId: sid('session-cold') })).toMatchObject({ ok: true })
      expect(disposed).toEqual([])
      expect(deleteStored).toHaveBeenCalledWith('session-cold')
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('AC-8: refuses a running Session and removes nothing', async () => {
    const { ctx, deleteStored, forgetSession } = await composed()
    try {
      const agent = await created(ctx, 'session-running')
      Object.assign(agent, { status: 'running' })
      expect(await remote(ctx).delete({ sessionId: sid('session-running') })).toMatchObject({
        ok: false, error: { code: 'session/active', details: { sessionId: 'session-running' } },
      })
      expect(forgetSession).not.toHaveBeenCalled()
      expect(deleteStored).not.toHaveBeenCalled()
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('refuses a Session held by another owner', async () => {
    const { ctx, deleteStored } = await composed()
    try {
      ctx.sessions.create(sid('session-foreign'), { meta: { cwd: '/tmp' } })
      expect(await remote(ctx).delete({ sessionId: sid('session-foreign') })).toMatchObject({
        ok: false, error: { code: 'session/active', message: expect.stringContaining('another component') as string },
      })
      expect(deleteStored).not.toHaveBeenCalled()
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('forgets handles of Agents disposed elsewhere', async () => {
    const { ctx, deleteStored, disposed } = await composed()
    try {
      const agent = await created(ctx, 'session-elsewhere')
      ctx.emit('agent/disposed', { agent: { ...agent } })
      ctx.emit('agent/disposed', { agent })
      expect(await remote(ctx).delete({ sessionId: sid('session-elsewhere') })).toMatchObject({ ok: false, error: { code: 'session/active' } })
      expect(disposed).toEqual([])
      expect(deleteStored).not.toHaveBeenCalled()
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it.each([
    [new WorkspaceActiveSessionError(sid('session-bg'), [{ kind: 'job' }] as never), 'session/active'],
    [new Error('registry offline'), 'gateway/internal'],
  ])('maps a Workspace registry failure (%s)', async (failure, code) => {
    const { ctx, deleteStored, forgetSession } = await composed()
    try {
      forgetSession.mockRejectedValueOnce(failure)
      expect(await remote(ctx).delete({ sessionId: sid('session-bg') })).toMatchObject({ ok: false, error: { code } })
      expect(deleteStored).not.toHaveBeenCalled()
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it.each([
    [() => Promise.reject(new SessionAlreadyOwnedError(sid('session-locked'))), 'session/writer-held'],
    [() => Promise.reject(new Error('disk full')), 'gateway/internal'],
    [() => Promise.resolve(false), 'session/not-found'],
  ])('maps a persistence outcome to %#', async (outcome, code) => {
    const { ctx, deleteStored, forgetCache } = await composed()
    try {
      deleteStored.mockImplementationOnce(outcome)
      expect(await remote(ctx).delete({ sessionId: sid('session-locked') })).toMatchObject({ ok: false, error: { code } })
      expect(forgetCache).not.toHaveBeenCalled()
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('reports a deployment without Session persistence', async () => {
    const { ctx } = await composed({ persistence: false })
    try {
      expect(await remote(ctx).delete({ sessionId: sid('session-any') })).toMatchObject({
        ok: false, error: { code: 'gateway/internal', message: expect.stringContaining('no session persistence') as string },
      })
    } finally {
      await ctx.fiber.dispose()
    }
  })
})
