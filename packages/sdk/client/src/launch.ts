/**
 * Resolve the public SDK launch configuration to one ah subprocess.
 * @module @anotherharness/ah-sdk-client/launch
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { HarnessClientOptions } from './types.ts'

/** Default bound for a profile to answer the SDK initialize handshake. */
export const DEFAULT_INITIALIZE_TIMEOUT_MS = 10_000

/** Internal generic process launch used by the transport and fake-runtime tests. */
export interface RuntimeProcessOptions {
  command: string
  args: string[]
  cwd?: string
  /** Materialize the complete child environment when the client starts its subprocess. */
  environment: () => NodeJS.ProcessEnv
  description: string
  initializeTimeoutMs: number
  requestTimeoutMs?: number
  shutdownTimeoutMs?: number
  disposeEofGraceMs?: number
  disposeGraceMs?: number
}

/** Node argv plus internal profile patches required by one resolved ah entry. */
export interface AhNodeLaunch {
  /** Arguments before the profile selector. */
  nodeArgs: string[]
  /** Internal patches applied below caller-supplied patches. */
  patches: string[]
  /** Environment values required by the resolved entry mode. */
  environment: NodeJS.ProcessEnv
}

interface PackageManifest {
  version?: unknown
  bin?: unknown
}

/** Read a package manifest from one resolved package.json URL. */
function manifest(url: string): PackageManifest {
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as PackageManifest
}

/**
 * Resolve and version-check a ah executable from package manifests.
 * @param ahManifestUrl - resolved URL of the ah package manifest.
 * @param clientManifestUrl - resolved URL of the SDK client manifest.
 * @returns the absolute ah executable path.
 */
export function resolveAhBinFromManifests(ahManifestUrl: string, clientManifestUrl: string): string {
  const ahManifest = manifest(ahManifestUrl)
  const clientManifest = manifest(clientManifestUrl)
  if (typeof ahManifest.version !== 'string' || ahManifest.version !== clientManifest.version) {
    throw new Error(`ah SDK client ${String(clientManifest.version)} requires the same ah version, got ${String(ahManifest.version)}`)
  }
  const bin = typeof ahManifest.bin === 'object' && ahManifest.bin !== null
    ? (ahManifest.bin as Record<string, unknown>).ah
    : ahManifest.bin
  if (typeof bin !== 'string' || bin === '') throw new Error('@anotherharness/ah declares no ah executable')
  return resolve(dirname(fileURLToPath(ahManifestUrl)), bin)
}

/**
 * Resolve and version-check the built ah executable installed with this SDK.
 * @returns the absolute built executable path, whether or not it exists in a source checkout.
 */
export function installedAhBin(): string {
  return resolveAhBinFromManifests(
    import.meta.resolve('@anotherharness/ah/package.json'),
    new URL('../package.json', import.meta.url).href,
  )
}

/**
 * Resolve the Node launch for one same-version ah package.
 * @param ahManifestUrl - resolved URL of the ah package manifest.
 * @param clientManifestUrl - resolved URL of the SDK client manifest.
 * @param sourceLoaderUrl - optional absolute tsx loader URL for deterministic tests.
 * @returns built output, or the source entry plus its compatibility patch and tsx environment.
 */
export function resolveAhNodeLaunchFromManifests(
  ahManifestUrl: string,
  clientManifestUrl: string,
  sourceLoaderUrl?: string,
): AhNodeLaunch {
  const bin = resolveAhBinFromManifests(ahManifestUrl, clientManifestUrl)
  if (existsSync(bin)) return { nodeArgs: [bin], patches: [], environment: {} }

  const packageDir = dirname(fileURLToPath(ahManifestUrl))
  const sourceBin = resolve(packageDir, 'src/bin.ts')
  const sourcePatch = resolve(packageDir, 'src/sdk-source.cordis.patch.yml')
  const sourceTsconfig = resolve(packageDir, 'tsconfig.json')
  if (!existsSync(sourceBin) || !existsSync(sourcePatch) || !existsSync(sourceTsconfig)) {
    throw new Error(
      `@anotherharness/ah is missing its built executable ${bin} and complete source launch files ${sourceBin}, ${sourcePatch}, ${sourceTsconfig}`,
    )
  }
  const loader = sourceLoaderUrl ?? import.meta.resolve('tsx/esm')
  return {
    nodeArgs: ['--import', loader, sourceBin],
    patches: [sourcePatch],
    environment: { TSX_TSCONFIG_PATH: sourceTsconfig },
  }
}

/**
 * Resolve the installed ah package to a built or source Node launch.
 * @returns the launch descriptor for the current checkout or installed package.
 */
function installedAhNodeLaunch(): AhNodeLaunch {
  return resolveAhNodeLaunchFromManifests(
    import.meta.resolve('@anotherharness/ah/package.json'),
    new URL('../package.json', import.meta.url).href,
  )
}

/**
 * Resolve caller-relative filesystem inputs and construct canonical ah argv.
 * @param options - public SDK launch options.
 * @param callerCwd - parent-process directory used for lexical resolution.
 * @returns one generic subprocess spec for the JSON-RPC transport.
 */
export function resolveAhLaunch(
  options: HarnessClientOptions = {},
  callerCwd: string = process.cwd(),
): RuntimeProcessOptions {
  const profile = options.profile ?? 'sdk'
  const ahLaunch = options.ahBin === undefined
    ? installedAhNodeLaunch()
    : { nodeArgs: [resolve(callerCwd, options.ahBin)], patches: [], environment: {} }
  const patches = [
    ...ahLaunch.patches,
    ...(options.patches ?? []).map(path => resolve(callerCwd, path)),
  ]
  const ahHome = options.ahHome === undefined ? undefined : resolve(callerCwd, options.ahHome)
  return {
    command: process.execPath,
    args: [...ahLaunch.nodeArgs, '--profile', profile, ...patches.flatMap(path => ['--patch', path])],
    ...options.processCwd === undefined ? {} : { cwd: resolve(callerCwd, options.processCwd) },
    environment: () => ({
      ...(options.env ?? process.env),
      ...ahLaunch.environment,
      ...ahHome === undefined ? {} : { AH_HOME: ahHome },
    }),
    description: `ah profile ${JSON.stringify(profile)}`,
    initializeTimeoutMs: options.initializeTimeoutMs ?? DEFAULT_INITIALIZE_TIMEOUT_MS,
    ...options.requestTimeoutMs === undefined ? {} : { requestTimeoutMs: options.requestTimeoutMs },
    ...options.shutdownTimeoutMs === undefined ? {} : { shutdownTimeoutMs: options.shutdownTimeoutMs },
    ...options.disposeEofGraceMs === undefined ? {} : { disposeEofGraceMs: options.disposeEofGraceMs },
    ...options.disposeGraceMs === undefined ? {} : { disposeGraceMs: options.disposeGraceMs },
  }
}
