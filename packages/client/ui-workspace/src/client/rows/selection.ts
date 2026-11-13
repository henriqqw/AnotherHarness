/**
 * Multi-selection of Session rows, as in file managers: Shift+click selects
 * the range from the anchor row, Ctrl/Cmd+click toggles one row, and a plain
 * click opens the Session as before. The selection feeds batch actions such
 * as deleting every chosen Session at once.
 */
import { createContext } from 'react'

/** The modifier keys of a row click. */
export interface SelectionModifiers {
  readonly shiftKey: boolean
  readonly ctrlKey: boolean
  readonly metaKey: boolean
}

/** What rows read from the list: which rows are chosen, and how a click with modifiers selects. */
export interface SessionSelection {
  /** Chosen Session ids. */
  readonly selected: ReadonlySet<string>
  /**
   * Handle a row click.
   * @param id - the clicked Session.
   * @param modifiers - the click's modifier keys.
   * @returns true when the click changed the selection instead of opening the row.
   */
  readonly click: (id: string, modifiers: SelectionModifiers) => boolean
}

/** Provided by the Session list; absent outside it, where rows only open. */
export const SessionSelectionContext = createContext<SessionSelection | undefined>(undefined)

/**
 * The selection after a click with modifiers.
 * @param current - the chosen ids before the click.
 * @param anchor - the row a range starts from: the last toggled row, else the open Session.
 * @param id - the clicked row.
 * @param modifiers - the click's modifier keys.
 * @param order - every visible Session row, top to bottom.
 * @returns the new selection and anchor, or undefined for a plain click.
 */
export function nextSelection(
  current: ReadonlySet<string>,
  anchor: string | undefined,
  id: string,
  modifiers: SelectionModifiers,
  order: readonly string[],
): { readonly selected: ReadonlySet<string>; readonly anchor: string } | undefined {
  if (modifiers.shiftKey) {
    const from = anchor === undefined ? -1 : order.indexOf(anchor)
    const to = order.indexOf(id)
    if (to === -1) return undefined
    const [start, end] = from === -1 ? [to, to] : from < to ? [from, to] : [to, from]
    const range = order.slice(start, end + 1)
    const keep = modifiers.ctrlKey || modifiers.metaKey ? [...current] : []
    return { selected: new Set([...keep, ...range]), anchor: anchor !== undefined && from !== -1 ? anchor : id }
  }
  if (modifiers.ctrlKey || modifiers.metaKey) {
    const selected = new Set(current)
    if (selected.has(id)) selected.delete(id)
    else selected.add(id)
    return { selected, anchor: id }
  }
  return undefined
}

/**
 * Whether a key event comes from a place that types text, where Delete and
 * Escape belong to the field rather than to the selection.
 * @param target - the event target.
 * @returns true for inputs, text areas, and editable content.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]') !== null
}
