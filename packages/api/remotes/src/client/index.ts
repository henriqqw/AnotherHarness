/** Platform-neutral assembly of generated Host Remote contributions. */

import type { Context } from '@anotherharness/cordis'
import productAnalyticsRemote from '@anotherharness/ah-client-product-analytics/remote'
export type {} from '@anotherharness/ah-client-product-analytics/remote'
import agentPresetsRemote from '@anotherharness/ah-agent-preset-registry/remote'
import userQuestionsRemote from '@anotherharness/ah-user-questions/remote'
import commandsRemote from '@anotherharness/ah-commands/remote'
import accountRemote from '@anotherharness/ah-api-account-controller/remote'
import settingsControllerRemote from '@anotherharness/ah-api-settings-controller/remote'
import officeToPdfRemote from '@anotherharness/ah-office-to-pdf/remote'
import goalsRemote from '@anotherharness/ah-goal/remote'
import scheduleRemote from '@anotherharness/ah-schedule/remote'
import llmRemote from '@anotherharness/ah-llm/remote'
import dynamicRemote from '@anotherharness/ah-cordis-host-runner/remote'
import pluginManagerRemote from '@anotherharness/ah-plugin-manager/remote'
import pluginRegistryProbeRemote from '@anotherharness/ah-client-ui-plugin-manager/remote'
import pluginInventoryRemote from '@anotherharness/ah-host-plugin-inventory/remote'
import messageFeedbackRemote from '@anotherharness/ah-message-feedback/remote'
import permissionPresetsRemote from '@anotherharness/ah-permission-presets/remote'
import sessionFeedbackRemote from '@anotherharness/ah-command-feedback/remote'
import fileUploadsRemote from '@anotherharness/ah-client-file-upload/remote'
import sessionReferencesRemote from '@anotherharness/ah-session-reference/remote'
import subagentsRemote from '@anotherharness/ah-subagent/remote'
import sessionRemote from '@anotherharness/ah-api-session-controller/remote'
import jobRemote from '@anotherharness/ah-api-job-controller/remote'
import workspaceRemote from '@anotherharness/ah-api-workspace-controller/remote'
import terminalRemote from '@anotherharness/ah-api-terminal-controller/remote'
import workspaceFilesRemote from '@anotherharness/ah-api-workspace-files/remote'
import type { ClientRemote } from '@anotherharness/ah-api-gateway/client'

export type { ClientRemote } from '@anotherharness/ah-api-gateway/client'
export type {
  BundleInfo, BundleRowInfo, ChangeResult, IncompatiblePlugin, InspectOptions, InstallBundleOptions, InstallSpecKind, ManagementError,
  PackageResult,
  PluginChange, PluginEntryId, PluginInfo, PluginInspectProblem, PluginInstallCancellation, PluginInstallFailureKind,
  PluginInstallLogChunk, PluginInstallProgress, PluginInstallRequestId, PluginRegistries, PluginSpecInspection, ReadOnlyReason, Registry,
} from '@anotherharness/ah-plugin-manager/types'
export type {} from '@anotherharness/ah-plugin-manager/remote'
export type {} from '@anotherharness/ah-client-ui-plugin-manager/remote'
export type { PluginInventorySnapshot } from '@anotherharness/ah-host-plugin-inventory/types'
export type {} from '@anotherharness/ah-agent-preset-registry/remote'
export type {} from '@anotherharness/ah-user-questions/remote'
export type {} from '@anotherharness/ah-commands/remote'
export type {} from '@anotherharness/ah-api-settings-controller/remote'
export type {} from '@anotherharness/ah-api-account-controller/remote'
export type {} from '@anotherharness/ah-goal/remote'
export type {} from '@anotherharness/ah-schedule/remote'
export type {} from '@anotherharness/ah-office-to-pdf/remote'
export type {} from '@anotherharness/ah-llm/remote'
export type {} from '@anotherharness/ah-host-plugin-inventory/remote'
export type {} from '@anotherharness/ah-message-feedback/remote'
export type {} from '@anotherharness/ah-permission-presets/remote'
export type {} from '@anotherharness/ah-command-feedback/remote'
export type {} from '@anotherharness/ah-client-file-upload/remote'
export type {} from '@anotherharness/ah-session-reference/remote'
export type {} from '@anotherharness/ah-subagent/remote'
export type * from '@anotherharness/ah-subagent/client'
export type {} from '@anotherharness/ah-api-session-controller/remote'
export type * from '@anotherharness/ah-api-session-controller/types'
export type {} from '@anotherharness/ah-api-job-controller/remote'
export type * from '@anotherharness/ah-api-job-controller/types'
export type {} from '@anotherharness/ah-api-workspace-controller/remote'
export type * from '@anotherharness/ah-api-workspace-controller/types'
export type {} from '@anotherharness/ah-api-workspace-files/remote'
export type * from '@anotherharness/ah-api-workspace-files/types'
export type {} from '@anotherharness/ah-api-terminal-controller/remote'
export type * from '@anotherharness/ah-api-terminal-controller/types'
// The forwarded-event allowlist's selection seat: without it in the consumer's
// compilation face `TypertRemoteEvent` is `never` and every `$on` call fails.
export type { ApiRemoteForwardedEvent } from '../types.ts'
// The owner packages' client-safe `./types` exports supply the `Events`
// signatures `$on` hands to a listener, so a consumer reads the very
// declaration the Host emits rather than a flattened restatement of it.
export type {} from '@anotherharness/ah-commands/types'
export type {} from '@anotherharness/ah-cordis-host-runner/types'
export type {} from '@anotherharness/ah-credentials/types'
export type {} from '@anotherharness/ah-llm/types'
export type {} from '@anotherharness/ah-agent-preset-registry/types'
export type {} from '@anotherharness/ah-permission-presets/types'
export type {} from '@anotherharness/ah-settings/types'
export type {} from '@anotherharness/ah-user-approval/types'
export type {} from '@anotherharness/ah-user-questions/types'
export type {} from '@anotherharness/ah-api-session-controller/types'

