/** Spec terminal/0001 AC-4 to AC-9: terminal profile detection, merging, defaults, and selection. */
import { PassThrough } from 'node:stream'
import { Context } from '@anotherharness/cordis'
import type { Agent } from '@anotherharness/ah-agent'
import type { SessionId } from '@anotherharness/ah-session'
import {
  SubprocessExecutableNotFoundError,
  type SubprocessRuntime, type SubprocessSpawnSpec, type SubprocessTerminalEnvironment, type SubprocessTerminalHandle,
} from '@anotherharness/ah-subprocess'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TerminalController, type ConfigInput } from '../src/index.ts'
import {
  detectProfiles, iconFor, interactiveArgs, mergeProfiles, parsePosixProbe, parseWslDistributions, POSIX_PROBE_SCRIPT,
  profileId, shellKind, verifyConfiguredProfile,
} from '../src/profiles.ts'
import type { WebTerminalId } from '../src/types.ts'

const roots: Context[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(ctx => ctx.fiber.dispose())) })
const signal = (): AbortSignal => new AbortController().signal

const base: ConfigInput = {
  shellCandidates: [], profiles: [], detectProfiles: true, maxTerminals: 4, maxCols: 200, maxRows: 100, scrollback: 100,
  maxBufferedBytes: 100_000, maxInputBytes: 1000, disposeGraceMs: 100, unattendedTimeoutMs: 0,
  activityPollIntervalMs: 30_000, cleanupRetryMs: 60_000,
}

interface World {
  readonly platform: 'posix' | 'windows'
  readonly defaultShell?: string
  /** Executables that resolve, mapped to their resolved path. */
  readonly executables: Record<string, string>
  /** Captured command outputs keyed by argv[0] basename; a missing key fails the spawn. */
  readonly outputs?: Record<string, { readonly text: string; readonly exitCode?: number }>
}

function fakeSubprocess(world: World) {
  const spawned: SubprocessSpawnSpec[] = []
  const output = new PassThrough()
  const exited = Promise.withResolvers<{ exitCode: number; signal: null }>()
  const handle = {
    pid: 7, output, done: exited.promise, write: vi.fn(async () => {}), resize: vi.fn(async () => {}),
    inspectActivity: vi.fn(async () => ({ state: 'unknown', revision: 0 })),
    inspectForeground: async () => undefined, signalForeground: async () => 7,
    terminate: vi.fn(async () => { output.end(); exited.resolve({ exitCode: 0, signal: null }) }),
  } as unknown as SubprocessTerminalHandle
  const subprocess = {
    terminalEnvironment: vi.fn(async (): Promise<SubprocessTerminalEnvironment> => ({
      platform: world.platform, ...world.defaultShell === undefined ? {} : { defaultShell: world.defaultShell },
    })),
    resolveExecutable: vi.fn(async (path: string) => {
      const found = world.executables[path]
      if (found === undefined) throw new SubprocessExecutableNotFoundError(`${path} not found`)
      return found
    }),
    spawn: vi.fn((spec: SubprocessSpawnSpec) => {
      spawned.push(spec)
      const key = spec.argv[0]?.split(/[\\/]/u).at(-1) ?? ''
      const result = world.outputs?.[key]
      if (result === undefined) throw new Error(`no fixture for ${key}`)
      return {
        done: Promise.resolve({ exitCode: result.exitCode ?? 0, signal: null }),
        collected: { stdout: { readFrom: () => ({ text: result.text, nextOffset: result.text.length, lossy: false }) } },
      }
    }),
    spawnTerminal: vi.fn(async () => handle),
  }
  return { subprocess, runtime: subprocess as unknown as SubprocessRuntime, spawned }
}

