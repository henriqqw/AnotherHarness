/**
 * The frame-wide Save / Don't save / Cancel dialog for closing a tab with
 * unsaved changes. It lives in the shell overlay, not in the tab, because the
 * tab being closed may not be on screen.
 */
import { useSyncExternalStore, type ReactNode } from 'react'
import { Button, Modal } from '@anotherharness/ah-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@anotherharness/ah-client-ui-slots'
import type { CloseFlow } from './close-prompt.ts'
import { nameOfAddress } from './follow-moves.ts'
import type {} from './locales.ts'
import css from './ClosePrompt.module.css'

/** The close flow the dialog reads and answers. */
export interface ClosePromptInjected {
  readonly flow: CloseFlow
}

/** Injected flow and this package's copy. */
export type ClosePromptProps = InjectFace<ClosePromptInjected> & PropsLocale<'codeEditor'>

/**
 * @param props - the close flow and copy.
 * @returns the dialog while a close waits on an answer, otherwise nothing.
 */
export function ClosePrompt({ flow, t }: ClosePromptProps): ReactNode {
  const state = useSyncExternalStore(flow.subscribe, flow.getSnapshot)
  const { request } = state
  if (request === undefined) return null
  const cancel = (): void => { void flow.choose('cancel') }
  return (
    <Modal open onClose={cancel} title={t('close.title', { name: nameOfAddress(request.address) })} closeLabel={t('close.cancel')}
      description={t('close.message')}
      footer={<>
        <Button onClick={cancel} data-close-cancel>{t('close.cancel')}</Button>
        <Button onClick={() => { void flow.choose('discard') }} disabled={state.busy} data-close-discard>{t('close.discard')}</Button>
        <Button variant="primary" onClick={() => { void flow.choose('save') }} disabled={state.busy} data-close-save>
          {state.busy ? t('saving') : t('close.save')}
        </Button>
      </>}>
      {state.error !== undefined && <p className={css.error} role="alert">{t('save.failed', { message: state.error })}</p>}
      {state.conflict && <p className={css.error} role="alert">{t('close.conflict')}</p>}
    </Modal>
  )
}
