/** Release family discovery, publish order, tag naming, and the bump judgements. */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { officialClientBuildEnvironment, writeClientBuildRecord } from '../client-build-environment.ts'
import { ON_DEMAND_BUNDLES } from '../../packages/boot/app-boot/src/official-bundles.ts'
import { releaseFamily, type ReleaseMember } from './families.ts'
import { compareVersions, nextVendorVersion, planShared, reachesPayload } from './bump.ts'

/**
 * A release member standing in for a manifest on disk.
 * @param directory - repository-relative package directory.
 * @param name - package name.
 * @param manifest - manifest fields the subject reads.
 * @returns The member.
 */
function member(directory: string, name: string, manifest: Record<string, unknown> = {}): ReleaseMember {
  return { directory, name, version: '0.0.1', manifest }
}

const roots: string[] = []

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function buildFixture(environment: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'ah-release-build-'))
  roots.push(root)
  write(join(root, 'package.json'), `${JSON.stringify({ version: environment.AH_CLIENT_VERSION ?? '0.0.1' })}\n`)
  write(join(root, 'apps/web/dist/index.html'), '<main></main>')
  write(join(root, 'packages/client/example/lib/client.js'), 'module.exports = {}\n')
  writeClientBuildRecord(root, environment)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  vi.unstubAllEnvs()
})

