/** Side-by-side comparison of the disk version and the draft, read-only on both sides. */
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { MergeView } from '@codemirror/merge'
import { EditorState } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import css from './EditorBody.module.css'

/** The two texts and their labels. */
export interface CompareViewProps {
  readonly disk: string
  readonly draft: string
  readonly diskLabel: string
  readonly draftLabel: string
}

const readOnly = [lineNumbers(), EditorState.readOnly.of(true), EditorView.editable.of(false), EditorView.lineWrapping]

/**
 * @param props - disk text, draft text, and column labels.
 * @returns a merge view with the disk on the left and the draft on the right.
 */
export function CompareView({ disk, draft, diskLabel, draftLabel }: CompareViewProps): ReactNode {
  const hostRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    const view = new MergeView({
      parent: host,
      a: { doc: disk, extensions: readOnly },
      b: { doc: draft, extensions: readOnly },
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: { margin: 3, minSize: 6 },
    })
    return () => { view.destroy() }
  }, [disk, draft])
  return (
    <div className={css.compare} data-compare>
      <div className={css.compareLabels}><span>{diskLabel}</span><span>{draftLabel}</span></div>
      <div ref={hostRef} className={css.compareBody} />
    </div>
  )
}
