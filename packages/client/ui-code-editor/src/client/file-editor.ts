/**
 * The CodeMirror 6 composition behind the `FileEditor` interface. Everything
 * CodeMirror-specific lives here, so views talk to a small imperative handle
 * and the editor can change without touching them.
 */
import { basicSetup } from 'codemirror'
import { Compartment, EditorSelection, EditorState, type Extension } from '@codemirror/state'
import { EditorView, highlightWhitespace, hoverTooltip, keymap, type ViewUpdate } from '@codemirror/view'
import { indentUnit, getIndentUnit, HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { indentWithTab } from '@codemirror/commands'
import { completeAnyWord } from '@codemirror/autocomplete'
import { gotoLine, search } from '@codemirror/search'
import { tags } from '@lezer/highlight'
import { vscodeKeymap } from '@replit/codemirror-vscode-keymap'
import { indentationMarkers } from '@replit/codemirror-indentation-markers'
import { showMinimap } from '@replit/codemirror-minimap'
import { editorLanguageById } from './languages.ts'

/** Cursor and indentation facts shown in the status bar. */
export interface EditorCursorInfo {
  /** 1-based line of the main cursor. */
  readonly line: number
  /** 1-based column of the main cursor. */
  readonly column: number
  /** Characters selected across every range. */
  readonly selected: number
  /** Number of cursors. */
  readonly cursors: number
  /** Indentation style. */
  readonly indent: { readonly kind: 'spaces' | 'tabs'; readonly size: number }
}

/** A zero-based line and UTF-16 column, the language-server convention. */
export interface EditorPosition {
  readonly line: number
  readonly character: number
}

/** Language-server actions the editor offers when a server handles the file. */
export interface EditorNavigationHooks {
  /** @param position - where the pointer rests. @returns hover text, or `undefined` for none. */
  readonly hover: (position: EditorPosition) => Promise<string | undefined>
  /** F12 or Ctrl/Cmd+Click. @param position - the symbol's position. */
  readonly definition: (position: EditorPosition) => void
  /** Shift+F12. @param position - the symbol's position. */
  readonly references: (position: EditorPosition) => void
}

/** Selection and scroll offset of a view, to restore after a tab comes back. */
export interface EditorViewSnapshot {
  readonly anchor: number
  readonly head: number
  readonly scrollTop: number
}

/** Options for one mounted editor. */
export interface FileEditorOptions {
  /** Element the editor renders into. */
  readonly parent: HTMLElement
  /** Initial text with `\n` line breaks. */
  readonly text: string
  /** Initial language id. */
  readonly language: string
  /** Whether input starts disabled. */
  readonly readOnly: boolean
  /** Whether long lines wrap. */
  readonly wrap: boolean
  /** Called after every document change. @param text - the new text. */
  readonly onChange: (text: string) => void
  /** Called for Ctrl/Cmd+S. */
  readonly onSave: () => void
  /** Called for Ctrl/Cmd+Alt+S. */
  readonly onSaveAll?: () => void
  /** Called when the cursor, selection, or indentation changes. @param info - status facts. */
  readonly onCursor?: (info: EditorCursorInfo) => void
  /** Hover, definition, and references; omitted when no language server is wired. */
  readonly navigation?: EditorNavigationHooks
}

/** Imperative handle over one editor instance. */
export interface FileEditor {
  /** @returns the current text with `\n` line breaks. */
  getText(): string
  /** Replace the whole text without firing `onChange`, keeping the cursor where possible. @param text - new text. */
  setText(text: string): void
  /** @param readOnly - whether input is disabled. */
  setReadOnly(readOnly: boolean): void
  /** @param id - language id from `EDITOR_LANGUAGES`. */
  setLanguage(id: string): Promise<void>
  /** @param wrap - whether long lines wrap. */
  setWrap(wrap: boolean): void
  /** @param visible - whether spaces and tabs are drawn. */
  setWhitespace(visible: boolean): void
  /** @param indent - indentation style used by Tab and auto-indent. */
  setIndent(indent: EditorCursorInfo['indent']): void
  /** Move focus into the editor. */
  focus(): void
  /** Put the cursor at a position and scroll it into view. @param line - 1-based line. @param column - 1-based column. */
  reveal(line: number, column?: number): void
  /** Open the go-to-line prompt. */
  goToLine(): void
  /** @returns the selection and scroll offset. */
  getView(): EditorViewSnapshot
  /** @param snapshot - a selection and scroll offset taken earlier; clamped to the current text. */
  restoreView(snapshot: EditorViewSnapshot): void
  /** Destroy the editor. */
  dispose(): void
}

const highlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier, tags.controlKeyword, tags.operatorKeyword], color: 'var(--shiki-token-keyword, #cf222e)' },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: 'var(--shiki-token-string, #0a3069)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: 'var(--shiki-token-comment, #6e7781)', fontStyle: 'italic' },
  { tag: [tags.number, tags.bool, tags.null, tags.atom, tags.constant(tags.name)], color: 'var(--shiki-token-constant, #0550ae)' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.macroName], color: 'var(--shiki-token-function, #8250df)' },
  { tag: [tags.typeName, tags.className, tags.namespace, tags.tagName], color: 'var(--shiki-token-function, #953800)' },
  { tag: [tags.propertyName, tags.attributeName], color: 'var(--shiki-token-constant, #0550ae)' },
  { tag: [tags.variableName, tags.definition(tags.variableName)], color: 'var(--shiki-foreground, inherit)' },
  { tag: [tags.punctuation, tags.bracket, tags.separator], color: 'var(--shiki-token-punctuation, inherit)' },
  { tag: tags.link, color: 'var(--shiki-token-link, #0969da)', textDecoration: 'underline' },
  { tag: tags.heading, fontWeight: 'bold', color: 'var(--shiki-token-keyword, #cf222e)' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.invalid, color: 'var(--dsw-alias-state-error-primary, #cf222e)' },
])