function controllerFor(world: World, overrides: Partial<ConfigInput> = {}) {
  const ctx = new Context()
  roots.push(ctx)
  ctx.provide('sandboxPolicy', { defaultMode: 'danger-full-access', resolve: () => ({ mode: 'danger-full-access' }) } as never)
  ctx.provide('workingDirectory', { get: () => '/work', ensure: async () => '/work' } as never)
  const fake = fakeSubprocess(world)
  ctx.provide('subprocess', fake.subprocess as never)
  const controller = new TerminalController(ctx, TerminalController.Config({ ...base, ...overrides }))
  const agent = { id: 'session' as SessionId, ctx, session: { id: 'session' as SessionId, header: { cwd: '/work' } } } as unknown as Agent
  return { controller, agent, ...fake }
}

const WINDOWS: World = {
  platform: 'windows',
  defaultShell: 'C:\\Windows\\system32\\cmd.exe',
  executables: {
    'C:\\Windows\\system32\\cmd.exe': 'C:\\Windows\\system32\\cmd.exe',
    'powershell.exe': 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    'C:\\Program Files\\Git\\bin\\bash.exe': 'C:\\Program Files\\Git\\bin\\bash.exe',
    'wsl.exe': 'C:\\Windows\\System32\\wsl.exe',
  },
  outputs: { 'wsl.exe': { text: 'U\u0000b\u0000u\u0000n\u0000t\u0000u\u0000\r\u0000\n\u0000Debian\r\ndocker-desktop\r\n' } },
}

const WSL_HOST: World = {
  platform: 'posix',
  defaultShell: '/bin/bash',
  executables: {
    '/bin/bash': '/usr/bin/bash', '/usr/bin/zsh': '/usr/bin/zsh',
    'powershell.exe': '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
    'cmd.exe': '/mnt/c/Windows/System32/cmd.exe',
  },
  outputs: { sh: { text: '# /etc/shells\n/bin/sh\n/bin/bash\n/usr/bin/bash\n/usr/bin/zsh\n/usr/bin/tmux\n@@ah-terminal-probe@@\ninterop=1\n' } },
}

describe('profile helpers', () => {
  it('derives kinds, arguments, icons, and identities', () => {
    expect(shellKind('C:\\Program Files\\PowerShell\\7\\PWSH.EXE')).toBe('pwsh')
    expect(interactiveArgs('cmd')).toEqual([])
    expect(interactiveArgs('powershell')).toEqual(['-NoLogo'])
    expect(interactiveArgs('zsh')).toEqual(['-i'])
    expect(['bash', 'zsh', 'fish', 'cmd', 'wsl', 'pwsh', 'powershell', 'nu'].map(iconFor))
      .toEqual(['bash', 'zsh', 'fish', 'cmd', 'wsl', 'pwsh', 'pwsh', 'terminal'])
    expect(profileId('wsl', 'Ubuntu-24.04')).toBe('wsl-ubuntu-24-04')
    expect(profileId('wsl', '***')).toBe('wsl-shell')
    expect(profileId('wsl', 'x'.repeat(100))).toHaveLength(64)
  })

  it('parses UTF-16LE and UTF-8 WSL listings and skips Docker utility distributions', () => {
    expect(parseWslDistributions('\uFEFFU\u0000b\u0000u\u0000n\u0000t\u0000u\u0000\r\n\r\nDebian\ndocker-desktop-data\n')).toEqual(['Ubuntu', 'Debian'])
    expect(parseWslDistributions('')).toEqual([])
  })

  it('parses the POSIX probe and its interop flag', () => {
    expect(parsePosixProbe('/bin/bash\n# comment\n@@ah-terminal-probe@@\ninterop=1\n')).toEqual({ shells: ['/bin/bash'], wslInterop: true })
    expect(parsePosixProbe('/bin/zsh\n')).toEqual({ shells: ['/bin/zsh'], wslInterop: false })
    expect(POSIX_PROBE_SCRIPT).toContain('WSLInterop')
  })
})