/**
 * The carrier's Client-facing types, re-exported so a business package names one
 * assembly package instead of both this facade and the Connection plugin. Type-only:
 * the carrier's runtime values stay behind their own module edge.
 */
export type {
  ConnectionHandle, ConnectionSinks, ContentBlock,
  MessageId,
  RpcId, RpcRequest, RpcResponse, RpcResult, SessionId,
  StreamChunk,
} from '@anotherharness/ah-client-connection/client'
export type {} from '@anotherharness/ah-api-gateway/client'
export type {} from '@anotherharness/ah-cordis-host-runner/remote'

// The payload vocabulary of the selected namespaces, re-exported so a Client
// contribution can name what it sends and receives without importing a Host
// package: this assembly is the one place both planes legitimately meet.
export type {
  ApprovalRequestId,
  CordisHalfState,
  CordisDynamicPackageId,
  CordisDynamicPluginId,
  CordisDynamicPluginRunId,
  CordisDynamicRunMode,
  CordisInspectMethodManifest,
  CordisInspectPlatform,
  CordisInspectProviderManifest,
  CordisInspectProviderView,
  CordisInspectQueryRequest,
  CordisInspectQueryResolution,
  CordisInspectQueryResolved,
  CordisInspectRequestId,
  CordisInspectResolveAck,
  CordisRunDiagnostic,
  CordisRunStatus,
  DynamicCordisClientSource,
  DynamicCordisHostHalfResult,
  DynamicCordisInventoryRow,
  DynamicCordisInvokeResult,
  DynamicCordisPackage,
  DynamicCordisRequestResolved,
  DynamicCordisResolveAck,
  DynamicCordisRetracted,
  DynamicCordisRunRequest,
  DynamicCordisRunResolution,
  DynamicCordisRunAttempt,
  DynamicCordisRunResponse,
  DynamicCordisStopResponse,
  DynamicCordisUndefineReceipt,
  RequestRunOutcome,
} from '@anotherharness/ah-cordis-host-runner/types'
// Credential state vocabulary for the credentials namespace (values never ride it).
export type { CredentialInfo } from '@anotherharness/ah-credentials/types'
// Redacted namespace vocabulary for the settings namespace (secrets never ride
// it). It travels with its seam, whose `./types` the Client face already reads.
export type {
  SettingsDescribeValue, SettingsNamespaceView, SettingsPathOpView, SettingsSecretView,
} from '@anotherharness/ah-settings/types'
// Provider registry and discovery vocabulary for the llm namespace.
export type {
  LlmConfigurableProvider, LlmDiscoveredModel,
  LlmModelDiscoveryRequest, LlmProviderInfo,
} from '@anotherharness/ah-llm/types'
// Reference-discovery result vocabulary for the fileReferences and
// sessionReferenceResolver namespaces.
export type { FileReferenceCandidate } from '@anotherharness/ah-file-reference/types'
export type { SessionReferenceMentionCandidate } from '@anotherharness/ah-session-reference/types'

// The Remote failure vocabulary, re-exported so business packages keep naming
// this assembly alone. Types only: a value export would make spec imports load
// this module's owner /remote artifacts; specs take RemoteError from
// ah-client-test-runtime instead.
export type {
  RemoteErrorCode, RemoteErrorDetailsMap, RemoteFailure, RemoteResult,
} from '@anotherharness/ah-typert-protocol'
export type { RemoteHostFacts } from '@anotherharness/ah-api-gateway/client'

declare module '@anotherharness/cordis' {
  interface Context {
    /** Generated Remote namespaces selected by this Client assembly. */
    remote: ClientRemote
  }
}

/** Required service: the typed Client Remote contribution mount. */
export const inject = ['remote']

/**
 * Mount the Host capabilities explicitly selected for this Client assembly.
 * @param ctx - Client Cordis root carrying the typed API service.
 * @returns disposer after every selected Remote namespace is ready.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const disposers: Array<() => Promise<void>> = []
  try {
    for (const contribution of [
      productAnalyticsRemote, agentPresetsRemote, commandsRemote, settingsControllerRemote, accountRemote,
      goalsRemote, llmRemote, dynamicRemote, scheduleRemote,
      pluginInventoryRemote, pluginManagerRemote, pluginRegistryProbeRemote, messageFeedbackRemote, sessionFeedbackRemote,
      fileUploadsRemote, sessionReferencesRemote,
      permissionPresetsRemote, subagentsRemote, sessionRemote, jobRemote, workspaceRemote, workspaceFilesRemote, terminalRemote,
      officeToPdfRemote, userQuestionsRemote,
    ]) {
      disposers.push(await ctx.remote.$mount(contribution))
    }
  } catch (error) {
    for (const dispose of disposers.reverse()) await dispose()
    throw error
  }
  // Unwound in reverse mount order, so a namespace never outlives one mounted
  // after it.
  return async () => {
    for (const dispose of disposers.reverse()) await dispose()
  }
}
