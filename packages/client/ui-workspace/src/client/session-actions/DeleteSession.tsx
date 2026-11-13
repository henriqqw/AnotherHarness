/**
 * The permanent-deletion action: a `sidebar.workspaces.session.menu.item`
 * row that asks for confirmation, and the `shell.overlay` dialog that names
 * the Session, states that deletion cannot be undone, and deletes on confirm.
 * Archive stays the reversible alternative.
 */
import { useState } from 'react'
import { Button, IconTrashOutlineRegular, MenuItemButton, Modal } from '@anotherharness/ah-client-ui-primitives'
import type {
  DeleteSessionInjected, SessionDeleteConfirmInjected, SessionDeleteConfirmProps, SessionDeleteConfirmRequest,
  SessionMenuItemProps,
} from '../contract/slots.ts'
import type { SessionId } from '@anotherharness/ah-session/types'
import browserCss from '../rows/WorkspaceBrowser.module.css'

/**
 * Menu row (order 500): ask to delete the Session permanently.
 * @param props - owner share, the delete share, and the menu open state.
 * @returns the row.
 */
export function DeleteSessionMenuItem({
  sessionId, useMenuOpenState, requestSessionDelete, t,
}: SessionMenuItemProps<DeleteSessionInjected>) {
  const [, setMenuOpen] = useMenuOpenState()
  return (
    <MenuItemButton
      danger
      separatorBefore
      icon={<IconTrashOutlineRegular size={14} />}
      onSelect={() => {
        setMenuOpen(false)
        requestSessionDelete(sessionId)
      }}
    >
      {t('menu.deleteSession')}
    </MenuItemButton>
  )
}

/**
 * The `shell.overlay` entry: nothing while no confirmation is pending,
 * otherwise one dialog per request (keyed by the Session).
 * @param props - the request hook, its settlement, the deletion hop, and the locale seat.
 * @returns the open dialog, or null.
 */
export function SessionDeleteConfirmDialog({
  useDeleteRequest, settleSessionDelete, deleteSession, t,
}: SessionDeleteConfirmProps) {
  const request = useDeleteRequest(pending => pending)
  if (request === null) return null
  return (
    <DeleteConfirmForm
      key={request.sessionId}
      request={request}
      deleteSession={deleteSession}
      onSettle={settleSessionDelete}
      t={t}
    />
  )
}

/** One request's dialog: in-flight and error state die with it. */
function DeleteConfirmForm({ request, deleteSession, onSettle, t }: {
  request: SessionDeleteConfirmRequest
  deleteSession: SessionDeleteConfirmInjected['deleteSession']
  onSettle: () => void
  t: SessionDeleteConfirmProps['t']
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const close = () => {
    if (deleting) return
    onSettle()
  }
  const batch = request.batch ?? []
  const [remaining, setRemaining] = useState(batch)
  const confirm = () => {
    setDeleting(true)
    setError(null)
    if (batch.length > 1) {
      void deleteAll(remaining, deleteSession).then(({ failed, reason }) => {
        setDeleting(false)
        if (failed.length === 0) {
          onSettle()
          return
        }
        setRemaining(failed)
        setError(t('delete.batch.failed', {
          done: batch.length - failed.length, total: batch.length,
          names: failed.map(item => item.displayTitle).join(', '), reason: deleteFailure(reason, t),
        }))
      })
      return
    }
    deleteSession(request.sessionId).then(() => {
      setDeleting(false)
      onSettle()
    }).catch((reason: unknown) => {
      setDeleting(false)
      setError(deleteFailure(reason, t))
    })
  }
  const shown = remaining.slice(0, BATCH_NAMES_SHOWN)
  return (
    <Modal
      open
      onClose={close}
      closeLabel={t('close')}
      title={batch.length > 1 ? t('delete.batch.title', { n: remaining.length }) : t('delete.confirm.title')}
      description={batch.length > 1 ? t('delete.batch.desc') : t('delete.confirm.desc', { title: request.displayTitle })}
      footer={(
        <>
          <Button variant="outline" disabled={deleting} onClick={close}>{t('cancel')}</Button>
          <Button variant="outline" className={browserCss.deleteAction} disabled={deleting} onClick={confirm}>
            {t('delete.confirm.action')}
          </Button>
        </>
      )}
    >
      {batch.length > 1 && (
        <ul className={browserCss.deleteList} data-delete-batch>
          {shown.map(item => <li key={item.sessionId}>{item.displayTitle}</li>)}
          {remaining.length > shown.length && <li>{t('delete.batch.more', { n: remaining.length - shown.length })}</li>}
        </ul>
      )}
      {deleting && <div className={browserCss.deleteStatus} role="status">{t('delete.confirm.pending')}</div>}
      {error !== null && <div className={browserCss.renameError} role="alert">{error}</div>}
    </Modal>
  )
}

/** Titles listed in a batch confirmation before "and N more". */
const BATCH_NAMES_SHOWN = 5

/**
 * Delete Sessions one at a time, so the Host refusal for a running one leaves the rest deleted.
 * @param items - the Sessions to delete.
 * @param deleteSession - the deletion hop.
 * @returns the Sessions that were not deleted and the last refusal.
 */
async function deleteAll(
  items: readonly { readonly sessionId: SessionId; readonly displayTitle: string }[],
  deleteSession: SessionDeleteConfirmInjected['deleteSession'],
): Promise<{ failed: { readonly sessionId: SessionId; readonly displayTitle: string }[]; reason: unknown }> {
  const failed: { readonly sessionId: SessionId; readonly displayTitle: string }[] = []
  let reason: unknown
  for (const item of items) {
    try {
      await deleteSession(item.sessionId)
    } catch (error: unknown) {
      failed.push(item)
      reason = error
    }
  }
  return { failed, reason }
}

/**
 * The text a failed deletion shows: the actionable line for a Session that
 * is still running, otherwise the Host's own message. The class identity
 * check goes by name: client plugin bundles do not share error-class identity.
 */
function deleteFailure(reason: unknown, t: SessionDeleteConfirmProps['t']): string {
  if (!(reason instanceof Error)) return String(reason)
  const code = reason.name === 'SessionDeleteError'
    ? (reason as Error & { readonly rpcError?: { readonly code?: string } }).rpcError?.code
    : undefined
  return code === 'session/active' ? t('delete.confirm.active') : reason.message
}