const theme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    color: 'var(--dsw-alias-label-primary)',
    backgroundColor: 'transparent',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--ds-font-family-code, ui-monospace, monospace)', lineHeight: '1.55' },
  '.cm-content': { caretColor: 'var(--dsw-alias-label-primary)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--dsw-alias-label-primary)' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--dsw-alias-label-tertiary)',
    border: 'none',
  },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--dsw-alias-label-primary)' },
  '.cm-activeLine': { backgroundColor: 'var(--dsw-alias-interactive-bg-hover)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--dsw-alias-link, #0969da) 28%, transparent) !important',
  },
  '.cm-selectionMatch': { backgroundColor: 'color-mix(in srgb, var(--dsw-alias-link, #0969da) 16%, transparent)' },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
    backgroundColor: 'color-mix(in srgb, var(--dsw-alias-link, #0969da) 20%, transparent)',
    outline: '1px solid color-mix(in srgb, var(--dsw-alias-link, #0969da) 50%, transparent)',
  },
  '.cm-searchMatch': { backgroundColor: 'color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d4a72c) 35%, transparent)' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d4a72c) 65%, transparent)' },
  '.cm-foldPlaceholder': { backgroundColor: 'var(--dsw-alias-bg-layer-2)', border: 'none', color: 'var(--dsw-alias-label-secondary)' },
  '.cm-panels': { backgroundColor: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)' },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--dsw-alias-border-l2)' },
  '.cm-panel input, .cm-panel button': { font: 'inherit', fontSize: '12px' },
  '.cm-textfield': {
    backgroundColor: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)',
    border: '1px solid var(--dsw-alias-border-l3)', borderRadius: '4px',
  },
  '.cm-button': {
    backgroundImage: 'none', backgroundColor: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-primary)',
    border: '1px solid var(--dsw-alias-border-l3)', borderRadius: '4px',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)',
    border: '1px solid var(--dsw-alias-border-l2)', borderRadius: '6px',
  },
  '.cm-ah-hover': {
    maxWidth: '520px', maxHeight: '320px', overflow: 'auto', padding: '6px 8px', whiteSpace: 'pre-wrap',
    fontFamily: 'var(--ds-font-family-code, ui-monospace, monospace)', fontSize: '12px',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'color-mix(in srgb, var(--dsw-alias-link, #0969da) 22%, transparent)', color: 'inherit',
  },
  '.cm-minimap-gutter': { borderLeft: '1px solid var(--dsw-alias-border-l1)' },
  '.cm-minimap-overlay': { backgroundColor: 'var(--dsw-alias-label-tertiary)' },
})