describe('release families', () => {
  it('publishes all current experimental packages', () => {
    const members = releaseFamily('ah').members(resolve(import.meta.dirname, '../..'))

    expect(members
      .filter(member => member.directory.startsWith('packages/experimental/'))
      .map(member => member.name)).toEqual([
      '@anotherharness/ah-experimental-agent-team-profile',
      '@anotherharness/ah-experimental-agent-team',
      '@anotherharness/ah-experimental-api-speech-to-text',
      '@anotherharness/ah-experimental-auto-review',
      '@anotherharness/ah-experimental-badge-skill-bundle',
      '@anotherharness/ah-experimental-browser-use-chrome-devtools-mcp',
      '@anotherharness/ah-experimental-browser-use-playwright-mcp',
      '@anotherharness/ah-experimental-browser-use-runtime',
      '@anotherharness/ah-experimental-browser-use-stagehand-native',
      '@anotherharness/ah-experimental-claude-code-mods',
      '@anotherharness/ah-experimental-client-ui-agent-team',
      '@anotherharness/ah-experimental-client-ui-claude-code-mods',
      '@anotherharness/ah-experimental-client-ui-cot-translation',
      '@anotherharness/ah-experimental-client-ui-voice-input',
      '@anotherharness/ah-experimental-computer-use-cua-driver-mcp',
      '@anotherharness/ah-experimental-computer-use-cua-driver-native',
      '@anotherharness/ah-experimental-cot-translation-bundle',
      '@anotherharness/ah-hook-protocol',
      '@anotherharness/ah-hooks-claude-code',
      '@anotherharness/ah-hooks-codex',
      '@anotherharness/ah-experimental-inspector-profile',
      '@anotherharness/ah-experimental-inspector',
      '@anotherharness/ah-experimental-ptc-runtime-python',
      '@anotherharness/ah-experimental-ralph-bundle',
      '@anotherharness/ah-experimental-session-inspector',
      '@anotherharness/ah-experimental-session-search',
      '@anotherharness/ah-session-title-all-prompts-llm',
      '@anotherharness/ah-experimental-session-titles-bundle',
      '@anotherharness/ah-skill-badge',
      '@anotherharness/ah-experimental-speech-to-text-sensevoice',
      '@anotherharness/ah-experimental-speech-to-text',
      '@anotherharness/ah-experimental-terminal-bundle',
      '@anotherharness/ah-experimental-tool-agent-team',
      '@anotherharness/ah-tool-ralph',
      '@anotherharness/ah-tool-session-query',
      '@anotherharness/ah-tool-terminal',
      '@anotherharness/ah-experimental-tool-worktree',
      '@anotherharness/ah-experimental-translator',
      '@anotherharness/ah-experimental-voice-input-bundle',
      '@anotherharness/ah-webhook-github',
      '@anotherharness/ah-webhook',
      '@anotherharness/ah-experimental-webworker-packer',
      '@anotherharness/ah-experimental-webworker-runtime',
      '@anotherharness/ah-experimental-worktree',
    ])
  })

  it('excludes private applications from the publish set', () => {
    const root = mkdtempSync(join(tmpdir(), 'ah-release-private-'))
    roots.push(root)
    write(join(root, 'apps/public/package.json'), '{"name":"@anotherharness/ah-public","version":"0.0.1"}\n')
    write(join(root, 'apps/private/package.json'), '{"name":"@anotherharness/ah-private","version":"0.0.1","private":true}\n')

    expect(releaseFamily('ah').members(root).map(entry => entry.name)).toEqual(['@anotherharness/ah-public'])
  })

  it('publishes unlisted experimental packages while retaining private exclusions', () => {
    const root = mkdtempSync(join(tmpdir(), 'ah-release-experimental-'))
    roots.push(root)
    write(join(root, 'packages/experimental/prototype/package.json'), JSON.stringify({
      name: '@anotherharness/ah-experimental-prototype',
      version: '0.0.1',
      publishConfig: { access: 'public' },
    }))
    write(join(root, 'packages/experimental/inspector/package.json'), JSON.stringify({
      name: '@anotherharness/ah-experimental-inspector',
      version: '0.0.1',
      private: true,
    }))

    expect(releaseFamily('ah').members(root).map(entry => entry.name)).toEqual([
      '@anotherharness/ah-experimental-prototype',
    ])
  })

  it('bumps private ah workspaces without adding release tags', () => {
    const root = mkdtempSync(join(tmpdir(), 'ah-release-version-'))
    roots.push(root)
    write(join(root, 'package.json'), '{"version":"0.0.1"}\n')
    write(join(root, 'apps/desktop/package.json'), '{"version":"0.0.1","private":true}\n')
    write(join(root, 'packages/experimental/prototype/package.json'), '{"version":"0.0.1","private":true}\n')
    write(join(root, 'packages/core/unselected/package.json'), '{"version":"0.0.1"}\n')

    const ah = releaseFamily('ah')
    const published = member('packages/core/published', '@anotherharness/ah-published')
    const { planned } = planShared(ah, root, [published], '0.0.2')

    expect(planned.map(entry => ({ path: entry.manifestPath, tag: entry.tag }))).toEqual([
      { path: 'package.json', tag: undefined },
      { path: 'packages/core/published/package.json', tag: 'ah-v0.0.2' },
      { path: 'apps/desktop/package.json', tag: undefined },
      { path: 'packages/experimental/prototype/package.json', tag: undefined },
    ])
  })

  it.each(['0.0.2-alpha.1', '0.0.2-canary.1', '0.0.2-rc.1'])(
    'accepts the explicit ah prerelease version %s',
    (version) => {
      const root = mkdtempSync(join(tmpdir(), 'ah-release-prerelease-'))
      roots.push(root)
      write(join(root, 'package.json'), '{"version":"0.0.1"}\n')

      const ah = releaseFamily('ah')
      const published = member('packages/core/published', '@anotherharness/ah-published')
      const plan = planShared(ah, root, [published], version)

      expect(plan.version).toBe(version)
      expect(plan.planned[1]?.tag).toBe(`ah-v${version}`)
    },
  )

  it('names one tag for the whole ah family and one per vendored package', () => {
    const ah = releaseFamily('ah')
    const vendor = releaseFamily('vendor')
    const cli = member('apps/cli', '@anotherharness/ah')
    const cordis = { ...member('vendor/cordis', '@anotherharness/cordis'), version: '4.0.1' }

    expect(ah.tagFor(cli)).toBe('ah-v0.0.1')
    expect(vendor.tagFor(cordis)).toBe('vendor-cordis-v4.0.1')
    // The prefix is constructed, not recovered from a tag: a version with a
    // hyphen would defeat any suffix-stripping.
    expect(vendor.tagPrefixFor({ ...cordis, version: '4.0.0-rc.7' })).toBe('vendor-cordis-v')
    expect(vendor.tagFor({ ...cordis, version: '4.0.0-rc.7' })).toBe('vendor-cordis-v4.0.0-rc.7')
  })

  it('assigns alpha and canary dist-tags only to ah releases', () => {
    const ah = releaseFamily('ah')
    const vendor = releaseFamily('vendor')

    expect(ah.distTagForVersion('0.0.2-alpha.1')).toBe('alpha')
    expect(ah.distTagForVersion('0.0.2-canary.1')).toBe('canary')
    expect(ah.distTagForVersion('0.0.2-rc.1')).toBe('next')
    expect(ah.distTagForVersion('0.0.2')).toBeUndefined()
    expect(vendor.distTagForVersion('4.0.1-alpha.1')).toBe('next')
    expect(vendor.distTagForVersion('4.0.1-canary.1')).toBe('next')
  })

  it('rejects a family whose members disagree on the shared version', () => {
    const ah = releaseFamily('ah')
    const members = [member('apps/cli', '@anotherharness/ah'), { ...member('apps/web', '@anotherharness/ah-web-frontend'), version: '0.0.2' }]

    expect(() => { ah.verifyVersions(members) }).toThrow(/must share one version/)
    expect(() => { ah.verifyVersions([members[0]!]) }).not.toThrow()
  })

  it('accepts independent vendored versions and rejects an unpublishable one', () => {
    const vendor = releaseFamily('vendor')
    const members = [
      { ...member('vendor/cordis', '@anotherharness/cordis'), version: '4.0.1' },
      { ...member('vendor/cosmokit', '@anotherharness/cosmokit'), version: '1.8.2' },
    ]

    expect(() => { vendor.verifyVersions(members) }).not.toThrow()
    expect(() => { vendor.verifyVersions([{ ...members[0]!, version: 'latest' }]) }).toThrow(/unpublishable version/)
  })

  it('requires a current official client build only for ah artifacts', () => {
    const ah = releaseFamily('ah')
    const vendor = releaseFamily('vendor')
    const officialEnvironment = officialClientBuildEnvironment(resolve(import.meta.dirname, '../..'))
    vi.stubEnv('AH_CLIENT_COMMIT_HASH', officialEnvironment.AH_CLIENT_COMMIT_HASH)
    const official = buildFixture(officialEnvironment)
    const defaultBuild = buildFixture({})
    const missing = join(defaultBuild, 'missing')
    write(join(missing, 'package.json'), `${JSON.stringify({ version: officialEnvironment.AH_CLIENT_VERSION })}\n`)

    expect(() => { ah.verifyBuildArtifacts(official) }).not.toThrow()
    expect(() => { ah.verifyBuildArtifacts(defaultBuild) }).toThrow(/AH_CLIENT_TITLE/)
    expect(() => { ah.verifyBuildArtifacts(missing) }).toThrow(/record.*missing/)
    expect(() => { vendor.verifyBuildArtifacts(missing) }).not.toThrow()

    write(join(official, 'packages/client/example/lib/client.js'), 'module.exports = { changed: true }\n')
    expect(() => { ah.verifyBuildArtifacts(official) }).toThrow(/artifacts differ/)
  })

  it('publishes a dependency before its consumer, and orders ties by name', () => {
    const ah = releaseFamily('ah')
    const members = [
      member('packages/a/consumer', '@anotherharness/ah-consumer', { dependencies: { '@anotherharness/ah-library': 'workspace:^' } }),
      member('packages/a/library', '@anotherharness/ah-library'),
      member('packages/a/zebra', '@anotherharness/ah-zebra'),
    ]

    expect(ah.publishOrder(members).order.map(entry => entry.name)).toEqual([
      '@anotherharness/ah-library',
      '@anotherharness/ah-consumer',
      '@anotherharness/ah-zebra',
    ])
  })

  it('publishes on-demand catalog members before ah without adding installed dependencies', () => {
    const ah = member('apps/cli', '@anotherharness/ah')
    const providers = ON_DEMAND_BUNDLES.map(name => member(`packages/subagent/${name}`, name))
    const plan = releaseFamily('ah').publishOrder([ah, ...providers])
    expect(plan.order.map(entry => entry.name)).toEqual([...ON_DEMAND_BUNDLES, ah.name])
    expect(ah.manifest).toEqual({})
    expect(plan.droppedPeerEdges).toEqual([])
  })

  it('rejects an advertised provider missing from the public release family', () => {
    expect(() => releaseFamily('ah').publishOrder([member('apps/cli', '@anotherharness/ah')]))
      .toThrow('Official catalog prerequisite')
  })

  it('keeps catalog prerequisites ahead of a ah peer declaration', () => {
    const ah = member('apps/cli', '@anotherharness/ah')
    const providers = ON_DEMAND_BUNDLES.map(name => member(`packages/subagent/${name}`, name, {
      peerDependencies: { '@anotherharness/ah': 'workspace:*' },
    }))
    const plan = releaseFamily('ah').publishOrder([ah, ...providers])
    expect(plan.order.map(entry => entry.name)).toEqual([...ON_DEMAND_BUNDLES, ah.name])
    expect(plan.droppedPeerEdges).toEqual(ON_DEMAND_BUNDLES.map(name => ({ consumer: name, peer: ah.name })))
  })

  it.each(['dependencies', 'optionalDependencies', 'peerDependencies'])(
    'requires exact packed AH %s while preserving external ranges', (section) => {
      const pkg = member('packages/example/provider', '@anotherharness/ah-provider')
      const family = releaseFamily('ah')
      const manifest = { name: pkg.name, version: pkg.version, [section]: { '@anotherharness/ah-tools': pkg.version, external: '^4.0.0' } }
      expect(() => { family.validatePackedManifest(pkg, manifest) }).not.toThrow()
      for (const range of ['workspace:*', '^0.0.1', '~0.0.1', '0.0.2', '*']) {
        expect(() => { family.validatePackedManifest(pkg, { ...manifest, [section]: { '@anotherharness/ah-tools': range } }) })
          .toThrow(`packed ${section}.@anotherharness/ah-tools must equal`)
      }
    },
  )

  it('checks packed identities and preserves independent vendor versions', () => {
    const pkg = member('vendor/example', '@anotherharness/example')
    const family = releaseFamily('vendor')
    expect(() => { family.validatePackedManifest(pkg, { name: pkg.name, version: pkg.version, dependencies: { '@anotherharness/ah-tools': '^4.0.0' } }) })
      .not.toThrow()
    expect(() => { family.validatePackedManifest(pkg, { name: '@anotherharness/other', version: pkg.version }) }).toThrow('packed identity')
    expect(() => { family.validatePackedManifest(pkg, { name: pkg.name, version: '0.0.2' }) }).toThrow('packed identity')
  })

  it('reports a runtime dependency cycle instead of emitting an arbitrary order', () => {
    const ah = releaseFamily('ah')
    const members = [
      member('packages/a/left', '@anotherharness/ah-left', { dependencies: { '@anotherharness/ah-right': 'workspace:^' } }),
      member('packages/a/right', '@anotherharness/ah-right', { dependencies: { '@anotherharness/ah-left': 'workspace:^' } }),
    ]

    expect(() => { ah.publishOrder(members) }).toThrow(/dependency cycle/)
  })

  it('publishes a peer before its consumer', () => {
    const ah = releaseFamily('ah')
    const members = [
      member('packages/a/consumer', '@anotherharness/ah-consumer', { peerDependencies: { '@anotherharness/ah-zebra': 'workspace:^' } }),
      member('packages/a/zebra', '@anotherharness/ah-zebra'),
    ]

    // Name order alone would place the consumer first; the peer edge moves it.
    expect(ah.publishOrder(members).order.map(entry => entry.name)).toEqual([
      '@anotherharness/ah-zebra',
      '@anotherharness/ah-consumer',
    ])
  })

  it('orders around a peer cycle rather than refusing to publish, and reports the edge it dropped', () => {
    const ah = releaseFamily('ah')
    const members = [
      member('packages/a/left', '@anotherharness/ah-left', { peerDependencies: { '@anotherharness/ah-right': 'workspace:^' } }),
      member('packages/a/right', '@anotherharness/ah-right', { peerDependencies: { '@anotherharness/ah-left': 'workspace:^' } }),
    ]

    // Sibling packages declare each other as peers, and npm treats an unmet peer
    // as a warning, so this pair has to publish rather than fail the release.
    const plan = ah.publishOrder(members)
    expect(plan.order.map(entry => entry.name)).toEqual([
      '@anotherharness/ah-right',
      '@anotherharness/ah-left',
    ])
    // One of the two edges has to give, and which one it is belongs in the log.
    expect(plan.droppedPeerEdges).toEqual([
      { consumer: '@anotherharness/ah-right', peer: '@anotherharness/ah-left' },
    ])
  })

  it('honours an install edge even when a peer cycle surrounds it', () => {
    const ah = releaseFamily('ah')
    const members = [
      member('packages/a/base', '@anotherharness/ah-base', { peerDependencies: { '@anotherharness/ah-consumer': 'workspace:^' } }),
      member('packages/a/consumer', '@anotherharness/ah-consumer', {
        dependencies: { '@anotherharness/ah-base': 'workspace:^' },
        peerDependencies: { '@anotherharness/ah-base': 'workspace:^' },
      }),
    ]

    // The install edge is absolute: base publishes first, and the peer edge that
    // would reverse it is the one dropped.
    const plan = ah.publishOrder(members)
    expect(plan.order.map(entry => entry.name)).toEqual([
      '@anotherharness/ah-base',
      '@anotherharness/ah-consumer',
    ])
    expect(plan.droppedPeerEdges).toEqual([
      { consumer: '@anotherharness/ah-base', peer: '@anotherharness/ah-consumer' },
    ])
  })

  it('refuses an order that would publish a consumer before a dependency it installs', () => {
    const ah = releaseFamily('ah')
    const members = [
      member('packages/a/alpha', '@anotherharness/ah-alpha', { peerDependencies: { '@anotherharness/ah-bravo': 'workspace:^' } }),
      member('packages/a/bravo', '@anotherharness/ah-bravo', { peerDependencies: { '@anotherharness/ah-charlie': 'workspace:^' } }),
      member('packages/a/charlie', '@anotherharness/ah-charlie', { dependencies: { '@anotherharness/ah-alpha': 'workspace:^' } }),
    ]

    // A cycle of two peer edges closed by one install edge: dropping a peer edge
    // would order this, and the traversal drops the install edge instead. That
    // order would publish charlie before the alpha it installs, so it is refused
    // here rather than published.
    expect(() => { ah.publishOrder(members) }).toThrow(/no publish order honours @anotherharness\/ah-charlie -> @anotherharness\/ah-alpha/)
  })

  it('ignores devDependencies when ordering', () => {
    const ah = releaseFamily('ah')
    const members = [
      member('packages/a/alpha', '@anotherharness/ah-alpha', { devDependencies: { '@anotherharness/ah-zebra': 'workspace:^' } }),
      member('packages/a/zebra', '@anotherharness/ah-zebra'),
    ]

    // A dev dependency is absent from the published package, so it must not move
    // the consumer behind it.
    expect(ah.publishOrder(members).order.map(entry => entry.name)).toEqual([
      '@anotherharness/ah-alpha',
      '@anotherharness/ah-zebra',
    ])
  })

  it('applies the harness payload policy to ah and keeps upstream payloads for vendored packages', () => {
    const ah = releaseFamily('ah')
    const vendor = releaseFamily('vendor')
    const harness = member('packages/a/library', '@anotherharness/ah-library')
    const vendored = member('vendor/cordis', '@anotherharness/cordis')

    expect(() => { ah.validatePayload(harness, ['package/lib/index.js', 'package/src/index.ts']) })
      .toThrow(/publishes source file/)
    expect(() => { vendor.validatePayload(vendored, ['package/lib/index.js', 'package/src/index.ts']) }).not.toThrow()
    expect(() => { vendor.validatePayload(vendored, []) }).toThrow(/empty tarball/)
  })

  it('drives the installed entry only for the family that publishes one', () => {
    expect(releaseFamily('ah').installedEntry).toEqual({ packageName: '@anotherharness/ah', binPath: 'lib/bin.js' })
    expect(releaseFamily('vendor').installedEntry).toBeUndefined()
  })

  it('rejects an unknown family identifier', () => {
    expect(() => { releaseFamily('native') }).toThrow(/unknown release family/)
  })
})

