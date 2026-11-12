/**
 * Registry tests for `@anotherharness/ah-shell-env`: built-in facts, contributor
 * ownership and validation, collection ordering, effect-scoped disposal, and
 * the explicit disposer contract.
 */

import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@anotherharness/cordis'
import { ToolCallId } from '@anotherharness/ah-llm'
import type { Agent } from '@anotherharness/ah-agent'
import { SESSION_FORMAT_VERSION } from '@anotherharness/ah-session'
import type { ToolExecution } from '@anotherharness/ah-tools'
import { ShellEnvRegistry } from '@anotherharness/ah-shell-env'
import * as BashEnvPlugin from '@anotherharness/ah-shell-env'

const testToolSignal = new AbortController().signal

afterEach(() => vi.unstubAllEnvs())

function execution(sessionId?: string): ToolExecution {
  return {
    signal: testToolSignal,
    token: Symbol('bash-env-test') as ToolExecution['token'],
    callId: ToolCallId('bash-env-call'),
    rootCallId: ToolCallId('bash-env-call'),
    name: 'bash',
    arguments: { command: 'true' },
    ...(sessionId === undefined
      ? {}
      : {
        agent: {
          session: {
            header: { version: SESSION_FORMAT_VERSION, id: sessionId, createdAt: 0, isSeeded: false },
          },
        } as unknown as Agent,
      }),
  }
}

