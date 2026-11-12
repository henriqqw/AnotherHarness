/** Browser terminal identities, metadata and screen-stream frames. */
import type { Branded } from '@anotherharness/ah-brand'
import type {} from '@anotherharness/ah-typert-protocol'

declare module '@anotherharness/ah-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** The terminal identity is missing or has begun process cleanup. */
    'terminal/unavailable': Record<string, never>
    /** Input or resize was refused without invalidating the output attachment. */
    'terminal/control-unavailable': { readonly reason: 'read-only' | 'not-running' }
    /** Retained screens and pending allocations consume the Session's terminal quota. */
    'terminal/limit-reached': { readonly limit: number }
    /** The selected terminal profile is unknown or its executable no longer resolves. */
    'terminal/profile-unavailable': { readonly profileId: string }
  }
}

/** A terminal identity scoped to one Session and one Host lifetime. */
export type WebTerminalId = Branded<'WebTerminalId'>
/** An attachment allowed to write and resize one terminal. */
export type TerminalAttachmentId = Branded<'TerminalAttachmentId'>

/** Acknowledges one physical window hold without taking screen or input control. */
export interface TerminalRetentionFrame {
  readonly type: 'retained'
}

/** An executable shell verified in the subprocess provider's execution environment. */
export interface TerminalShell {
  readonly path: string
  readonly args: readonly string[]
  readonly name: string
  /** Profile identity when the shell was opened from a terminal profile. */
  readonly id?: string
  /** Profile menu icon when the shell was opened from a terminal profile. */
  readonly icon?: TerminalProfileIcon
}

/** Menu icons a terminal profile can name. */
export type TerminalProfileIcon = 'bash' | 'zsh' | 'fish' | 'pwsh' | 'cmd' | 'wsl' | 'git' | 'terminal'

/** One entry of the profile menu: a verified shell with its identity, icon, and origin. */
export interface TerminalProfile extends TerminalShell {
  readonly id: string
  readonly icon: TerminalProfileIcon
  /** `detected` by OS detection or legacy candidates, or `configured` by the deployment. */
  readonly source: 'detected' | 'configured'
  /** Environment variables layered onto the terminal; never sent to clients. */
  readonly env?: Readonly<Record<string, string>>
}

/** A terminal profile as clients receive it, without its environment. */
export type TerminalProfileView = Omit<TerminalProfile, 'env'>

/** The profile menu and the default entry. */
export interface TerminalProfiles {
  readonly profiles: readonly TerminalProfileView[]
  /** Identity of the default profile, when the configured default resolves. */
  readonly defaultProfileId?: string
}

/** Current Session directory and terminal limits; retained terminals keep their own process directories. */
export interface TerminalEnvironment {
  /** Logged current directory, read without filesystem validation. */
  readonly cwd: string
  readonly maxInputBytes: number
  readonly maxCols: number
  readonly maxRows: number
  readonly scrollback: number
}

/** Host-owned terminal state; process exit never creates a replacement shell. */
export interface WebTerminalInfo {
  readonly id: WebTerminalId
  readonly title: string
  readonly shell: TerminalShell
  /** Initial working directory; shell directory changes do not update this field. */
  readonly cwd: string
  readonly cols: number
  readonly rows: number
  readonly state: 'running' | 'exited' | 'failed'
  readonly exitCode: number | null
  readonly error?: string
  readonly controllerId?: TerminalAttachmentId
}

/** Create is idempotent for an open identity; closed identities cannot be recreated. */
export interface TerminalCreateRequest {
  /** A profile identity from `terminal.profiles`; preferred over `shellPath`. */
  readonly profileId?: string
  /** A path returned by shell discovery; absent selects the default profile or the execution default. */
  readonly shellPath?: string
  readonly id: WebTerminalId
  readonly cols: number
  readonly rows: number
}

/** Every attachment begins with a complete bounded screen, then ordered output. */
export type TerminalFrame =
  | { readonly type: 'snapshot'; readonly sequence: number; readonly screen: string; readonly info: WebTerminalInfo }
  | { readonly type: 'output'; readonly sequence: number; readonly data: string }
  | { readonly type: 'state'; readonly info: WebTerminalInfo }
