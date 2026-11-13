/**
 * The tree's file operations UI: a context menu on rows and the toolbar, and
 * one dialog for New File, New Folder, Rename, and Delete. Delete names the
 * item; a folder delete says its contents go too.
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { TranslateNS } from '@anotherharness/ah-client-ui-slots'
import { Button, MenuSurface, Modal } from '@anotherharness/ah-client-ui-primitives'
import type { SessionId } from '@anotherharness/ah-session/types'
import { joinEntry, nameOf, parentOf, validEntryName, type FileOperations } from './operations.ts'
import type {} from './locales.ts'
import css from './FilesBody.module.css'

/** An entry the user acted on. */
export interface ActionTarget {
  /** Absolute path. */
  readonly path: string
  /** Entry kind. */
  readonly type: 'file' | 'directory'
}

/** The open dialog, if any. */
export type FileDialog =
  | { readonly kind: 'create-file' | 'create-folder'; readonly directory: string }
  | { readonly kind: 'rename' | 'delete'; readonly target: ActionTarget }

/** An open context menu at a page position. */
export interface FileMenu {
  readonly x: number
  readonly y: number
  /** The row under the pointer; undefined for the tree background. */
  readonly target: ActionTarget | undefined
  /** Directory new entries go into. */
  readonly directory: string
}

/** Props for the context menu. */
export interface FileContextMenuProps {
  readonly menu: FileMenu
  readonly onDialog: (dialog: FileDialog) => void
  readonly onClose: () => void
  /** Show a path in the Host's file manager; absent when the Host has none. @param path - absolute path. */
  readonly onReveal?: (path: string) => void
  readonly t: TranslateNS<'sidebarFiles'>
}

/**
 * @param props - menu position, target, dialog opener, and copy.
 * @returns the context menu.
 */
export function FileContextMenu({ menu, onDialog, onClose, onReveal, t }: FileContextMenuProps): ReactNode {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const close = (event: Event): void => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return
      if (event.type === 'pointerdown' && ref.current?.contains(event.target as Node)) return
      onClose()
    }
    document.addEventListener('pointerdown', close, true)
    document.addEventListener('keydown', close, true)
    ref.current?.querySelector('button')?.focus()
    return () => {
      document.removeEventListener('pointerdown', close, true)
      document.removeEventListener('keydown', close, true)
    }
  }, [onClose])
  const choose = (dialog: FileDialog): void => {
    onClose()
    onDialog(dialog)
  }
  return (
    <MenuSurface ref={ref} compact className={css.menu} role="menu" style={{ left: menu.x, top: menu.y }} data-files-menu>
      <button type="button" role="menuitem" className={css.menuItem}
        onClick={() => { choose({ kind: 'create-file', directory: menu.directory }) }}>{t('action.newFile')}</button>
      <button type="button" role="menuitem" className={css.menuItem}
        onClick={() => { choose({ kind: 'create-folder', directory: menu.directory }) }}>{t('action.newFolder')}</button>
      {onReveal !== undefined && <>
        <hr className={css.menuSeparator} />
        <button type="button" role="menuitem" className={css.menuItem} data-files-reveal
          onClick={() => {
            onClose()
            onReveal(menu.target?.path ?? menu.directory)
          }}>{t('action.reveal')}</button>
      </>}
      {menu.target !== undefined && (() => {
        const target = menu.target
        return <>
          <hr className={css.menuSeparator} />
          <button type="button" role="menuitem" className={css.menuItem}
            onClick={() => { choose({ kind: 'rename', target }) }}>{t('action.rename')}<kbd className={css.menuKey}>{t('action.renameKey')}</kbd></button>
          <button type="button" role="menuitem" className={css.menuDanger}
            onClick={() => { choose({ kind: 'delete', target }) }}>{t('action.delete')}<kbd className={css.menuKey}>{t('action.deleteKey')}</kbd></button>
        </>
      })()}
    </MenuSurface>
  )
}

/** Props for the operation dialog. */
export interface FileDialogViewProps {
  readonly dialog: FileDialog
  readonly sessionId: SessionId
  readonly operations: FileOperations
  /** Called after a successful operation. @param dialog - the finished dialog. @param path - the new path for create and rename. */
  readonly onDone: (dialog: FileDialog, path: string | undefined) => void
  readonly onClose: () => void
  readonly t: TranslateNS<'sidebarFiles'>
}

/**
 * @param props - the dialog, the operations, callbacks, and copy.
 * @returns a modal asking for a name or a delete confirmation.
 */
export function FileDialogView({ dialog, sessionId, operations, onDone, onClose, t }: FileDialogViewProps): ReactNode {
  const [name, setName] = useState(dialog.kind === 'rename' ? nameOf(dialog.target.path) : '')
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const isDelete = dialog.kind === 'delete'
  const title = t(`dialog.${dialog.kind}.title`)
  const submit = async (): Promise<void> => {
    if (busy) return
    let path: string | undefined
    let run: () => ReturnType<FileOperations['remove']>
    if (dialog.kind === 'delete') {
      run = () => operations.remove(sessionId, dialog.target.path, dialog.target.type === 'directory')
    } else {
      const valid = validEntryName(name)
      if (valid === undefined) {
        setError(t('dialog.invalidName'))
        return
      }
      if (dialog.kind === 'rename') {
        path = joinEntry(parentOf(dialog.target.path), valid)
        if (path === dialog.target.path) {
          onClose()
          return
        }
        const to = path
        run = () => operations.rename(sessionId, dialog.target.path, to)
      } else {
        const { directory, kind } = dialog as Extract<FileDialog, { readonly directory: string }>
        path = joinEntry(directory, valid)
        const created = path
        run = () => operations.create(sessionId, created, kind === 'create-file' ? 'file' : 'directory')
      }
    }
    setBusy(true)
    const result = await run()
    setBusy(false)
    if (result.ok) {
      onDone(dialog, path)
      return
    }
    setError(result.failure.code === 'workspace-file/exists' ? t('dialog.exists') : result.failure.message)
  }
  return (
    <Modal open onClose={onClose} title={title} closeLabel={t('dialog.cancel')}
      {...dialog.kind === 'delete' ? {
        description: t(dialog.target.type === 'directory' ? 'dialog.delete.folder' : 'dialog.delete.file', { name: nameOf(dialog.target.path) }),
      } : {}}
      footer={<>
        <Button onClick={onClose}>{t('dialog.cancel')}</Button>
        <Button variant="primary" className={isDelete ? css.dangerButton : undefined} disabled={busy}
          onClick={() => { void submit() }} data-files-dialog-confirm>
          {t(isDelete ? 'action.delete' : dialog.kind === 'rename' ? 'action.rename' : 'dialog.create')}
        </Button>
      </>}>
      {!isDelete && (
        <input className={css.dialogInput} value={name} data-modal-autofocus aria-label={t('dialog.name')}
          placeholder={t(dialog.kind === 'create-folder' ? 'dialog.folderPlaceholder' : 'dialog.filePlaceholder')}
          onChange={(event) => {
            setName(event.target.value)
            setError(undefined)
          }}
          onKeyDown={(event) => { if (event.key === 'Enter') void submit() }} />
      )}
      {error !== undefined && <p className={css.dialogError} role="alert">{error}</p>}
    </Modal>
  )
}
