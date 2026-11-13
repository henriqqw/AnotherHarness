/**
 * The document-preview body that edits a file in place. It opens read-only,
 * like the code preview it replaces; Edit turns on input. The draft lives in
 * the plugin's draft store, so it survives tab switches and re-opens.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale } from '@anotherharness/ah-client-ui-slots'
import type { DocumentPreviewProps } from '@anotherharness/ah-client-ui-sidebar-documentpreview/client'
import type {} from '@anotherharness/ah-client-resources/client'
import {
  createFileEditor, detectIndent, type EditorCursorInfo, type EditorNavigationHooks, type EditorPosition, type FileEditor,
} from './file-editor.ts'
import { EDITOR_LANGUAGES, editorLanguageForPath, FALLBACK_LANGUAGE_ID } from './languages.ts'
import { CompareView } from './CompareView.tsx'
import type { DraftStore } from './drafts.ts'
import type { EditorFiles } from './files.ts'
import type { EditorTarget } from './navigation.ts'
import type { DecodeRefusal, EditableText } from './text-codec.ts'
import type {} from './locales.ts'
import css from './EditorBody.module.css'

/** Draft store and file operations supplied by the plugin. */
export interface EditorBodyInjected {
  /** Drafts shared by every editor view. */
  readonly drafts: DraftStore
  /** File reads and saves bound to the Remote. */
  readonly files: EditorFiles
  /** Open a file at a position, in this tab when it is this file. @param target - where to go. */
  readonly openAt: (target: EditorTarget) => void
}

type NavigationPanel =
  | { readonly kind: 'loading' }
  | { readonly kind: 'message'; readonly text: string }
  | { readonly kind: 'targets'; readonly title: string; readonly targets: readonly EditorTarget[] }

/** Document owner props, this body's copy, and the injected face. */
export type EditorBodyProps = DocumentPreviewProps & PropsLocale<'codeEditor'> & InjectFace<EditorBodyInjected>

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready' }
  | { readonly kind: 'refused'; readonly reason: DecodeRefusal }
  | { readonly kind: 'failed'; readonly message: string }

/**
 * Edit one workspace file.
 * @param props - owner content, wrap preference, hooks, copy, and the editor face.
 * @returns the editor with its toolbar, conflict banner, and status bar.
 */
