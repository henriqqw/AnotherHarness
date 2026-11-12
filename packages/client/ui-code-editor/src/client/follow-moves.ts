/**
 * When the Files tree renames or deletes an entry, open views follow: drafts
 * move to the new address and tabs reopen there, or, after a delete, the tabs
 * close. A dirty draft of a deleted file stays, so closing its tab asks first.
 */
import type { DraftStore } from './drafts.ts'

/** An open tab as the right sidebar's inventory lists it. */
export interface OpenTab {
  readonly sessionId: string
  readonly tabId: string
  readonly contentId: string
}

/** What following a move may do to tabs. */
export interface MoveEffects {
  /** @returns every open tab across Sessions. */
  readonly tabs: () => readonly OpenTab[]
  /** @param sessionId - the tab's Session. @param tabId - the tab to close. */
  readonly close: (sessionId: string, tabId: string) => void
  /** @param address - the new address. @param tabId - the tab it replaces. */
  readonly replace: (address: string, tabId: string) => void
}

/**
 * The last path segment of a file address, for prompts.
 * @param address - a file address.
 * @returns the decoded file name.
 */
export function nameOfAddress(address: string): string {
  const end = address.search(/[?#]/)
  const path = end === -1 ? address : address.slice(0, end)
  return decodeURIComponent(path.slice(path.lastIndexOf('/') + 1))
}

/**
 * Where an address goes when `from` moves to `to`.
 * @param address - an open file address.
 * @param from - the moved entry's address.
 * @param to - its new address; `undefined` after a delete.
 * @returns the new address, `undefined` when it was deleted, or `null` when the move does not touch it.
 */
export function movedAddress(address: string, from: string, to: string | undefined): string | undefined | null {
  if (address !== from && !address.startsWith(`${from}/`)) return null
  return to === undefined ? undefined : to + address.slice(from.length)
}

/**
 * Carry drafts and tabs across a rename, or close tabs after a delete.
 * @param drafts - the draft store.
 * @param effects - the tab inventory and tab actions.
 * @param sessionId - the Session whose workspace changed.
 * @param from - the moved entry's address.
 * @param to - its new address; `undefined` after a delete.
 */
export function followMove(drafts: DraftStore, effects: MoveEffects, sessionId: string, from: string, to: string | undefined): void {
  if (to !== undefined) {
    for (const address of drafts.addresses()) {
      const next = movedAddress(address, from, to)
      if (typeof next === 'string') drafts.rename(address, next)
    }
  }
  for (const tab of effects.tabs()) {
    if (tab.sessionId !== sessionId) continue
    const next = movedAddress(tab.contentId, from, to)
    if (next === null) continue
    if (next === undefined) effects.close(sessionId, tab.tabId)
    else effects.replace(next, tab.tabId)
  }
}
