/**
 * Keyboard input history for the composer bar (ArrowUp/Down shell-style recall).
 * Persisted to sessionStorage so history survives HMR reloads.
 */
const MAX_HISTORY = 100
const SESSION_KEY = 'ah-input-history'

export class InputHistory {
  private items: string[]
  private cursor = -1 // -1 = not navigating; >= 0 = index into items from the end
  private savedDraft = ''

  constructor() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      this.items = raw != null ? (JSON.parse(raw) as string[]) : []
    } catch {
      this.items = []
    }
  }

  /** Record a submitted draft. Deduplicates consecutive identical entries. */
  push(text: string): void {
    const trimmed = text.trim()
    if (trimmed === '' || trimmed === this.items.at(-1)) return
    this.items.push(trimmed)
    if (this.items.length > MAX_HISTORY) this.items.shift()
    this.cursor = -1
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(this.items)) } catch { /* nop */ }
  }

  up(currentDraft: string): string | null {
    if (this.items.length === 0) return null
    if (this.cursor === -1) {
      this.savedDraft = currentDraft
      this.cursor = this.items.length - 1
    } else if (this.cursor > 0) {
      this.cursor -= 1
    } else {
      return null
    }
    return this.items[this.cursor] ?? null
  }

  down(): string | null {
    if (this.cursor === -1) return null
    this.cursor += 1
    if (this.cursor >= this.items.length) {
      this.cursor = -1
      const saved = this.savedDraft
      this.savedDraft = ''
      return saved
    }
    return this.items[this.cursor] ?? null
  }

  /** Exit navigation mode (called when draft has newlines or on resetCursor). */
  resetCursor(): void {
    this.cursor = -1
  }
}