describe('vendored version baseline', () => {
  it('drops an upstream prerelease segment and increments the patch', () => {
    expect(nextVendorVersion('4.0.0-rc.7', undefined)).toBe('4.0.1')
    expect(nextVendorVersion('1.0.0-rc.5', undefined)).toBe('1.0.1')
    expect(nextVendorVersion('1.8.1', undefined)).toBe('1.8.2')
  })

  it('increments from the last published version when a re-sync restored a lower one', () => {
    // Upstream moved rc.7 -> rc.8 after this repository published 4.0.1;
    // incrementing the manifest alone would name 4.0.1 a second time.
    expect(nextVendorVersion('4.0.0-rc.8', '4.0.1')).toBe('4.0.2')
    expect(nextVendorVersion('4.1.0', '4.0.1')).toBe('4.1.1')
  })

  it('appends a rehearsal prerelease without consuming its release numbers', () => {
    // A rehearsal burns 4.0.1-rc.1 and leaves 4.0.1 free, so the stable release
    // that follows takes those same numbers instead of skipping to 4.0.2.
    expect(nextVendorVersion('4.0.0-rc.7', undefined, 'rc.1')).toBe('4.0.1-rc.1')
    expect(nextVendorVersion('4.0.0-rc.7', '4.0.1-rc.1', 'rc.2')).toBe('4.0.1-rc.2')
    expect(nextVendorVersion('4.0.0-rc.7', '4.0.1-rc.1')).toBe('4.0.1')
    expect(nextVendorVersion('4.0.0-rc.7', '4.0.1')).toBe('4.0.2')
  })
})