export function EditorBody({ resourceAddress, content, wrap, useResource, drafts, files, openAt, t }: EditorBodyProps): ReactNode {
  useSyncExternalStore(drafts.subscribe, drafts.getVersion)
  const draft = drafts.get(resourceAddress)
  const path = files.pathOf(resourceAddress)
  const [load, setLoad] = useState<LoadState>(draft === undefined ? { kind: 'loading' } : { kind: 'ready' })
  const [language, setLanguage] = useState(() => editorLanguageForPath(path).id)
  const [cursor, setCursor] = useState<EditorCursorInfo | undefined>()
  const [whitespace, setWhitespace] = useState(false)
  const [comparing, setComparing] = useState<EditableText | undefined>()
  const [confirmOverwrite, setConfirmOverwrite] = useState(false)
  const [savedFlash, setSavedFlash] = useState<string | undefined>()
  const [panel, setPanel] = useState<NavigationPanel | undefined>()
  const rootRef = useRef<string | undefined>(undefined)
  const lspAvailable = useRef(true)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<FileEditor | undefined>(undefined)
  const meta = useResource<'file'>(resourceAddress)
  const revision = content.kind === 'renderer' ? content.revision : -1
  const contentRef = useRef(content)
  contentRef.current = content
  const dirty = drafts.isDirty(resourceAddress)
  const editing = draft?.editing ?? false

  // Read the file for every owner revision: first open, explicit reload, or a
  // disk change the owner picked up. A dirty draft survives the read.
  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      const result = await files.read(resourceAddress, controller.signal)
      if (controller.signal.aborted) return
      const owner = contentRef.current
      if (result.kind === 'text') {
        rootRef.current = files.rootOf(resourceAddress, result.absolutePath)
        const next = drafts.loaded(resourceAddress, result.text, result.version)
        if (owner.kind === 'renderer') owner.loaded(next.baseVersion)
        setLoad({ kind: 'ready' })
        return
      }
      if (owner.kind === 'renderer') owner.failed()
      setLoad(result.kind === 'refused' ? { kind: 'refused', reason: result.reason } : { kind: 'failed', message: result.message })
    })()
    return () => { controller.abort() }
  }, [resourceAddress, revision, files, drafts])

  // The change feed: a clean draft reloads silently, a dirty one shows the conflict banner.
  const diskVersion = meta.value?.version
  useEffect(() => {
    if (diskVersion === undefined || load.kind !== 'ready') return
    if (drafts.diskChanged(resourceAddress, diskVersion) === 'reload' && content.kind === 'renderer') content.reload()
  }, [diskVersion, load.kind, resourceAddress, drafts])

  const save = useCallback(async (expectedVersion?: string): Promise<void> => {
    const current = drafts.get(resourceAddress)
    if (current === undefined || current.saving) return
    if (!drafts.isDirty(resourceAddress) && expectedVersion === undefined) return
    const result = await files.save(drafts, current, expectedVersion)
    if (result.kind === 'saved') {
      const owner = contentRef.current
      if (owner.kind === 'renderer') owner.loaded(result.version)
      setComparing(undefined)
      setConfirmOverwrite(false)
      flash(t('saved'))
    }
  }, [drafts, files, resourceAddress])
  const saveRef = useRef(save)
  saveRef.current = save
  const flash = (message: string): void => {
    setSavedFlash(message)
    window.setTimeout(() => { setSavedFlash(undefined) }, 1500)
  }
  const saveAll = async (): Promise<void> => {
    const results = await files.saveAll(drafts)
    const saved = results.filter(result => result.kind === 'saved').length
    if (saved > 0) flash(t('saveAll.done', { count: saved }))
  }
  const saveAllRef = useRef(saveAll)
  saveAllRef.current = saveAll

  // Language intelligence: the first "no language server" answer turns it off for this view.
  const ask = async (position: EditorPosition, operation: 'hover' | 'goToDefinition' | 'findReferences') => {
    if (!lspAvailable.current) return undefined
    const result = await files.navigate(resourceAddress, position, operation, new AbortController().signal)
    if (result.kind === 'unavailable') lspAvailable.current = false
    return result
  }
  const go = (target: EditorTarget): void => {
    if (target.address === resourceAddress) editorRef.current?.reveal(target.line, target.column)
    else openAt(target)
  }
  const locate = async (position: EditorPosition, operation: 'goToDefinition' | 'findReferences'): Promise<void> => {
    if (!lspAvailable.current) return
    setPanel({ kind: 'loading' })
    const result = await ask(position, operation)
    if (result === undefined || result.kind === 'unavailable') {
      setPanel(undefined)
      return
    }
    if (result.kind === 'failed') {
      setPanel({ kind: 'message', text: t('lsp.failed', { message: result.message }) })
      return
    }
    if (result.kind !== 'locations' || result.locations.length === 0) {
      setPanel({ kind: 'message', text: t('lsp.none') })
      return
    }
    const targets = files.targetsOf(resourceAddress, rootRef.current, result.locations)
    if (operation === 'goToDefinition' && targets.length === 1) {
      setPanel(undefined)
      go(targets[0] as EditorTarget)
      return
    }
    const title = t(operation === 'findReferences' ? 'lsp.references' : 'lsp.definitions', { count: targets.length })
    setPanel({ kind: 'targets', title, targets })
  }
  const hooks: EditorNavigationHooks = {
    hover: async (position) => {
      const result = await ask(position, 'hover')
      return result?.kind === 'hover' ? result.contents : undefined
    },
    definition: (position) => { void locate(position, 'goToDefinition') },
    references: (position) => { void locate(position, 'findReferences') },
  }
  const navigationRef = useRef(hooks)
  navigationRef.current = hooks

  // Mount CodeMirror once the draft exists; later text changes from reloads flow in through setText.
  const ready = load.kind === 'ready' && draft !== undefined
  useEffect(() => {
    const host = hostRef.current
    const initial = drafts.get(resourceAddress)
    if (!ready || host === null || initial === undefined) return
    const editor = createFileEditor({
      parent: host,
      text: initial.text,
      language,
      readOnly: !initial.editing,
      wrap,
      onChange: (text) => { drafts.edit(resourceAddress, text) },
      onSave: () => { void saveRef.current() },
      onSaveAll: () => { void saveAllRef.current() },
      onCursor: setCursor,
      navigation: {
        hover: position => navigationRef.current.hover(position),
        definition: (position) => { navigationRef.current.definition(position) },
        references: (position) => { navigationRef.current.references(position) },
      },
    })
    editorRef.current = editor
    // Come back where the tab was, or where a definition jump pointed.
    const view = drafts.takeView(resourceAddress)
    if (view?.kind === 'restore') editor.restoreView(view)
    else if (view?.kind === 'reveal') editor.reveal(view.line, view.column)
    return () => {
      drafts.setView(resourceAddress, { kind: 'restore', ...editor.getView() })
      editor.dispose()
      editorRef.current = undefined
    }
  }, [ready, resourceAddress])

  const text = draft?.text
  useEffect(() => { if (text !== undefined) editorRef.current?.setText(text) }, [text])
  useEffect(() => { editorRef.current?.setReadOnly(!editing) }, [editing])
  useEffect(() => { editorRef.current?.setWrap(wrap) }, [wrap])
  useEffect(() => { void editorRef.current?.setLanguage(language) }, [language])
  useEffect(() => { editorRef.current?.setWhitespace(whitespace) }, [whitespace])

  const startEditing = (): void => {
    drafts.setEditing(resourceAddress, true)
    window.setTimeout(() => editorRef.current?.focus(), 0)
  }
  const reloadFromDisk = (): void => {
    drafts.discard(resourceAddress)
    setComparing(undefined)
    setConfirmOverwrite(false)
    if (content.kind === 'renderer') content.reload()
  }
  const toggleCompare = async (): Promise<void> => {
    if (comparing !== undefined) {
      setComparing(undefined)
      return
    }
    const result = await files.read(resourceAddress, new AbortController().signal)
    if (result.kind === 'text') setComparing(result.text)
  }
  const overwrite = async (): Promise<void> => {
    const result = await files.read(resourceAddress, new AbortController().signal)
    if (result.kind === 'text') await save(result.version)
  }

  if (load.kind === 'loading') return <p className={css.status}>{t('loading')}</p>
  if (load.kind === 'refused') {
    const key = load.reason === 'binary' ? 'refused.binary' : load.reason === 'too-large' ? 'refused.tooLarge' : 'refused.notUtf8'
    return <p className={css.status} role="alert">{t(key)}</p>
  }
  if (load.kind === 'failed' || draft === undefined) {
    return <p className={css.status} role="alert">{t('refused.read', { message: load.kind === 'failed' ? load.message : '' })}</p>
  }

  const indent = cursor?.indent ?? detectIndent(draft.text)
  return (
    <div className={css.root} data-code-editor data-editing={editing} data-dirty={dirty}>
      <div className={css.toolbar}>
        {editing
          ? <>
            <button type="button" className={css.primary} disabled={!dirty || draft.saving} onClick={() => { void save() }}
              title={t('save.shortcut')}>
              {draft.saving ? t('saving') : t('save')}
            </button>
            {dirty && <button type="button" className={css.button} onClick={reloadFromDisk}>{t('discard')}</button>}
            <button type="button" className={css.button} disabled={dirty}
              onClick={() => { drafts.setEditing(resourceAddress, false) }}>{t('done')}</button>
          </>
          : <button type="button" className={css.primary} onClick={startEditing}>{t('edit')}</button>}
        <span className={css.state} aria-live="polite">
          {dirty && <><span className={css.dot} aria-hidden />{t('unsaved')}</>}
          {savedFlash !== undefined && !dirty && savedFlash}
        </span>
      </div>
      {draft.conflict !== undefined && (
        <div className={css.banner} role="alert" data-conflict>
          <span className={css.bannerText}>{t('conflict.message')}</span>
          <button type="button" className={css.button} onClick={reloadFromDisk}>{t('conflict.reload')}</button>
          <button type="button" className={css.button} onClick={() => { void toggleCompare() }}>
            {comparing === undefined ? t('conflict.compare') : t('conflict.hideCompare')}
          </button>
          {confirmOverwrite
            ? <>
              <button type="button" className={css.danger} onClick={() => { void overwrite() }}>{t('conflict.confirmOverwrite')}</button>
              <button type="button" className={css.button} onClick={() => { setConfirmOverwrite(false) }}>{t('conflict.cancel')}</button>
            </>
            : <button type="button" className={css.button} onClick={() => { setConfirmOverwrite(true) }}>{t('conflict.overwrite')}</button>}
        </div>
      )}
      {draft.error !== undefined && <p className={css.error} role="alert">{t('save.failed', { message: draft.error })}</p>}
      {comparing !== undefined && (
        <CompareView disk={comparing.text} draft={draft.text} diskLabel={t('compare.disk')} draftLabel={t('compare.draft')} />
      )}
      <div ref={hostRef} className={css.editor} hidden={comparing !== undefined} />
      {panel !== undefined && (
        <div className={css.panel} data-navigation-panel>
          <div className={css.panelHeader}>
            <span>{panel.kind === 'targets' ? panel.title : panel.kind === 'loading' ? t('lsp.loading') : panel.text}</span>
            <button type="button" className={css.button} onClick={() => { setPanel(undefined) }}>{t('lsp.close')}</button>
          </div>
          {panel.kind === 'targets' && (
            <ul className={css.panelList}>
              {panel.targets.map(target => (
                <li key={`${target.address}:${target.line}:${target.column}`}>
                  <button type="button" className={css.panelItem} onClick={() => { go(target) }}>
                    {target.label}:{target.line}:{target.column}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className={css.statusBar}>
        <button type="button" className={css.statusItem} title={t('status.goToLine')} onClick={() => editorRef.current?.goToLine()}>
          {t('status.position', { line: cursor?.line ?? 1, column: cursor?.column ?? 1 })}
          {(cursor?.selected ?? 0) > 0 && ` ${t('status.selected', { count: cursor?.selected ?? 0 })}`}
          {(cursor?.cursors ?? 1) > 1 && ` · ${t('status.cursors', { count: cursor?.cursors ?? 1 })}`}
        </button>
        <span className={css.spacer} />
        <select className={css.statusSelect} aria-label={t('status.indent')} value={`${indent.kind}:${indent.size}`}
          onChange={(event) => {
            const [kind, size] = event.target.value.split(':')
            editorRef.current?.setIndent({ kind: kind === 'tabs' ? 'tabs' : 'spaces', size: Number(size) })
          }}>
          {[2, 4, 8].map(size => <option key={`s${size}`} value={`spaces:${size}`}>{t('status.spaces', { size })}</option>)}
          {[2, 4, 8].map(size => <option key={`t${size}`} value={`tabs:${size}`}>{t('status.tabs', { size })}</option>)}
        </select>
        <span className={css.statusItem}>{t(draft.bom ? 'status.utf8Bom' : 'status.utf8')}</span>
        <select className={css.statusSelect} aria-label={t('status.eol')} value={draft.eol}
          onChange={(event) => { drafts.setLineEnding(resourceAddress, event.target.value === 'CRLF' ? 'CRLF' : 'LF') }}>
          <option value="LF">{t('status.lf')}</option>
          <option value="CRLF">{t('status.crlf')}</option>
        </select>
        <select className={css.statusSelect} aria-label={t('status.language')} value={language}
          onChange={(event) => { setLanguage(event.target.value) }}>
          {EDITOR_LANGUAGES.map(option => (
            <option key={option.id} value={option.id}>{option.id === FALLBACK_LANGUAGE_ID ? t('status.plainText') : option.name}</option>
          ))}
        </select>
        <label className={css.statusToggle}>
          <input type="checkbox" checked={whitespace} onChange={(event) => { setWhitespace(event.target.checked) }} />
          {t('status.whitespace')}
        </label>
      </div>
    </div>
  )
}
