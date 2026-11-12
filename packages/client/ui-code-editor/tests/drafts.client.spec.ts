/** Spec workspace/0001 AC-1 to AC-4: the draft model behind every editor view. */
import { describe, expect, it, vi } from 'vitest'
import { DraftStore, isDirty } from '../src/client/drafts.ts'
import { decodeEditable, encodeEditable, type EditableText } from '../src/client/text-codec.ts'

const A = 'ah-resource://file/session/s-1/src/a.ts'
const text = (value: string): EditableText => ({ text: value, eol: 'LF', bom: false })

describe('DraftStore', () => {
  it('AC-1: loads, edits, and saves, clearing the unsaved state', () => {
    const drafts = new DraftStore()
    const listener = vi.fn()
    const off = drafts.subscribe(listener)
    drafts.loaded(A, text('one'), 'v1')
    expect(isDirty(drafts.get(A))).toBe(false)
    drafts.edit(A, 'two')
    drafts.edit(A, 'two')
    expect(isDirty(drafts.get(A))).toBe(true)
    expect(drafts.dirty().map(draft => draft.address)).toEqual([A])
    drafts.saving(A)
    expect(drafts.get(A)?.saving).toBe(true)
    drafts.saved(A, 'two', 'v2')
    expect(drafts.get(A)).toMatchObject({ baseText: 'two', baseVersion: 'v2', saving: false })
    expect(isDirty(drafts.get(A))).toBe(false)
    expect(listener).toHaveBeenCalledTimes(4)
    expect(drafts.getVersion()).toBe(4)
    off()
    drafts.edit(A, 'three')
    expect(listener).toHaveBeenCalledTimes(4)
  })

  it('AC-4: a disk change reloads a clean draft and conflicts with a dirty one', () => {
    const drafts = new DraftStore()
    expect(drafts.diskChanged(A, 'v1')).toBe('none')
    drafts.loaded(A, text('one'), 'v1')
    expect(drafts.diskChanged(A, 'v1')).toBe('none')
    expect(drafts.diskChanged(A, 'v2')).toBe('reload')
    drafts.edit(A, 'mine')
    expect(drafts.diskChanged(A, 'v2')).toBe('conflict')
    expect(drafts.get(A)?.conflict).toEqual({ version: 'v2' })
    expect(drafts.diskChanged(A, 'v2')).toBe('none')
    drafts.saving(A)
    expect(drafts.diskChanged(A, 'v3')).toBe('none')
  })

  it('AC-4: a reload while dirty keeps the draft and marks the conflict', () => {
    const drafts = new DraftStore()
    drafts.loaded(A, text('one'), 'v1')
    drafts.setEditing(A, true)
    drafts.edit(A, 'mine')
    expect(drafts.loaded(A, text('agent'), 'v1').text).toBe('mine')
    drafts.loaded(A, text('agent'), 'v2')
    expect(drafts.get(A)).toMatchObject({ text: 'mine', baseText: 'one', conflict: { version: 'v2' }, editing: true })
  })

  it('AC-2 and AC-3: a stale save conflicts; discard drops the draft; failures show and clear', () => {
    const drafts = new DraftStore()
    drafts.loaded(A, text('one'), 'v1')
    drafts.edit(A, 'mine')
    drafts.conflicted(A, 'v9')
    expect(drafts.get(A)).toMatchObject({ saving: false, conflict: { version: 'v9' } })
    drafts.failed(A, 'disk full')
    expect(drafts.get(A)?.error).toBe('disk full')
    drafts.discard(A)
    expect(drafts.get(A)).toMatchObject({ text: 'one', conflict: undefined, error: undefined })
    drafts.loaded(A, text('agent'), 'v9')
    expect(drafts.get(A)).toMatchObject({ text: 'agent', baseVersion: 'v9' })
  })

  it('treats a line ending change as unsaved and moves drafts on rename', () => {
    const drafts = new DraftStore()
    drafts.loaded(A, text('one'), 'v1')
    drafts.setLineEnding(A, 'LF')
    drafts.setLineEnding(A, 'CRLF')
    expect(isDirty(drafts.get(A))).toBe(true)
    drafts.setEditing(A, false)
    const B = `${A}.bak`
    drafts.rename(A, B)
    drafts.rename(A, B)
    expect(drafts.get(A)).toBeUndefined()
    expect(drafts.get(B)?.address).toBe(B)
    drafts.close(B)
    drafts.close(B)
    expect(drafts.get(B)).toBeUndefined()
  })

  it('ignores operations on unknown drafts', () => {
    const drafts = new DraftStore()
    const listener = vi.fn()
    drafts.subscribe(listener)
    drafts.edit(A, 'x')
    drafts.setEditing(A, true)
    drafts.setLineEnding(A, 'CRLF')
    drafts.saving(A)
    drafts.saved(A, 'x', 'v')
    drafts.conflicted(A, 'v')
    drafts.failed(A, 'x')
    drafts.discard(A)
    expect(listener).not.toHaveBeenCalled()
    expect(isDirty(undefined)).toBe(false)
  })
})

describe('text codec', () => {
  const bytes = (value: string): Uint8Array => new TextEncoder().encode(value)

  it('keeps CRLF line endings and the byte order mark across a round trip', () => {
    const decoded = decodeEditable(bytes('﻿a\r\nb\r\n'))
    expect(decoded).toEqual({ text: 'a\nb\n', eol: 'CRLF', bom: true })
    expect(encodeEditable('a\nb\nc', decoded as EditableText)).toBe('﻿a\r\nb\r\nc')
    expect(decodeEditable(bytes('a\nb\r\nc\n'))).toEqual({ text: 'a\nb\nc\n', eol: 'LF', bom: false })
    expect(encodeEditable('a\nb', { eol: 'LF', bom: false })).toBe('a\nb')
    expect(decodeEditable(bytes('single line'))).toEqual({ text: 'single line', eol: 'LF', bom: false })
  })

  it('refuses binary and non-UTF-8 bytes', () => {
    expect(decodeEditable(new Uint8Array([97, 0, 98]))).toBe('binary')
    expect(decodeEditable(new Uint8Array([0xff, 0xfe, 0x41]))).toBe('not-utf8')
  })
})
