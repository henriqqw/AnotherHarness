/**
 * Per-file drafts, independent of React and of any open view.
 *
 * A draft outlives the tab that edits it, so closing and reopening a file, or
 * switching tabs, keeps unsaved text. Disk changes drive conflicts: a new
 * version while the draft is dirty marks a conflict and keeps the draft; a new
 * version while it is clean asks the view to reload.
 */
import type { EditableText, LineEnding } from './text-codec.ts'

/** A disk version the draft did not start from. */
export interface DraftConflict {
  /** The version on disk, when known. */
  readonly version: string | undefined
}

/** One file's editing state. */
export interface FileDraft {
  /** The file resource address that identifies the draft. */
  readonly address: string
  /** Version of the text the draft started from. */
  readonly baseVersion: string
  /** Text on disk at `baseVersion`. */
  readonly baseText: string
  /** Current editor text. */
  readonly text: string
  /** Line ending restored on save. */
  readonly eol: LineEnding
  /** Line ending of the file on disk at `baseVersion`. */
  readonly baseEol: LineEnding
  /** Whether the file carries a byte order mark. */
  readonly bom: boolean
  /** Whether the user turned the read-only view into an editor. */
  readonly editing: boolean
  /** Whether a save is in flight. */
  readonly saving: boolean
  /** Set when disk moved on while the draft was dirty, or a save was refused as stale. */
  readonly conflict: DraftConflict | undefined
  /** Last save failure message, cleared by the next edit or save. */
  readonly error: string | undefined
}

/** What the view should do about a disk change. */
export type DiskChangeOutcome = 'none' | 'reload' | 'conflict'

/**
 * Where a file's view was, kept across unmounts: the selection and scroll
 * offset a hidden tab left, or a position to reveal on the next open.
 */
export type EditorViewState =
  | { readonly kind: 'restore'; readonly anchor: number; readonly head: number; readonly scrollTop: number }
  | { readonly kind: 'reveal'; readonly line: number; readonly column: number }

/**
 * Whether a draft holds text that is not on disk.
 * @param draft - the draft, if any.
 * @returns true when the text differs from the loaded base.
 */
export function isDirty(draft: FileDraft | undefined): boolean {
  return draft !== undefined && (draft.text !== draft.baseText || draft.eol !== draft.baseEol)
}

/** Observable map of drafts keyed by file address. */
export class DraftStore {
  private drafts = new Map<string, FileDraft>()
  private readonly views = new Map<string, EditorViewState>()
  private readonly listeners = new Set<() => void>()
  private version = 0

  /** Subscribe to every change. @param listener - change callback. @returns unsubscribe. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Monotonic change counter for `useSyncExternalStore`. @returns the counter. */
  readonly getVersion = (): number => this.version

  /**
   * Look up one file's draft.
   * @param address - file address.
   * @returns its draft, if one exists.
   */
  get(address: string): FileDraft | undefined {
    return this.drafts.get(address)
  }

  /**
   * Whether a file has unsaved changes.
   * @param address - file address.
   * @returns whether its draft holds unsaved text.
   */
  isDirty(address: string): boolean {
    return isDirty(this.drafts.get(address))
  }

  /**
   * List the files that have drafts.
   * @returns the address of every draft.
   */
  addresses(): readonly string[] {
    return [...this.drafts.keys()]
  }

  /**
   * Record where a file's view was, or where to open it next.
   * @param address - file address.
   * @param view - the selection and scroll offset, or a position to reveal.
   */
  setView(address: string, view: EditorViewState): void {
    this.views.set(address, view)
  }

  /**
   * Take the view state recorded for a file; it is consumed, so a reveal applies once.
   * @param address - file address.
   * @returns the recorded state, if any.
   */
  takeView(address: string): EditorViewState | undefined {
    const view = this.views.get(address)
    this.views.delete(address)
    return view
  }

  /**
   * List the drafts with unsaved changes.
   * @returns every draft with unsaved text.
   */
  dirty(): readonly FileDraft[] {
    return [...this.drafts.values()].filter(draft => isDirty(draft))
  }

