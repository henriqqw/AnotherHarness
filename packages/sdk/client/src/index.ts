/**
 * TypeScript client SDK for the AnotherHarness runtime: spawn the
 * same-version `ah --profile sdk` runtime as a subprocess and drive agent
 * turns over stdio JSON-RPC. `AnotherHarness` is the high-level run API;
 * `HarnessClient` is the lower-level protocol client. A pure library — it
 * registers nothing on a Cordis context; named profiles and ordered patch
 * files customize the runtime process it spawns.
 *
 * @module @anotherharness/ah-sdk-client
 */

export { AnotherHarness, HarnessSession, validatedSessionEvent } from './api.ts'
export type { RunOptions } from './api.ts'
export {
  HarnessClient,
  RequestTimeoutError,
  SdkProtocolError,
  TransportClosedError,
} from './client.ts'
export type { NotificationSubscription } from './client.ts'
export { JsonRpcResponseError } from '@anotherharness/ah-sdk-protocol'
export type {
  ContentBlock,
  SdkPromptContentBlock,
  AnotherHarnessOptions,
  HarnessClientOptions,
  HarnessNotification,
  NotificationFilter,
  RunResult,
} from './types.ts'
