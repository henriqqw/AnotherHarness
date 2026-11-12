import { describe, expect, it } from 'vitest'
import type { NpmPackageLock, RegistryIndex } from './benchmark-npm-resolution.ts'
import {
  assertDualAhInstallLayout,
  assertResolutionWorkBudget,
  buildDualAhRegistry,
  MAX_RESOLUTION_WORK_UNITS,
} from './verify-npm-install-layout.ts'

function validLayout(): NpmPackageLock {
  return {
    lockfileVersion: 3,
    packages: {
      '': { dependencies: { '@anotherharness/ah': '0.2.0', 'ah-previous': 'npm:@anotherharness/ah@0.1.0' } },
      'node_modules/@anotherharness/cordis': { version: '4.0.1' },
      'node_modules/@anotherharness/ah': {
        version: '0.2.0',
        dependencies: { '@anotherharness/ah-child': '^0.2.0' },
        peerDependencies: { '@anotherharness/cordis': '^4.0.1' },
      },
      'node_modules/@anotherharness/ah-child': {
        version: '0.2.0',
        dependencies: { '@anotherharness/ah-leaf': '^0.2.0' },
      },
      'node_modules/@anotherharness/ah-leaf': { version: '0.2.0' },
      'node_modules/ah-previous': {
        name: '@anotherharness/ah',
        version: '0.1.0',
        dependencies: { '@anotherharness/ah-child': '^0.1.0' },
        peerDependencies: { '@anotherharness/cordis': '^4.0.1' },
      },
      'node_modules/ah-previous/node_modules/@anotherharness/ah-child': {
        version: '0.1.0',
        dependencies: { '@anotherharness/ah-leaf': '^0.1.0' },
      },
      'node_modules/ah-previous/node_modules/@anotherharness/ah-leaf': { version: '0.1.0' },
    },
  }
}

describe('npm install layout verifier', () => {
  it('creates two incompatible versions of every AH package', () => {
    const index: RegistryIndex = new Map([
      ['@anotherharness/ah', new Map([['0.1.1-rc.2', {
        name: '@anotherharness/ah',
        version: '0.1.1-rc.2',
        dependencies: { '@anotherharness/ah-child': '^0.1.1-rc.2' },
        peerDependencies: { '@anotherharness/cordis': '^4.0.1' },
      }]])],
      ['@anotherharness/ah-child', new Map([['0.1.1-rc.2', {
        name: '@anotherharness/ah-child',
        version: '0.1.1-rc.2',
      }]])],
      ['@anotherharness/cordis', new Map([['4.0.1', {
        name: '@anotherharness/cordis',
        version: '4.0.1',
      }]])],
    ])

    const dual = buildDualAhRegistry(index, '0.1.1-rc.2')

    expect([...dual.get('@anotherharness/ah')?.keys() ?? []]).toEqual(['0.1.0', '0.2.0'])
    expect(dual.get('@anotherharness/ah')?.get('0.1.0')).toMatchObject({
      version: '0.1.0',
      dependencies: { '@anotherharness/ah-child': '^0.1.0' },
      peerDependencies: { '@anotherharness/cordis': '^4.0.1' },
    })
    expect(dual.get('@anotherharness/ah')?.get('0.2.0')).toMatchObject({
      version: '0.2.0',
      dependencies: { '@anotherharness/ah-child': '^0.2.0' },
    })
    expect(dual.get('@anotherharness/cordis')).toBe(index.get('@anotherharness/cordis'))
  })

  it('accepts isolated AH releases with one shared Cordis installation', () => {
    expect(assertDualAhInstallLayout(validLayout())).toEqual({
      ahPackagesPerVersion: 3,
      checkedAhEdges: 4,
    })
  })

  it.each([
    ['react', 'node_modules/react'],
    ['react-dom', 'node_modules/react-dom'],
    ['react', 'node_modules/ah-previous/node_modules/react'],
    ['react-dom', 'node_modules/ah-previous/node_modules/react-dom'],
  ])('rejects browser runtime %s installed at %s in the AH-only consumer', (name, path) => {
    const layout = validLayout()
    const packages = { ...layout.packages, [path]: { version: '18.3.1' } }
    expect(() => assertDualAhInstallLayout({ ...layout, packages })).toThrow(
      `${path}: ${name} is a browser build input`,
    )
  })

  it('rejects an internal edge that crosses release versions', () => {
    const layout = validLayout()
    const packages = { ...layout.packages }
    Reflect.deleteProperty(packages, 'node_modules/ah-previous/node_modules/@anotherharness/ah-leaf')

    expect(() => assertDualAhInstallLayout({ ...layout, packages })).toThrow(
      'node_modules/ah-previous/node_modules/@anotherharness/ah-child: dependencies '
      + '@anotherharness/ah-leaf resolves to node_modules/@anotherharness/ah-leaf@0.2.0, expected 0.1.0',
    )
  })

  it('rejects a second Cordis installation', () => {
    const layout = validLayout()
    const packages = {
      ...layout.packages,
      'node_modules/ah-previous/node_modules/@anotherharness/cordis': { version: '4.0.1' },
    }

    expect(() => assertDualAhInstallLayout({ ...layout, packages })).toThrow(
      'expected one shared @anotherharness/cordis',
    )
  })
})

describe('resolution work budget', () => {
  it('accepts the measured dual-release graph', () => {
    expect(assertResolutionWorkBudget({ ahPackagesPerVersion: 277, checkedAhEdges: 2524 }))
      .toBe(699_148)
  })

  it('accepts a graph exactly at the budget and rejects one internal edge above it', () => {
    const packages = 350
    const edgesAtBudget = Math.floor(MAX_RESOLUTION_WORK_UNITS / packages)

    expect(packages * edgesAtBudget).toBe(MAX_RESOLUTION_WORK_UNITS)
    expect(assertResolutionWorkBudget({ ahPackagesPerVersion: packages, checkedAhEdges: edgesAtBudget }))
      .toBe(MAX_RESOLUTION_WORK_UNITS)
    expect(() => assertResolutionWorkBudget({
      ahPackagesPerVersion: packages,
      checkedAhEdges: edgesAtBudget + 1,
    })).toThrow(`= ${String(MAX_RESOLUTION_WORK_UNITS + packages)} unit(s), budget ${String(MAX_RESOLUTION_WORK_UNITS)} unit(s)`)
  })

  it('accepts the headroom and rejects a runaway graph with its own measured counts', () => {
    expect(assertResolutionWorkBudget({ ahPackagesPerVersion: 300, checkedAhEdges: 2800 }))
      .toBe(840_000)
    expect(() => assertResolutionWorkBudget({ ahPackagesPerVersion: 400, checkedAhEdges: 3000 }))
      .toThrow('400 package(s) per release x 3000 internal edge(s) = 1200000 unit(s), budget 875000 unit(s)')
  })
})
