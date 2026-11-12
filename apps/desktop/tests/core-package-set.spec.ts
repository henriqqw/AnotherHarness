import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DESKTOP_PACKAGES_DIR,
  DESKTOP_PACKAGE_SET_FILE,
  desktopCorePackageOverrides,
  desktopAhPackageSpec,
  parseDesktopCorePackageSet,
  verifyDesktopCoreLockfile,
  verifyDesktopCorePackageSet,
  type DesktopCorePackageRecord,
} from '../src/core-package-set.ts'

const roots: string[] = []

function record(name: string, file: string, body: Buffer, version = '1.2.3'): DesktopCorePackageRecord {
  return {
    name,
    version,
    file,
    bytes: body.byteLength,
    integrity: `sha512-${createHash('sha512').update(body).digest('base64')}`,
  }
}

function packageSetProject(): {
  root: string
  ah: DesktopCorePackageRecord
  base: DesktopCorePackageRecord
  host: DesktopCorePackageRecord
} {
  const root = mkdtempSync(join(tmpdir(), 'ah-desktop-package-set-'))
  roots.push(root)
  const packageDir = join(root, DESKTOP_PACKAGES_DIR)
  mkdirSync(packageDir)
  const ahBody = Buffer.from('ah')
  const baseBody = Buffer.from('base')
  const hostBody = Buffer.from('host')
  const ah = record('@anotherharness/ah', 'ah.tgz', ahBody)
  const base = record('@anotherharness/ah-base', 'ah-base.tgz', baseBody)
  const host = record('@anotherharness/ah-desktop-host', 'ah-desktop-host.tgz', hostBody)
  writeFileSync(join(packageDir, ah.file), ahBody)
  writeFileSync(join(packageDir, base.file), baseBody)
  writeFileSync(join(packageDir, host.file), hostBody)
  writeFileSync(join(root, DESKTOP_PACKAGE_SET_FILE), `${JSON.stringify({
    schemaVersion: 1,
    packages: [ah, base, host],
  })}\n`)
  return { root, ah, base, host }
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('desktop core package set', () => {
  it('pins the direct ah dependency and every internal package to local tarballs', () => {
    const { root } = packageSetProject()
    const packageSet = verifyDesktopCorePackageSet(root, '1.2.3')
    expect(desktopAhPackageSpec(packageSet)).toBe('file:./desktop-packages/ah.tgz')
    expect(desktopCorePackageOverrides(packageSet)).toEqual({
      '@anotherharness/ah': 'file:./desktop-packages/ah.tgz',
      '@anotherharness/ah-base': 'file:./desktop-packages/ah-base.tgz',
      '@anotherharness/ah-desktop-host': 'file:./desktop-packages/ah-desktop-host.tgz',
    })
  })

  it('rejects version drift, descriptor disorder, corruption, and extra files', () => {
    const { root, ah, base, host } = packageSetProject()
    expect(() => verifyDesktopCorePackageSet(root, '2.0.0')).toThrow(/does not match Desktop/u)
    expect(() => parseDesktopCorePackageSet({
      schemaVersion: 1,
      packages: [ah, base, { ...host, version: '2.0.0' }],
    }, '1.2.3')).toThrow(/ah-desktop-host@2\.0\.0 does not match Desktop 1\.2\.3/u)
    expect(() => parseDesktopCorePackageSet({ schemaVersion: 1, packages: [base, ah, host] }))
      .toThrow(/sorted by name/u)
    writeFileSync(join(root, DESKTOP_PACKAGES_DIR, ah.file), 'changed')
    expect(() => verifyDesktopCorePackageSet(root, '1.2.3')).toThrow(/integrity check failed/u)
    writeFileSync(join(root, DESKTOP_PACKAGES_DIR, 'extra.tgz'), '')
    expect(() => verifyDesktopCorePackageSet(root, '1.2.3')).toThrow(/does not match its descriptor/u)
  })

  it('rejects registry resolutions for names supplied by the local package set', () => {
    const ah = record('@anotherharness/ah', 'ah.tgz', Buffer.from('ah'))
    const host = record('@anotherharness/ah-desktop-host', 'host.tgz', Buffer.from('host'))
    const packageSet = parseDesktopCorePackageSet({ schemaVersion: 1, packages: [ah, host] })
    expect(() => {
      verifyDesktopCoreLockfile(
        "packages:\n  '@anotherharness/ah@file:desktop-packages/ah.tgz':\n    resolution: {}\n",
        packageSet,
      )
    }).not.toThrow()
    expect(() => {
      verifyDesktopCoreLockfile(
        "packages:\n  '@anotherharness/ah@1.2.3':\n    resolution: {integrity: sha512-registry}\n",
        packageSet,
      )
    }).toThrow(/outside the local package set/u)
  })
})