describe('detectProfiles', () => {
  it('AC-4: lists Command Prompt, PowerShell, Git Bash, and one profile per WSL distribution on Windows', async () => {
    const { runtime, spawned } = fakeSubprocess(WINDOWS)
    const profiles = await detectProfiles(runtime, 'C:\\work', signal())
    expect(profiles.map(profile => [profile.id, profile.name, profile.args])).toEqual([
      ['cmd', 'Command Prompt', []],
      ['windows-powershell', 'Windows PowerShell', ['-NoLogo']],
      ['git-bash', 'Git Bash', ['--login', '-i']],
      ['wsl-ubuntu', 'Ubuntu (WSL)', ['-d', 'Ubuntu']],
      ['wsl-debian', 'Debian (WSL)', ['-d', 'Debian']],
    ])
    expect(profiles.find(profile => profile.id === 'wsl-ubuntu')?.path).toBe('C:\\Windows\\System32\\wsl.exe')
    expect(spawned[0]).toMatchObject({ argv: ['C:\\Windows\\System32\\wsl.exe', '-l', '-q'], cwd: 'C:\\work', env: { WSL_UTF8: '1' } })
  })

  it('falls back to cmd.exe and survives a failing WSL listing', async () => {
    const { runtime } = fakeSubprocess({
      platform: 'windows', executables: { 'cmd.exe': 'C:\\cmd.exe', 'wsl.exe': 'C:\\wsl.exe' },
      outputs: { 'wsl.exe': { text: 'error', exitCode: 1 } },
    })
    expect((await detectProfiles(runtime, 'C:\\', signal())).map(profile => profile.id)).toEqual(['cmd'])
  })

  it('AC-5: lists /etc/shells kinds and, inside WSL with interop, the Windows shells', async () => {
    const { runtime } = fakeSubprocess(WSL_HOST)
    const profiles = await detectProfiles(runtime, '/work', signal())
    expect(profiles.map(profile => [profile.id, profile.path, profile.icon])).toEqual([
      ['bash', '/usr/bin/bash', 'bash'],
      ['zsh', '/usr/bin/zsh', 'zsh'],
      ['windows-powershell', '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe', 'pwsh'],
      ['cmd', '/mnt/c/Windows/System32/cmd.exe', 'cmd'],
    ])
  })

  it('degrades to no profiles when the POSIX probe cannot run and no default shell resolves', async () => {
    const { runtime } = fakeSubprocess({ platform: 'posix', executables: {} })
    expect(await detectProfiles(runtime, '/work', signal())).toEqual([])
  })

  it('propagates caller cancellation during a probe', async () => {
    const controller = new AbortController()
    const { runtime, subprocess } = fakeSubprocess(WSL_HOST)
    subprocess.spawn.mockImplementationOnce(() => { controller.abort(new Error('cancelled')); throw new Error('aborted spawn') })
    await expect(detectProfiles(runtime, '/work', controller.signal)).rejects.toThrow('cancelled')
  })

  it('rethrows provider failures other than a missing executable', async () => {
    const { runtime, subprocess } = fakeSubprocess(WINDOWS)
    subprocess.resolveExecutable.mockRejectedValueOnce(new Error('provider offline'))
    await expect(detectProfiles(runtime, 'C:\\', signal())).rejects.toThrow('provider offline')
  })
})

describe('detection edge cases', () => {
  it('skips WSL without wsl.exe, unresolvable shells, and interop shells that do not resolve', async () => {
    const windows = fakeSubprocess({ platform: 'windows', executables: { 'cmd.exe': 'C:\\cmd.exe', 'pwsh.exe': 'C:\\pwsh.exe' } })
    expect((await detectProfiles(windows.runtime, 'C:\\', signal())).map(profile => profile.id)).toEqual(['cmd', 'pwsh'])
    expect(windows.subprocess.spawn).not.toHaveBeenCalled()
    const posix = fakeSubprocess({
      platform: 'posix',
      executables: { '/usr/bin/pwsh': '/usr/bin/pwsh', 'cmd.exe': '/mnt/c/cmd.exe' },
      outputs: { sh: { text: '/usr/bin/fish\n/usr/bin/pwsh\n@@ah-terminal-probe@@\ninterop=1\n' } },
    })
    expect((await detectProfiles(posix.runtime, '/work', signal())).map(profile => [profile.id, profile.name])).toEqual([
      ['pwsh', 'PowerShell'], ['cmd', 'Command Prompt'],
    ])
  })
})