describe('version precedence', () => {
  it('orders alpha, canary, and release-candidate versions by semver precedence', () => {
    expect(compareVersions('4.0.1-alpha.1', '4.0.1-canary.1')).toBeLessThan(0)
    expect(compareVersions('4.0.1-canary.1', '4.0.1-rc.1')).toBeLessThan(0)
    expect(compareVersions('4.0.1-rc.1', '4.0.1')).toBeLessThan(0)
  })

  it('ranks a release above the prerelease it follows', () => {
    // git --sort=v:refname disagrees, placing 4.0.1-rc.1 above 4.0.1, which is
    // why the newest published version is chosen here rather than by git.
    expect(compareVersions('4.0.1', '4.0.1-rc.1')).toBeGreaterThan(0)
    expect(compareVersions('4.0.1-rc.1', '4.0.1')).toBeLessThan(0)
  })

  it('compares numeric prerelease fields numerically', () => {
    expect(compareVersions('4.0.1-rc.10', '4.0.1-rc.1')).toBeGreaterThan(0)
    expect(compareVersions('4.0.1-rc.2', '4.0.1-rc.10')).toBeLessThan(0)
  })

  it('ranks a numeric field below an alphanumeric one, and a shorter list below a longer', () => {
    expect(compareVersions('4.0.1-1', '4.0.1-alpha')).toBeLessThan(0)
    expect(compareVersions('4.0.1-rc', '4.0.1-rc.1')).toBeLessThan(0)
    expect(compareVersions('4.0.2', '4.0.1')).toBeGreaterThan(0)
    expect(compareVersions('4.0.1-rc.1', '4.0.1-rc.1')).toBe(0)
  })
})