  /**
   * Record text read from disk. A dirty draft keeps its text; a different
   * version marks a conflict instead of replacing it.
   * @param address - file address.
   * @param loaded - decoded file content.
   * @param version - disk version of the content.
   * @returns the resulting draft.
   */
  loaded(address: string, loaded: EditableText, version: string): FileDraft {
    const current = this.drafts.get(address)
    if (current !== undefined && isDirty(current)) {
      if (current.baseVersion === version) return current
      return this.set({ ...current, conflict: { version } })
    }
    return this.set({
      address, baseVersion: version, baseText: loaded.text, text: loaded.text, eol: loaded.eol, baseEol: loaded.eol, bom: loaded.bom,
      editing: current?.editing ?? false, saving: false, conflict: undefined, error: undefined,
    })
  }

  /**
   * Classify a disk version reported by the change feed.
   * @param address - file address.
   * @param version - the version now on disk.
   * @returns what the view should do.
   */
  diskChanged(address: string, version: string): DiskChangeOutcome {
    const current = this.drafts.get(address)
    if (current === undefined || current.saving || current.baseVersion === version) return 'none'
    if (current.conflict?.version === version) return 'none'
    if (!isDirty(current)) return 'reload'
    this.set({ ...current, conflict: { version } })
    return 'conflict'
  }

  /**
   * Record new editor text.
   * @param address - file address.
   * @param text - new editor text.
   */
  edit(address: string, text: string): void {
    const current = this.drafts.get(address)
    if (current === undefined || current.text === text) return
    this.set({ ...current, text, error: undefined })
  }

  /**
   * Turn input on or off.
   * @param address - file address.
   * @param editing - whether the editor accepts input.
   */
  setEditing(address: string, editing: boolean): void {
    const current = this.drafts.get(address)
    if (current !== undefined && current.editing !== editing) this.set({ ...current, editing })
  }

  /**
   * Choose the line ending for the next save.
   * @param address - file address.
   * @param eol - line ending to write on the next save.
   */
  setLineEnding(address: string, eol: LineEnding): void {
    const current = this.drafts.get(address)
    if (current !== undefined && current.eol !== eol) this.set({ ...current, eol })
  }

  /**
   * Mark a save in flight.
   * @param address - file address.
   */
  saving(address: string): void {
    const current = this.drafts.get(address)
    if (current !== undefined) this.set({ ...current, saving: true, error: undefined })
  }

  /**
   * Record a successful save.
   * @param address - file address.
   * @param text - the text that was written.
   * @param version - the new disk version.
   */
  saved(address: string, text: string, version: string): void {
    const current = this.drafts.get(address)
    if (current === undefined) return
    this.set({
      ...current, baseText: text, baseEol: current.eol, baseVersion: version, saving: false, conflict: undefined, error: undefined,
    })
  }

  /**
   * Record a stale-version refusal.
   * @param address - file address.
   * @param version - the version on disk, when reported.
   */
  conflicted(address: string, version: string | undefined): void {
    const current = this.drafts.get(address)
    if (current !== undefined) this.set({ ...current, saving: false, conflict: { version } })
  }

  /**
   * Record a save failure.
   * @param address - file address.
   * @param message - failure shown to the user.
   */
  failed(address: string, message: string): void {
    const current = this.drafts.get(address)
    if (current !== undefined) this.set({ ...current, saving: false, error: message })
  }

  /**
   * Drop unsaved text and any conflict so the next load replaces it.
   * @param address - file address.
   */
  discard(address: string): void {
    const current = this.drafts.get(address)
    if (current !== undefined) this.set({ ...current, text: current.baseText, eol: current.baseEol, conflict: undefined, error: undefined })
  }

  /**
   * Forget the draft and its view entirely.
   * @param address - file address.
   */
  close(address: string): void {
    this.views.delete(address)
    if (this.drafts.delete(address)) this.changed()
  }

  /**
   * Move a draft to a renamed file.
   * @param from - old address.
   * @param to - new address.
   */
  rename(from: string, to: string): void {
    const view = this.views.get(from)
    this.views.delete(from)
    if (view !== undefined) this.views.set(to, view)
    const current = this.drafts.get(from)
    if (current === undefined) return
    this.drafts.delete(from)
    this.set({ ...current, address: to })
  }

  private set(draft: FileDraft): FileDraft {
    this.drafts = new Map(this.drafts).set(draft.address, draft)
    this.changed()
    return draft
  }

  private changed(): void {
    this.version += 1
    for (const listener of [...this.listeners]) listener()
  }
}
