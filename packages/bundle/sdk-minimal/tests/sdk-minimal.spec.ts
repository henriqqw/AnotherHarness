/** The standalone SDK-minimal bundle's complete declared Cordis tree. */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import { entryListSchema } from '@anotherharness/cordis-plugin-include'

function packageName(specifier: string): string {
  return specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!
}

describe('ah-sdk-minimal bundle', () => {
  it('declares one standalone allowlisted tree with every row dependency', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      ah?: { bundle?: { patch?: string } }
    }
    expect(manifest.ah?.bundle?.patch).toBe('./cordis.patch.yml')
    const patches = yaml.load(
      readFileSync(resolve(root, manifest.ah!.bundle!.patch!), 'utf8'),
      { schema: entryListSchema },
    ) as Array<{ insert?: Array<{ id?: string; inject?: string[]; name?: string; config?: Record<string, unknown>; disabled?: unknown }> }>
    expect(patches).toHaveLength(1)
    const rows = patches[0]?.insert ?? []
    expect(rows.map(row => [row.id, row.name])).toEqual([
      ['sdk-app-startup', '@anotherharness/ah-sdk-app'],
      ['sdk-jsonrpc-server', '@anotherharness/ah-sdk-jsonrpc-server'],
      ['deepseek-llm-api-extensions', '@anotherharness/ah-deepseek-llm-api-extensions'],
      ['session-log-deepseek', '@anotherharness/ah-session-log-deepseek'],
      ['plugin-package-inventory-deepseek', '@anotherharness/ah-plugin-package-inventory-deepseek'],
      ['llm-deepseek', '@anotherharness/ah-llm-deepseek-api-key'],
      ['sandbox', '@anotherharness/ah-sandbox-local'],
      ['filesystem', '@anotherharness/ah-fs-local'],
      ['working-directory', '@anotherharness/ah-working-directory'],
      ['tool-working-directory', '@anotherharness/ah-tool-working-directory'],
      ['session-projection', '@anotherharness/ah-session-projection'],
      ['sandbox-policy', '@anotherharness/ah-sandbox-policy'],
      ['subprocess', '@anotherharness/ah-subprocess-local'],
      ['pty', '@anotherharness/ah-terminal'],
      ['terminal-bash', '@anotherharness/ah-terminal-bash'],
      ['terminal-pwsh', '@anotherharness/ah-terminal-bash'],
      ['timer', '@anotherharness/cordis-plugin-timer'],
      ['llm', '@anotherharness/ah-llm'],
      ['session', '@anotherharness/ah-session'],
      ['session-title', '@anotherharness/ah-session-title'],
      ['system-prompt', '@anotherharness/ah-system-prompt'],
      ['tools', '@anotherharness/ah-tools'],
      ['mcp-resources', '@anotherharness/ah-mcp-resources'],
      ['agent', '@anotherharness/ah-agent'],
      ['llm-retry', '@anotherharness/ah-llm-retry'],
      ['jobs', '@anotherharness/ah-jobs-local'],
      ['agent-loop', '@anotherharness/ah-agent-loop'],
      ['persistent-bash', '@anotherharness/ah-tool-bash-persistent'],
      ['persistent-pwsh', '@anotherharness/ah-tool-pwsh-persistent'],
      ['sessions', '@anotherharness/ah-session-persistence-jsonl'],
    ])
    expect(rows.find(row => row.id === 'sdk-app-startup')?.config).toEqual({ profile: 'sdk-minimal' })
    expect(rows.find(row => row.id === 'sdk-jsonrpc-server')).toMatchObject({
      inject: ['sdkAppStartup', 'loader'],
      config: { maxTokensAsSuccess: false },
    })
    expect(rows.find(row => row.id === 'llm-deepseek')?.config).toEqual({
      apiKeyEnv: 'DEEPSEEK_API_KEY',
      defaultContextWindow: { __jsExpr: 'Number(process.env.AH_CONTEXT_WINDOW ?? 1000000)' },
      streamIdleTimeoutMs: 172800000,
    })
    expect(rows.find(row => row.id === 'system-prompt')?.config).toEqual({
      includeHarnessIdentity: false,
      includeRuntimeContext: false,
      personaPrefix: { __jsExpr: "process.env.AH_SYSTEM_PROMPT ?? 'You are a helpful software engineer assistant.'" },
    })
    expect(rows.find(row => row.id === 'agent-loop')?.config).toEqual({ agents: [] })
    expect(rows.find(row => row.id === 'terminal-bash')).toMatchObject({
      disabled: { __jsExpr: "process.platform === 'win32'" },
    })
    expect(rows.find(row => row.id === 'terminal-pwsh')).toMatchObject({
      disabled: { __jsExpr: "process.platform !== 'win32'" },
      config: { shellDialect: 'pwsh', timeoutMs: 300000 },
    })
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual(
      [...new Set(rows.map(row => row.name).filter((name): name is string => name !== undefined).map(packageName))].sort(),
    )
  })
})
