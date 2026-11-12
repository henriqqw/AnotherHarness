/** Load CodeMirror only when an editor body mounts, so read-only previews stay light. */
import { lazy, Suspense, type ReactNode } from 'react'
import type { EditorBodyProps } from './EditorBody.tsx'

const LoadedEditorBody = lazy(async () => ({ default: (await import('./EditorBody.tsx')).EditorBody }))

/**
 * Suspend while the editor chunk arrives.
 * @param props - editor body props supplied by the document slot.
 * @returns the deferred editor.
 */
export function LazyEditorBody(props: EditorBodyProps): ReactNode {
  return <Suspense fallback={<p style={{ margin: 0, padding: 16 }}>{props.t('loading')}</p>}>
    <LoadedEditorBody {...props} />
  </Suspense>
}
