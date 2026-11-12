/** Injected terminal commands and keyed observable state. */
import type { WebTerminalId } from '@anotherharness/ah-api-terminal-controller/types'
import type { TerminalScreenModel, TerminalViewState } from '@anotherharness/ah-api-terminal-controller/client'
import type { HostObservable } from '@anotherharness/ah-client-ui-slots'
import type { ThemeSnapshot } from '@anotherharness/ah-client-ui-theme/client'

/** The terminal's React-free model is resolved by sidebar occurrence. */
export interface TerminalInjected {
  /** @param key - sidebar occurrence key. @returns its terminal commands. */
  readonly view: (key: string) => TerminalScreenModel
  readonly keyedHooks: { readonly terminal: (key: string) => HostObservable<TerminalViewState> }
}


/** The terminal screen follows the resolved application theme through a framework hook. */
export interface TerminalBodyInjected extends TerminalInjected {
  readonly hooks: { readonly theme: HostObservable<ThemeSnapshot> }
}

declare module '@anotherharness/ah-client-ui-sidebar-right/client' {
  interface SidebarRightTabParamsMap {
    /** An existing Host terminal selected from the Session terminal list. */
    terminal: { terminalId: WebTerminalId } | { profileId: string } | { shellPath: string }
    /** One of the agent's own terminals, followed live. */
    'agent-terminal': { terminalId: string }
  }
}