const MINIMAP_MIN_WIDTH = 520

/**
 * Detect the indentation a document uses.
 * @param text - document text.
 * @returns tabs when tab-indented lines dominate, otherwise the smallest common space width.
 */
export function detectIndent(text: string): EditorCursorInfo['indent'] {
  let tabs = 0
  const widths = new Map<number, number>()
  let previous = 0
  for (const line of text.split('\n')) {
    if (line.startsWith('\t')) {
      tabs += 1
      continue
    }
    const width = /^ */u.exec(line)?.[0].length ?? 0
    if (width === line.length) continue
    const delta = Math.abs(width - previous)
    previous = width
    if (delta > 1 && delta <= 8) widths.set(delta, (widths.get(delta) ?? 0) + 1)
  }
  const spaces = [...widths.values()].reduce((sum, count) => sum + count, 0)
  if (tabs > spaces) return { kind: 'tabs', size: 4 }
  let best = 2
  let bestCount = -1
  for (const [width, count] of widths) {
    if (count > bestCount || (count === bestCount && width < best)) {
      best = width
      bestCount = count
    }
  }
  return { kind: 'spaces', size: bestCount < 0 ? 2 : best }
}

/** The language-server position of a document offset. */
const positionAt = (state: EditorState, pos: number): EditorPosition => {
  const line = state.doc.lineAt(pos)
  return { line: line.number - 1, character: pos - line.from }
}

/**
 * Hover tooltips, F12, Shift+F12, and Ctrl/Cmd+Click wired to the hooks.
 * Multi-cursor clicks move to Alt+Click, as in VS Code, freeing Ctrl/Cmd+Click.
 */
const navigationExtension = (hooks: EditorNavigationHooks): Extension => [
  EditorView.clickAddsSelectionRange.of(event => event.altKey),
  hoverTooltip(async (view, pos) => {
    const text = await hooks.hover(positionAt(view.state, pos))
    if (text === undefined || text.trim() === '') return null
    return {
      pos,
      above: true,
      create: () => {
        const dom = document.createElement('div')
        dom.className = 'cm-ah-hover'
        dom.textContent = text
        return { dom }
      },
    }
  }),
  keymap.of([
    { key: 'F12', preventDefault: true, run: (view) => { hooks.definition(positionAt(view.state, view.state.selection.main.head)); return true } },
    { key: 'Shift-F12', preventDefault: true, run: (view) => { hooks.references(positionAt(view.state, view.state.selection.main.head)); return true } },
  ]),
  EditorView.domEventHandlers({
    mousedown: (event, view) => {
      if (event.button !== 0 || !(event.ctrlKey || event.metaKey)) return false
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
      if (pos === null) return false
      event.preventDefault()
      hooks.definition(positionAt(view.state, pos))
      return true
    },
  }),
]

const indentExtension = (indent: EditorCursorInfo['indent']): Extension => [
  indentUnit.of(indent.kind === 'tabs' ? '\t' : ' '.repeat(indent.size)),
  EditorState.tabSize.of(indent.size),
]

/**
 * Mount a CodeMirror editor.
 * @param options - initial content, mode, and callbacks.
 * @returns the editor handle.
 */
