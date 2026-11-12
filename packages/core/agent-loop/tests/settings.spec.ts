/** The `agent-loop` settings section layered over the composition entry. */

import { expect, it, onTestFinished } from 'vitest'
import { Context } from '@anotherharness/cordis'
import LlmRuntime from '@anotherharness/ah-llm'
import SessionStore from '@anotherharness/ah-session'
import SystemPrompt from '@anotherharness/ah-system-prompt'
import ToolRuntime from '@anotherharness/ah-tools'
import AgentRegistry from '@anotherharness/ah-agent'
import SessionProjectionRegistry from '@anotherharness/ah-session-projection'
import { liveConfig } from '../../../settings/settings/tests/live-config.ts'
import AgentLoop from '@anotherharness/ah-agent-loop'

async function boot() {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  onTestFinished(() => ctx.fiber.dispose())
  const live = await liveConfig(ctx, AgentLoop, { agents: [], maxParallelToolCalls: 4 })
  return { ctx, live }

}

it('updates future scheduler budgets while preserving composed agents and the running loop', async () => {
  const { ctx, live } = await boot()
  const before = live.fiber
  await live.update({ maxParallelToolCalls: 1 })
  expect(live.entry.fiber === before).toBe(true)
  expect(ctx.agentLoop.config.maxParallelToolCalls.get()).toBe(1)
  expect(ctx.agentLoop.config.agents).toEqual([])
  await expect(live.update({ maxParallelToolCalls: 0 })).rejects.toThrow()
  expect(ctx.agentLoop.config.maxParallelToolCalls.get()).toBe(1)
})