describe('payload change judgement', () => {
  const sourceShipping = member('vendor/cosmokit', '@anotherharness/cosmokit', {
    files: ['lib/index.js', 'lib/types/**/*.d.ts', 'src'],
  })
  const buildOutputOnly = member('vendor/cordis', '@anotherharness/cordis', {
    files: ['lib/index.js', 'lib/types/**/*.d.ts', 'bin.js'],
  })

  it('counts the manifest and the files npm always publishes', () => {
    expect(reachesPayload(sourceShipping, 'vendor/cosmokit/package.json')).toBe(true)
    expect(reachesPayload(sourceShipping, 'vendor/cosmokit/README.md')).toBe(true)
    expect(reachesPayload(sourceShipping, 'vendor/cosmokit/src/index.ts')).toBe(true)
  })

  it('counts build inputs for a package whose payload is build output', () => {
    // cordis publishes lib/ only, and lib/ is not tracked: without this, a real
    // source change reads as "nothing changed" and the next publish fails on a
    // version whose bytes moved.
    expect(reachesPayload(buildOutputOnly, 'vendor/cordis/src/context.ts')).toBe(true)
    expect(reachesPayload(buildOutputOnly, 'vendor/cordis/tsconfig.json')).toBe(true)
  })

  it('ignores paths no tarball carries', () => {
    expect(reachesPayload(sourceShipping, 'vendor/cosmokit/tests/unit.spec.ts')).toBe(false)
    expect(reachesPayload(sourceShipping, 'vendor/cosmokit/CHANGELOG.md')).toBe(false)
    // The README pattern is deliberately loose: over-reporting a change costs one
    // unnecessary patch bump, while under-reporting fails the next publish on a
    // version whose bytes moved.
    expect(reachesPayload(sourceShipping, 'vendor/cosmokit/README.i18n.yaml')).toBe(true)
    expect(reachesPayload(member('packages/a/library', '@anotherharness/ah-library', { files: ['lib/index.js'] }),
      'packages/a/library/tests/library.spec.ts')).toBe(false)
  })
})