export function createFileEditor(options: FileEditorOptions): FileEditor {
  const language = new Compartment()
  const readOnly = new Compartment()
  const wrap = new Compartment()
  const whitespace = new Compartment()
  const indent = new Compartment()
  let indentInfo = detectIndent(options.text)
  let applyingExternal = false

  const reportCursor = (view: EditorView): void => {
    if (options.onCursor === undefined) return
    const { state } = view
    const head = state.selection.main.head
    const line = state.doc.lineAt(head)
    const selected = state.selection.ranges.reduce((sum, range) => sum + range.to - range.from, 0)
    const unit = getIndentUnit(state)
    options.onCursor({
      line: line.number, column: head - line.from + 1, selected, cursors: state.selection.ranges.length,
      indent: indentInfo.kind === 'tabs' ? indentInfo : { kind: 'spaces', size: unit },
    })
  }

  const view = new EditorView({
    parent: options.parent,
    state: EditorState.create({
      doc: options.text,
      extensions: [
        keymap.of([
          { key: 'Mod-s', preventDefault: true, run: () => { options.onSave(); return true } },
          { key: 'Mod-Alt-s', preventDefault: true, run: () => { options.onSaveAll?.(); return true } },
          { key: 'Ctrl-g', preventDefault: true, run: gotoLine },
          indentWithTab,
        ]),
        keymap.of(vscodeKeymap),
        basicSetup,
        search({ top: true }),
        EditorState.allowMultipleSelections.of(true),
        EditorState.languageData.of(() => [{ autocomplete: completeAnyWord }]),
        syntaxHighlighting(highlight),
        indentationMarkers({
          thickness: 1,
          colors: {
            light: 'var(--dsw-alias-border-l2, #d0d7de)', dark: 'var(--dsw-alias-border-l2, #30363d)',
            activeLight: 'var(--dsw-alias-border-l4, #8c959f)', activeDark: 'var(--dsw-alias-border-l4, #6e7681)',
          },
        }),
        showMinimap.compute(['doc'], () => (options.parent.clientWidth >= MINIMAP_MIN_WIDTH
          ? { create: () => ({ dom: document.createElement('div') }), displayText: 'blocks', showOverlay: 'mouse-over' }
          : null)),
        theme,
        language.of([]),
        readOnly.of([EditorState.readOnly.of(options.readOnly), EditorView.editable.of(!options.readOnly)]),
        wrap.of(options.wrap ? EditorView.lineWrapping : []),
        whitespace.of([]),
        indent.of(indentExtension(indentInfo)),
        options.navigation === undefined ? [] : navigationExtension(options.navigation),
        EditorView.updateListener.of((update: ViewUpdate) => {
          if (update.docChanged && !applyingExternal) options.onChange(update.state.doc.toString())
          if (update.docChanged || update.selectionSet || update.focusChanged) reportCursor(update.view)
        }),
      ],
    }),
  })

  const editor: FileEditor = {
    getText: () => view.state.doc.toString(),
    setText: (text) => {
      if (text === view.state.doc.toString()) return
      const head = Math.min(view.state.selection.main.head, text.length)
      applyingExternal = true
      try {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, selection: EditorSelection.cursor(head) })
      } finally {
        applyingExternal = false
      }
    },
    setReadOnly: (value) => {
      view.dispatch({ effects: readOnly.reconfigure([EditorState.readOnly.of(value), EditorView.editable.of(!value)]) })
    },
    setLanguage: async (id) => {
      const support = await editorLanguageById(id).load()
      view.dispatch({ effects: language.reconfigure(support) })
    },
    setWrap: (value) => { view.dispatch({ effects: wrap.reconfigure(value ? EditorView.lineWrapping : []) }) },
    setWhitespace: (value) => { view.dispatch({ effects: whitespace.reconfigure(value ? highlightWhitespace() : []) }) },
    setIndent: (value) => {
      indentInfo = value
      view.dispatch({ effects: indent.reconfigure(indentExtension(value)) })
      reportCursor(view)
    },
    focus: () => { view.focus() },
    reveal: (line, column = 1) => {
      const target = view.state.doc.line(Math.max(1, Math.min(line, view.state.doc.lines)))
      const pos = Math.min(target.from + Math.max(0, column - 1), target.to)
      view.dispatch({ selection: EditorSelection.cursor(pos), effects: EditorView.scrollIntoView(pos, { y: 'center' }) })
    },
    goToLine: () => { gotoLine(view) },
    getView: () => {
      const { anchor, head } = view.state.selection.main
      return { anchor, head, scrollTop: view.scrollDOM.scrollTop }
    },
    restoreView: (snapshot) => {
      const length = view.state.doc.length
      view.dispatch({ selection: EditorSelection.single(Math.min(snapshot.anchor, length), Math.min(snapshot.head, length)) })
      view.scrollDOM.scrollTop = snapshot.scrollTop
      requestAnimationFrame(() => { view.scrollDOM.scrollTop = snapshot.scrollTop })
    },
    dispose: () => { view.destroy() },
  }
  void editor.setLanguage(options.language)
  reportCursor(view)
  return editor
}
