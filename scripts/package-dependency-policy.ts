/** Explicit exceptions and Host packages for the published dependency policy. */

/** Packages treated as Client/Host packages without declaring `ah.client`. */
const CLIENT_FACE_INCLUDE: readonly string[] = []

/** Packages exempted from automatic Client/Host treatment despite declaring `ah.client`. */
const CLIENT_FACE_EXCLUDE: readonly string[] = [
  '@anotherharness/ah-api-session-controller',
  '@anotherharness/ah-api-workspace-controller',
]

/** Host-only packages whose peer relays are deliberately flattened. */
const HOST_DEPENDENCY_PACKAGES: readonly string[] = [
  '@anotherharness/ah-llm',
  '@anotherharness/ah-session',
]

/** Required Cordis services whose Host imports are type-only. */
const REQUIRED_SERVICE_PEERS = {
  '@anotherharness/ah-api-terminal-controller': ['@anotherharness/ah-subprocess'],
} as const satisfies Readonly<Record<string, readonly string[]>>

/** Development-only package relationships not represented by source imports. */
const CONFIGURATION_ONLY_DEV_DEPENDENCIES = {
  '@anotherharness/ah-client-locale': ['@anotherharness/ah-api-remotes'],
  '@anotherharness/ah-client-ui-conversation': [
    '@anotherharness/ah-api-remotes',
    '@anotherharness/ah-client-ui-workspace',
  ],
  '@anotherharness/ah-client-ui-model-selection': ['@anotherharness/ah-client-ui-input-trigger'],
  '@anotherharness/ah-client-ui-sidebar': ['@anotherharness/ah-client-ui-workspace'],
  '@anotherharness/ah-client-ui-subagent': ['@anotherharness/ah-client-ui-input-trigger'],
  '@anotherharness/ah-client-ui-theme': ['@anotherharness/ah-api-remotes'],
  '@anotherharness/ah-client-ui-tool': ['@anotherharness/ah-api-remotes'],
} as const satisfies Readonly<Record<string, readonly string[]>>

/** Workspace packages whose complete runtime surface is safe across duplicate installations. */
const DUPLICATE_SAFE_PACKAGES: readonly string[] = [
  '@anotherharness/ah-brand',
  '@anotherharness/ah-lazy-require',
  '@anotherharness/ah-typert-protocol',
  '@anotherharness/ah-util-code-language',
  '@anotherharness/ah-util-crypto',
  '@anotherharness/ah-util-values',
]

/**
 * Runtime exports whose values remain valid when npm installs another package copy.
 * New entries are forbidden by default. Automated agents must not add an
 * exception; every addition requires explicit human review and a dedicated,
 * prominent heading in the pull request description.
 */
const SAFE_HOST_DEPENDENCY_EXPORTS = {
  '@anotherharness/ah-credentials': ['credentialKey'],
  '@anotherharness/ah-deque': ['Deque'],
  '@anotherharness/ah-llm': ['callConfigEquals'],
  '@anotherharness/ah-session-format': ['sessionFormatLogFilename'],
  '@anotherharness/ah-timeout': ['MAX_TIMER_DELAY_MS'],
  '@anotherharness/schemastery': ['default'],
} as const satisfies HostDependencyExports

/** Runtime exports that require every consumer to resolve the provider's shared peer instance. */
const PEER_REQUIRED_HOST_EXPORTS = {
  '@anotherharness/ah-client-connection': ['OperatorPeer'],
  '@anotherharness/ah-scope': ['carrierKeyOf', 'createScope', 'scopeOf', 'scopeTarget'],
  '@anotherharness/ah-session': ['SESSION_FORMAT_VERSION'],
  '@anotherharness/ah-session-persistence': ['SessionPersistenceNotFoundError'],
} as const satisfies HostDependencyExports

/** Exact import specifier to reviewed runtime exports. */
type HostDependencyExports = Readonly<Record<string, readonly string[]>>

/** Complete configurable input to package dependency classification. */
export interface PackageDependencyPolicy {
  readonly clientFaceInclude: readonly string[]
  readonly clientFaceExclude: readonly string[]
  readonly hostPackages: readonly string[]
  readonly requiredServicePeers?: Readonly<Record<string, readonly string[]>>
  readonly configurationOnlyDevDependencies: Readonly<Record<string, readonly string[]>>
  readonly duplicateSafePackages?: readonly string[]
  readonly safeHostDependencyExports: HostDependencyExports
  readonly peerRequiredHostExports: HostDependencyExports
}

/** Repository dependency policy consumed by verification and benchmarking. */
export const PACKAGE_DEPENDENCY_POLICY: PackageDependencyPolicy = {
  clientFaceInclude: CLIENT_FACE_INCLUDE,
  clientFaceExclude: CLIENT_FACE_EXCLUDE,
  hostPackages: HOST_DEPENDENCY_PACKAGES,
  requiredServicePeers: REQUIRED_SERVICE_PEERS,
  configurationOnlyDevDependencies: CONFIGURATION_ONLY_DEV_DEPENDENCIES,
  duplicateSafePackages: DUPLICATE_SAFE_PACKAGES,
  safeHostDependencyExports: SAFE_HOST_DEPENDENCY_EXPORTS,
  peerRequiredHostExports: PEER_REQUIRED_HOST_EXPORTS,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Whether a package manifest declares a dynamically loaded Client entry. */
export function hasClientDeclaration(ahField: unknown): boolean {
  return isRecord(ahField) && Object.hasOwn(ahField, 'client')
}

/** Whether the repository policy flattens one package's non-Cordis peers. */
export function usesFlattenedPackageDependencies(
  manifestPath: string,
  packageName: string,
  ahField: unknown,
  policy: PackageDependencyPolicy = PACKAGE_DEPENDENCY_POLICY,
): boolean {
  if (!manifestPath.startsWith('packages/') || manifestPath.startsWith('packages/experimental/')) return false
  if (policy.hostPackages.includes(packageName)) return true
  if (manifestPath.startsWith('packages/client/')) return true
  const included = hasClientDeclaration(ahField) || policy.clientFaceInclude.includes(packageName)
  return included && !policy.clientFaceExclude.includes(packageName)
}
