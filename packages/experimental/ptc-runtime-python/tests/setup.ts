import { Context } from '@anotherharness/cordis'
import Sandbox from '@anotherharness/ah-sandbox-local'
import SandboxPolicy from '@anotherharness/ah-sandbox-policy'
import SessionProjections from '@anotherharness/ah-session-projection'
import { onTestFinished } from 'vitest'
import type { SandboxMode } from '@anotherharness/ah-sandbox'

/** Mount the Python runtime's policy and confinement providers with owned teardown. */
export async function createRuntimeContext(policy: { mode?: SandboxMode; workspaceRoot?: string } = {}): Promise<Context> {
  const ctx = new Context()
  onTestFinished(async () => { await ctx.fiber.dispose() })
  await ctx.plugin(Sandbox, {})
  await ctx.plugin(SessionProjections)
  await ctx.plugin(SandboxPolicy, { mode: 'danger-full-access', ...policy })
  return ctx
}
