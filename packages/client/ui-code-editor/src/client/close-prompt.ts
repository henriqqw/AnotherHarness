/**
 * Closing a tab that holds unsaved changes asks first: Save, Don't save, or
 * Cancel, like VS Code. The guard vetoes the close and opens the prompt; the
 * prompt's choice saves or drops the draft and closes the tab again.
 */
import type { DraftStore } from './drafts.ts'
import type { EditorFiles } from './files.ts'

/** The tab waiting on an answer. */
export interface CloseRequest {
  readonly sessionId: string
  readonly tabId: string
  readonly address: string
}

/** What the prompt shows. */
export interface ClosePromptState {
  /** The tab being closed; `undefined` while no prompt is open. */
  readonly request: CloseRequest | undefined
  /** Whether a save is in flight. */
  readonly busy: boolean
  /** Why the last save did not go through. */
  readonly error: string | undefined
  /** Whether the last save was refused because the file changed on disk. */
  readonly conflict: boolean
}

/** The user's answer. */
export type CloseChoice = 'save' | 'discard' | 'cancel'

/** A tab as the right sidebar hands it to a close guard. */
export interface GuardedTab {
  readonly id: string
  readonly contentId: string
}

/** Observable prompt state with the guard and the choice handler. */
export interface CloseFlow {
  /** @param listener - change callback. @returns unsubscribe. */
  readonly subscribe: (listener: () => void) => () => void
  /** @returns the current prompt state. */
  readonly getSnapshot: () => ClosePromptState
  /**
   * The close guard: a clean tab may go; a dirty one opens the prompt and stays.
   * @param sessionId - the tab's Session.
   * @param tab - the tab being closed.
   * @returns whether the tab may close now.
   */
  readonly guard: (sessionId: string, tab: GuardedTab) => boolean
  /** @param choice - the user's answer. @returns once the choice is carried out. */
  readonly choose: (choice: CloseChoice) => Promise<void>
}

const IDLE: ClosePromptState = { request: undefined, busy: false, error: undefined, conflict: false }

/**
 * Build the close flow.
 * @param drafts - the draft store.
 * @param files - the save face.
 * @param close - closes a tab once it may go.
 * @returns the flow.
 */
export function createCloseFlow(drafts: DraftStore, files: EditorFiles, close: (sessionId: string, tabId: string) => void): CloseFlow {
  let state = IDLE
  const listeners = new Set<() => void>()
  const set = (next: ClosePromptState): void => {
    state = next
    for (const listener of [...listeners]) listener()
  }
  const finish = (request: CloseRequest): void => {
    drafts.close(request.address)
    set(IDLE)
    close(request.sessionId, request.tabId)
  }
  return {
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    getSnapshot: () => state,
    guard: (sessionId, tab) => {
      if (!drafts.isDirty(tab.contentId)) return true
      set({ ...IDLE, request: { sessionId, tabId: tab.id, address: tab.contentId } })
      return false
    },
    choose: async (choice) => {
      const { request } = state
      if (request === undefined || state.busy) return
      if (choice === 'cancel') {
        set(IDLE)
        return
      }
      const draft = drafts.get(request.address)
      if (choice === 'discard' || draft === undefined || !drafts.isDirty(request.address)) {
        finish(request)
        return
      }
      set({ ...state, busy: true, error: undefined, conflict: false })
      const result = await files.save(drafts, draft)
      if (result.kind === 'saved') {
        finish(request)
        return
      }
      if (result.kind === 'conflict') set({ ...state, busy: false, conflict: true })
      else set({ ...state, busy: false, error: result.message })
    },
  }
}