describe('mergeProfiles and configured profiles', () => {
  it('orders the legacy shell, detected profiles, uncovered candidates, and configured overrides', () => {
    const merged = mergeProfiles({
      configuredShell: { path: '/opt/bin/fish', name: 'Project fish', args: ['-l'] },
      detected: [
        { id: 'bash', name: 'bash', path: '/usr/bin/bash', args: ['-i'], icon: 'bash', source: 'detected' },
        { id: 'bash', name: 'duplicate', path: '/bin/bash', args: ['-i'], icon: 'bash', source: 'detected' },
        { id: 'wsl-ubuntu', name: 'Ubuntu (WSL)', path: 'wsl.exe', args: ['-d', 'Ubuntu'], icon: 'wsl', source: 'detected' },
      ],
      candidates: [
        { path: '/opt/bin/fish', name: 'fish', args: ['-i'] },
        { path: '/bin/bash', name: 'bash', args: ['-i'] },
        { path: '/usr/bin/nu', name: 'nu', args: ['-i'] },
      ],
      configured: [{ id: 'bash', name: 'Bash (login)', path: '/usr/bin/bash', args: ['-l'], icon: 'bash', source: 'configured' }],
    })
    expect(merged.map(profile => [profile.id, profile.name])).toEqual([
      ['configured', 'Project fish'], ['bash', 'Bash (login)'], ['wsl-ubuntu', 'Ubuntu (WSL)'], ['shell-nu', 'nu'],
    ])
  })

  it('verifies configured entries and keeps their environment', async () => {
    const { runtime } = fakeSubprocess({ platform: 'posix', executables: { node: '/usr/bin/node' } })
    expect(await verifyConfiguredProfile(runtime, { id: 'repl', name: 'Node', path: 'node', env: { A: '1' } }, signal()))
      .toEqual({ id: 'repl', name: 'Node', path: '/usr/bin/node', args: ['-i'], icon: 'terminal', source: 'configured', env: { A: '1' } })
    expect(await verifyConfiguredProfile(runtime, { id: 'gone', name: 'Gone', path: 'missing', args: [], icon: 'git' }, signal())).toBeUndefined()
    expect(await verifyConfiguredProfile(runtime, { id: 'plain', name: 'Node', path: 'node', args: [], icon: 'git' }, signal()))
      .toEqual({ id: 'plain', name: 'Node', path: '/usr/bin/node', args: [], icon: 'git', source: 'configured' })
  })
})

