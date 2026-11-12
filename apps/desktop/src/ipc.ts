/** Typed preload operations exposed only by the Electron shell. */

import type { DesktopKeyboardApi, DesktopShortcutsApi } from '@anotherharness/ah-client-shortcuts/protocol'
import type { IpcMainInvokeEvent } from 'electron'
import type { DesktopBrowserBridge } from '@anotherharness/ah-client-ui-sidebar-browser/types'

/** IPC channel names kept private to the desktop application bundle. */
export const DESKTOP_IPC = {
  shortcutsInput: 'ah-desktop:shortcuts-input',
  shortcutsCloseWindow: 'ah-desktop:shortcuts-close-window',
  shortcutsGet: 'ah-desktop:shortcuts-get',
  shortcutsEdit: 'ah-desktop:shortcuts-edit',
  shortcutsChanged: 'ah-desktop:shortcuts-changed',
  shortcutsRecording: 'ah-desktop:shortcuts-recording',
  boot: 'ah-desktop:boot',
  enterWorkspace: 'ah-desktop:enter-workspace',
  onboardingActive: 'ah-desktop:onboarding-active',
  onboardingApiKey: 'ah-desktop:onboarding-api-key',
  bootFailed: 'ah-desktop:boot-failed',
  browserAcquire: 'ah-desktop:browser-acquire',
  browserRelease: 'ah-desktop:browser-release',
  browserOpenRequested: 'ah-desktop:browser-open-requested',
  directoryPick: 'ah-desktop:directory-pick',
  deviceInfo: 'ah-desktop:device-info',
  localeBootstrap: 'ah-desktop:locale-bootstrap',
  localeChanged: 'ah-desktop:locale-changed',
  updatesStatus: 'ah-desktop:updates-status',
  updatesOpen: 'ah-desktop:updates-open',
  updatesPresentation: 'ah-desktop:updates-presentation',
  nativeThemeSet: 'ah-desktop:native-theme-set',
  windowFullscreen: 'ah-desktop:window-fullscreen',
  windowsAppearance: 'ah-desktop:windows-appearance',
  windowsMenu: 'ah-desktop:windows-menu',
} as const

/** Desktop release update state rendered by desktop-owned UI. */
export type DesktopUpdatePreparationFailureKind = 'stop-failed' | 'tasks-changed' | 'tasks-unavailable'

export interface DesktopUpdateState {
  readonly phase: 'idle' | 'checking' | 'available' | 'downloading' | 'verifying' | 'installing' | 'ready' | 'error'
  readonly version?: string
  readonly message?: string
  /** Main-owned diagnostics without subprocess output or credentials; hidden until expanded. */
  readonly technicalDetails?: string
  readonly percent?: number
  readonly failedOperation?: 'check' | 'download' | 'install'
  /** Main-owned preparation cause; UI wording is selected by the active locale. */
  readonly preparationFailure?: DesktopUpdatePreparationFailureKind
}

/** Classified failure copy selected by the Web locale without exposing raw updater diagnostics. */
export type DesktopUpdateFailureKind =
  | 'check'
  | 'check-network'
  | 'download'
  | 'download-network'
  | 'install'
  | 'install-network'
  | 'stop-failed'
  | 'tasks-changed'
  | 'tasks-unavailable'

/** Semantic status content; actions open main-process confirmation dialogs only. */
export interface DesktopUpdatePresentation {
  readonly phase: DesktopUpdateState['phase']
  readonly version?: string
  readonly percent?: number
  readonly failure?: DesktopUpdateFailureKind
}

/** Product documents cannot supply update versions, package URLs, or installation authorization. */
export interface AhDesktopProductApi {
  readonly protocolVersion: 1
  readonly browser: DesktopBrowserBridge
  readonly keyboard: DesktopKeyboardApi
  readonly shortcuts: DesktopShortcutsApi
  /**
   * Local machine description for the feedback questionnaire.
   * @returns `name=value` fields separated by `; `, with no hostname, user name, or serial number.
   */
  deviceInfo(): Promise<string>
  readonly updates: {
    status(): Promise<DesktopUpdatePresentation>
    open(): Promise<void>
    subscribe(listener: (state: DesktopUpdatePresentation) => void): () => void
  }
}

/** Scheme of Desktop-owned application documents. */
export const SCHEME = 'ah-app'

/**
 * Reject IPC outside the allowed Desktop document origins.
 * @param event - IPC caller whose frame URL supplies the origin.
 * @param hostnames - Desktop document hosts allowed for this operation.
 */
export function assertDesktopSender(event: IpcMainInvokeEvent, hostnames: readonly string[]): void {
  const senderFrame = event.senderFrame
  if (senderFrame === null) throw new Error('ah desktop: rejected IPC without a sender frame')
  const url = new URL(senderFrame.url)
  if (url.protocol !== `${SCHEME}:` || !hostnames.includes(url.hostname)) {
    throw new Error('ah desktop: rejected IPC from an unowned renderer')
  }
}