describe('ShellEnvRegistry', () => {
  it('collects unconditional shell facts and the current agent session id', () => {
    const ctx = new Context()
    const registry = new ShellEnvRegistry(ctx, { ahHome: './test-ah-home' })

    expect(registry.collect(execution())).toEqual({
      AH_HOME: resolve('./test-ah-home'),
      AH_SHELL: '1',
    })
    expect(registry.collect(execution('session-a'))).toEqual({
      AH_HOME: resolve('./test-ah-home'),
      AH_SESSION_ID: 'session-a',
      AH_SHELL: '1',
    })
  })

  it('collects the launcher-provided profile name and directory when a profile context exists', () => {
    const ctx = new Context()
    ctx.provide('profileContext', {
      name: 'web', dir: '/profiles/web', patchPath: '/profiles/web/cordis.patch.yml', installAnchor: '/ah/package.json',
      cwd: '/work', home: '/home', startedBundles: [], overlays: [], telemetryDisabledEnv: undefined,
    })
    const registry = new ShellEnvRegistry(ctx, { ahHome: './test-ah-home' })
    expect(registry.collect(execution())).toMatchObject({ AH_PROFILE: 'web', AH_PROFILE_DIR: '/profiles/web' })
    expect(() => registry.register({
      name: 'profile-claimer',
      variables: { AH_PROFILE: { description: 'Reserved key.' } },
      resolve: () => ({}),
    })).toThrow(/reserved key "AH_PROFILE"/)
  })

  it('resolves AH_HOME from the ambient override or the user-home default', () => {
    vi.stubEnv('AH_HOME', './ambient-ah-home')
    const fromEnvironment = new ShellEnvRegistry(new Context())
    expect(fromEnvironment.collect(execution()).AH_HOME).toBe(resolve('./ambient-ah-home'))

    vi.stubEnv('AH_HOME', undefined)
    const fromDefault = new ShellEnvRegistry(new Context())
    expect(fromDefault.collect(execution()).AH_HOME).toBe(join(homedir(), '.ah'))
  })

  it('collects declared contributor variables and omits unavailable values', () => {
    const ctx = new Context()
    const registry = new ShellEnvRegistry(ctx, { ahHome: './test-ah-home' })
    registry.register({
      name: 'optional-session-fact',
      variables: {
        AH_SESSION_OPTIONAL: { description: 'Optional session-scoped test fact.' },
      },
      resolve: exec => exec.agent === undefined ? {} : { AH_SESSION_OPTIONAL: exec.agent.session.header.id },
    })
    registry.register({
      name: 'always-available-fact',
      variables: {
        AH_ALWAYS_AVAILABLE: { description: 'Always-available test fact.' },
      },
      resolve: () => ({ AH_ALWAYS_AVAILABLE: 'yes' }),
    })

    expect(registry.collect(execution())).not.toHaveProperty('AH_SESSION_OPTIONAL')
    expect(registry.collect(execution()).AH_ALWAYS_AVAILABLE).toBe('yes')
    expect(registry.collect(execution('session-b')).AH_SESSION_OPTIONAL).toBe('session-b')
    expect(registry.list()).toEqual([
      {
        contributor: 'always-available-fact',
        description: 'Always-available test fact.',
        key: 'AH_ALWAYS_AVAILABLE',
      },
      {
        contributor: 'optional-session-fact',
        description: 'Optional session-scoped test fact.',
        key: 'AH_SESSION_OPTIONAL',
      },
    ])
  })

  it('rejects duplicate variable ownership at registration time', () => {
    const ctx = new Context()
    const registry = new ShellEnvRegistry(ctx, { ahHome: './test-ah-home' })
    registry.register({
      name: 'first',
      variables: { AH_SHARED: { description: 'First owner.' } },
      resolve: () => ({ AH_SHARED: 'first' }),
    })

    expect(() => registry.register({
      name: 'second',
      variables: { AH_SHARED: { description: 'Second owner.' } },
      resolve: () => ({ AH_SHARED: 'second' }),
    })).toThrow(/AH_SHARED.*first.*second|AH_SHARED.*second.*first/)
  })

  it('rejects duplicate contributor names and malformed declarations', () => {
    const registry = new ShellEnvRegistry(new Context(), { ahHome: './test-ah-home' })
    registry.register({
      name: 'declared',
      variables: { AH_DECLARED: { description: 'Declared fact.' } },
      resolve: () => ({}),
    })

    expect(() => registry.register({
      name: 'declared',
      variables: { AH_ANOTHER: { description: 'Another fact.' } },
      resolve: () => ({}),
    })).toThrow(/already registered/)
    expect(() => registry.register({
      name: ' ',
      variables: { AH_BLANK_NAME: { description: 'Blank owner.' } },
      resolve: () => ({}),
    })).toThrow(/name must be non-empty/)
    expect(() => registry.register({
      name: 'invalid-key',
      variables: { ah_invalid: { description: 'Invalid key.' } } as unknown as Record<'AH_INVALID', { description: string }>,
      resolve: () => ({}),
    })).toThrow(/invalid key/)
    expect(() => registry.register({
      name: 'reserved-key',
      variables: { AH_HOME: { description: 'Reserved key.' } },
      resolve: () => ({}),
    })).toThrow(/reserved key/)
    expect(() => registry.register({
      name: 'blank-description',
      variables: { AH_BLANK_DESCRIPTION: { description: ' ' } },
      resolve: () => ({}),
    })).toThrow(/must describe/)
  })

  it('rejects undeclared variables returned by a contributor', () => {
    const ctx = new Context()
    const registry = new ShellEnvRegistry(ctx, { ahHome: './test-ah-home' })
    registry.register({
      name: 'drifted-provider',
      variables: { AH_DECLARED: { description: 'Declared fact.' } },
      resolve: () => ({ AH_UNDECLARED: 'bad' }),
    })

    expect(() => registry.collect(execution())).toThrow(/drifted-provider.*AH_UNDECLARED/)
  })

  it('rejects non-string values returned by a contributor', () => {
    const registry = new ShellEnvRegistry(new Context(), { ahHome: './test-ah-home' })
    registry.register({
      name: 'wrong-value-type',
      variables: { AH_STRING: { description: 'String fact.' } },
      resolve: () => ({ AH_STRING: 42 }) as unknown as Record<'AH_STRING', string>,
    })

    expect(() => registry.collect(execution())).toThrow(/wrong-value-type.*non-string.*AH_STRING/)
  })

  it('removes an effect-scoped contributor when its plugin is disposed', async () => {
    const ctx = new Context()
    const registry = new ShellEnvRegistry(ctx, { ahHome: './test-ah-home' })
    const fiber = await ctx.plugin({
      inject: ['shellEnv'],
      apply(inner: Context) {
        inner.shellEnv.register({
          name: 'temporary',
          variables: { AH_TEMPORARY: { description: 'Temporary fact.' } },
          resolve: () => ({ AH_TEMPORARY: 'present' }),
        })
      },
    })

    expect(registry.collect(execution()).AH_TEMPORARY).toBe('present')
    await fiber.dispose()
    expect(registry.collect(execution())).not.toHaveProperty('AH_TEMPORARY')
  })

  it('returns an explicit contributor disposer', () => {
    const registry = new ShellEnvRegistry(new Context(), { ahHome: './test-ah-home' })
    const dispose = registry.register({
      name: 'explicit-disposal',
      variables: { AH_EXPLICIT_DISPOSAL: { description: 'Explicitly disposed fact.' } },
      resolve: () => ({ AH_EXPLICIT_DISPOSAL: 'present' }),
    })

    expect(registry.collect(execution()).AH_EXPLICIT_DISPOSAL).toBe('present')
    dispose()
    expect(registry.collect(execution())).not.toHaveProperty('AH_EXPLICIT_DISPOSAL')
  })

  it('the plugin registers the service with no contributors on load', async () => {
    const ctx = new Context()
    await ctx.plugin(BashEnvPlugin)
    expect(ctx.shellEnv).toBeInstanceOf(ShellEnvRegistry)
    expect(ctx.shellEnv.list()).toEqual([])
  })
})
