import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AGENTS_HOME_DIR_NAME,
  DEFAULT_AGENTS_HOME_DISPLAY,
  DEFAULT_AH_HOME_DISPLAY,
  AH_HOME_DIR_NAME,
  agentsHomeDisplay,
  canonicalizeWatchPath,
  defaultAgentsHome,
  defaultAhHome,
  ahCachePath,
  ahHomeDisplay,
  ahHomePath,
  expandHomePath,
  resolveAgentsHome,
  resolveAhHome,
} from '@anotherharness/ah-home-paths'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('ah path helpers', () => {
  it('owns the shared default AH home directory name', () => {
    expect(AH_HOME_DIR_NAME).toBe('.ah')
    expect(DEFAULT_AH_HOME_DISPLAY).toBe('~/.ah')
    expect(defaultAhHome()).toBe(join(homedir(), '.ah'))
  })

  it('expands tilde paths without changing non-tilde paths', () => {
    expect(expandHomePath('~')).toBe(homedir())
    expect(expandHomePath('~/.ah')).toBe(join(homedir(), '.ah'))
    expect(expandHomePath('~\\.ah')).toBe(join(homedir(), '.ah'))
    expect(expandHomePath('/tmp/.ah')).toBe('/tmp/.ah')
    expect(expandHomePath('~other/.ah')).toBe('~other/.ah')
  })

  it('resolves explicit path before AH_HOME and the default', () => {
    const envHome = join(homedir(), 'env-ah')

    expect(resolveAhHome('/tmp/explicit-ah', { AH_HOME: '~/env-ah' })).toBe(resolve('/tmp/explicit-ah'))
    expect(resolveAhHome(undefined, { AH_HOME: '~/env-ah' })).toBe(envHome)
    expect(resolveAhHome(undefined, {})).toBe(defaultAhHome())
  })

  it('treats an empty or whitespace-only AH_HOME as unset', () => {
    expect(resolveAhHome(undefined, { AH_HOME: '' })).toBe(defaultAhHome())
    expect(resolveAhHome(undefined, { AH_HOME: '   ' })).toBe(defaultAhHome())
  })

  it('joins child segments onto the resolved AH_HOME', () => {
    vi.stubEnv('AH_HOME', '~/env-ah')
    expect(ahHomePath()).toBe(join(homedir(), 'env-ah'))
    expect(ahHomePath('storages', 'cache')).toBe(join(homedir(), 'env-ah', 'storages', 'cache'))
  })

  it('labels a resolved home by whether it is the default root', () => {
    expect(ahHomeDisplay(resolve(defaultAhHome()))).toBe('~/.ah')
    expect(ahHomeDisplay('/some/other/root')).toBe('$AH_HOME')
  })

  it('owns the shared default agents home directory name', () => {
    expect(AGENTS_HOME_DIR_NAME).toBe('.agents')
    expect(DEFAULT_AGENTS_HOME_DISPLAY).toBe('~/.agents')
    expect(defaultAgentsHome()).toBe(join(homedir(), '.agents'))
  })

  it('resolves an explicit agents home before AH_AGENTS_HOME and the default', () => {
    const envHome = join(homedir(), 'env-agents')

    expect(resolveAgentsHome('/tmp/explicit-agents', { AH_AGENTS_HOME: '~/env-agents' })).toBe(resolve('/tmp/explicit-agents'))
    expect(resolveAgentsHome(undefined, { AH_AGENTS_HOME: '~/env-agents' })).toBe(envHome)
    expect(resolveAgentsHome(undefined, {})).toBe(defaultAgentsHome())
  })

  it('treats an empty or whitespace-only AH_AGENTS_HOME as unset', () => {
    expect(resolveAgentsHome(undefined, { AH_AGENTS_HOME: '' })).toBe(defaultAgentsHome())
    expect(resolveAgentsHome(undefined, { AH_AGENTS_HOME: '   ' })).toBe(defaultAgentsHome())
  })

  it('labels a resolved agents home by whether it is the default root', () => {
    expect(agentsHomeDisplay(resolve(defaultAgentsHome()))).toBe('~/.agents')
    expect(agentsHomeDisplay('/some/other/root')).toBe('$AH_AGENTS_HOME')
  })

  it.each([
    [undefined, join(homedir(), '.ah')],
    ['', join(homedir(), '.ah')],
    ['   ', join(homedir(), '.ah')],
    ['~/env-ah', join(homedir(), 'env-ah')],
    ['./relative-ah', resolve('./relative-ah')],
  ] as const)('resolves cache paths with AH_HOME=%j', (home, expectedHome) => {
    vi.stubEnv('AH_HOME', home)
    try {
      expect(ahCachePath()).toBe(join(expectedHome, 'cache'))
      expect(ahCachePath('models', 'index.json')).toBe(join(expectedHome, 'cache', 'models', 'index.json'))
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('resolves configured cache homes before the environment', () => {
    vi.stubEnv('AH_HOME', '~/env-ah')
    try {
      expect(ahCachePath({ ahHome: '~/explicit-ah' })).toBe(join(homedir(), 'explicit-ah', 'cache'))
      expect(ahCachePath({ ahHome: './explicit-ah' }, 'attachments', 'request-images'))
        .toBe(resolve('./explicit-ah/cache/attachments/request-images'))
      expect(ahCachePath({}, 'attachments')).toBe(join(homedir(), 'env-ah', 'cache', 'attachments'))
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('canonicalizes a watcher ancestor while preserving a missing suffix', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ah-watch-path-'))
    const target = join(root, 'target')
    const alias = join(root, 'alias')
    try {
      await mkdir(target)
      await symlink(target, alias, process.platform === 'win32' ? 'junction' : 'dir')
      await expect(canonicalizeWatchPath(alias)).resolves.toBe(await realpath(target))
      await expect(canonicalizeWatchPath(join(alias, 'later', 'config.yml'))).resolves.toBe(
        join(await realpath(target), 'later', 'config.yml'),
      )
      const file = join(root, 'file')
      await writeFile(file, 'not a directory')
      await expect(canonicalizeWatchPath(join(file, 'child'))).rejects.toMatchObject({ code: 'ENOTDIR' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