describe('TerminalController profiles', () => {
  it('lists profiles without environments and reports a resolvable default', async () => {
    const { controller, agent } = controllerFor(WSL_HOST, {
      defaultProfile: 'zsh',
      profiles: [{ id: 'secret', name: 'With token', path: '/bin/bash', env: { TOKEN: 'x' } }],
    })
    const listed = await controller.profiles(agent, signal())
    expect(listed.defaultProfileId).toBe('zsh')
    expect(listed.profiles.map(profile => profile.id)).toEqual(['bash', 'zsh', 'windows-powershell', 'cmd', 'secret'])
    expect(listed.profiles.every(profile => !('env' in profile))).toBe(true)
  })

  it('omits an unresolvable default and skips detection when disabled', async () => {
    const { controller, agent, subprocess } = controllerFor(WSL_HOST, { defaultProfile: 'fish', detectProfiles: false, shellCandidates: ['bash'] })
    subprocess.resolveExecutable.mockImplementation(async (path: string) => path)
    const listed = await controller.profiles(agent, signal())
    expect(listed.defaultProfileId).toBeUndefined()
    expect(subprocess.spawn).not.toHaveBeenCalled()
  })

  it('AC-6: opens a profile with its arguments and environment', async () => {
    const { controller, agent, subprocess } = controllerFor(WSL_HOST, {
      profiles: [{ id: 'login', name: 'Login bash', path: '/bin/bash', args: ['-l'], env: { PROJECT: 'ah' } }],
    })
    await controller.create(agent, { id: 'one' as WebTerminalId, cols: 80, rows: 24, profileId: 'login' }, signal())
    expect(subprocess.spawnTerminal).toHaveBeenCalledWith(expect.objectContaining({
      argv: ['/usr/bin/bash', '-l'], env: { PROJECT: 'ah', AH_SESSION_ID: 'session' },
    }))
  })

  it('AC-7: the plain new-terminal action opens the configured default profile', async () => {
    const { controller, agent, subprocess } = controllerFor(WINDOWS, { defaultProfile: 'wsl-debian' })
    const info = await controller.create(agent, { id: 'two' as WebTerminalId, cols: 80, rows: 24 }, signal())
    expect(subprocess.spawnTerminal).toHaveBeenCalledWith(expect.objectContaining({ argv: ['C:\\Windows\\System32\\wsl.exe', '-d', 'Debian'] }))
    expect(info.shell).toMatchObject({ id: 'wsl-debian', icon: 'wsl', name: 'Debian (WSL)' })
  })

  it('falls back to the execution default when the configured default no longer resolves', async () => {
    const { controller, agent, subprocess } = controllerFor(WINDOWS, { defaultProfile: 'wsl-arch' })
    await controller.create(agent, { id: 'three' as WebTerminalId, cols: 80, rows: 24 }, signal())
    expect(subprocess.spawnTerminal).toHaveBeenCalledWith(expect.objectContaining({ argv: ['C:\\Windows\\system32\\cmd.exe'] }))
  })

  it('AC-8: refuses an unavailable profile and leaves no terminal behind', async () => {
    const { controller, agent, subprocess } = controllerFor(WSL_HOST)
    await expect(controller.create(agent, { id: 'four' as WebTerminalId, cols: 80, rows: 24, profileId: 'fish' }, signal()))
      .rejects.toMatchObject({ code: 'terminal/profile-unavailable', details: { profileId: 'fish' } })
    expect(subprocess.spawnTerminal).not.toHaveBeenCalled()
    expect(controller.list('session' as SessionId)).toEqual([])
  })

  it('AC-9: keeps the legacy shell profile and candidate paths working', async () => {
    const { controller, agent, subprocess } = controllerFor(
      { platform: 'posix', executables: { '/opt/fish': '/opt/fish', bash: '/usr/bin/bash' } },
      { detectProfiles: false, shell: { path: '/opt/fish', name: 'Project fish', args: [] }, shellCandidates: ['bash'] },
    )
    const listed = await controller.profiles(agent, signal())
    expect(listed.profiles.map(profile => [profile.id, profile.source])).toEqual([['configured', 'configured'], ['shell-bash', 'detected']])
    await controller.create(agent, { id: 'five' as WebTerminalId, cols: 80, rows: 24, shellPath: '/usr/bin/bash' }, signal())
    expect(subprocess.spawnTerminal).toHaveBeenLastCalledWith(expect.objectContaining({ argv: ['/usr/bin/bash', '-i'] }))
    await controller.create(agent, { id: 'six' as WebTerminalId, cols: 80, rows: 24, profileId: 'configured' }, signal())
    expect(subprocess.spawnTerminal).toHaveBeenLastCalledWith(expect.objectContaining({ argv: ['/opt/fish'] }))
  })

  it('validates configured profile entries', () => {
    const parse = (input: unknown) => TerminalController.Config(input as ConfigInput)
    expect(parse({})).toMatchObject({ profiles: [], detectProfiles: true })
    expect(parse({ defaultProfile: 'zsh' }).defaultProfile?.get()).toBe('zsh')
    expect(parse({ profiles: [{ id: 'ok', name: 'Ok', path: 'bash', icon: 'bash' }] }).profiles[0]).toMatchObject({ id: 'ok' })
    expect(() => parse({ profiles: [{ id: 'bad id', name: 'Bad', path: 'bash' }] })).toThrow()
    expect(() => parse({ profiles: [{ id: 'ok', name: 'Ok', path: 'bash', icon: 'emoji' }] })).toThrow()
  })
})
