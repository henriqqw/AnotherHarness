// @vitest-environment jsdom
/** Shift and Ctrl/Cmd selection of Session rows for batch actions. */
import { describe, expect, it } from 'vitest'
import { isTypingTarget, nextSelection } from '../src/client/rows/selection.ts'

const order = ['a', 'b', 'c', 'd']
const keys = (shiftKey: boolean, ctrlKey = false, metaKey = false) => ({ shiftKey, ctrlKey, metaKey })

describe('nextSelection', () => {
  it('selects a Shift range from the anchor in either direction, or the row alone without one', () => {
    expect(nextSelection(new Set(), 'b', 'd', keys(true), order)).toEqual({ selected: new Set(['b', 'c', 'd']), anchor: 'b' })
    expect(nextSelection(new Set(), 'c', 'a', keys(true), order)).toEqual({ selected: new Set(['a', 'b', 'c']), anchor: 'c' })
    expect(nextSelection(new Set(['x']), undefined, 'c', keys(true), order)).toEqual({ selected: new Set(['c']), anchor: 'c' })
    expect(nextSelection(new Set(), 'gone', 'b', keys(true), order)).toEqual({ selected: new Set(['b']), anchor: 'b' })
    expect(nextSelection(new Set(['d']), 'a', 'b', keys(true, true), order)).toEqual({ selected: new Set(['d', 'a', 'b']), anchor: 'a' })
    expect(nextSelection(new Set(), 'a', 'missing', keys(true), order)).toBeUndefined()
  })

  it('toggles with Ctrl or Cmd and leaves a plain click to open the row', () => {
    expect(nextSelection(new Set(['a']), undefined, 'b', keys(false, true), order)).toEqual({ selected: new Set(['a', 'b']), anchor: 'b' })
    expect(nextSelection(new Set(['a', 'b']), 'a', 'a', keys(false, false, true), order)).toEqual({ selected: new Set(['b']), anchor: 'a' })
    expect(nextSelection(new Set(['a']), 'a', 'b', keys(false), order)).toBeUndefined()
  })

  it('treats text fields and dialogs as typing places', () => {
    expect(isTypingTarget(null)).toBe(false)
    expect(isTypingTarget(document.createElement('div'))).toBe(false)
    expect(isTypingTarget(document.createElement('input'))).toBe(true)
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    document.body.append(editable)
    expect(isTypingTarget(editable)).toBe(true)
    editable.remove()
  })
})
