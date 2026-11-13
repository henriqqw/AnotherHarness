/**
 * Decode file bytes for editing and encode the draft back, keeping the file's
 * byte order mark and line endings so a save changes only what the user typed.
 */

/** Line ending style detected in a file. */
export type LineEnding = 'LF' | 'CRLF'

/** Editable text plus the details a save must restore. */
export interface EditableText {
  /** Content with `\n` line breaks and no byte order mark. */
  readonly text: string
  /** The file's dominant line ending. */
  readonly eol: LineEnding
  /** Whether the file starts with a UTF-8 byte order mark. */
  readonly bom: boolean
}

/** Why bytes cannot be edited as text. */
export type DecodeRefusal = 'binary' | 'not-utf8' | 'too-large'

const BOM = '﻿'

/**
 * Decode UTF-8 file bytes for the editor.
 * @param data - complete file bytes.
 * @returns the editable text, or why the bytes are not editable.
 */
export function decodeEditable(data: Uint8Array): EditableText | DecodeRefusal {
  if (data.includes(0)) return 'binary'
  let decoded: string
  try {
    decoded = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(data)
  } catch {
    return 'not-utf8'
  }
  const bom = decoded.startsWith(BOM)
  const body = bom ? decoded.slice(1) : decoded
  const crlf = body.match(/\r\n/gu)?.length ?? 0
  const lf = (body.match(/\n/gu)?.length ?? 0) - crlf
  return { text: body.replace(/\r\n/gu, '\n'), eol: crlf > lf ? 'CRLF' : 'LF', bom }
}

/**
 * Turn the draft back into the text written to disk.
 * @param text - editor content with `\n` line breaks.
 * @param format - line ending and byte order mark to restore.
 * @returns the file content.
 */
export function encodeEditable(text: string, format: Pick<EditableText, 'eol' | 'bom'>): string {
  const body = format.eol === 'CRLF' ? text.replace(/\n/gu, '\r\n') : text
  return format.bom ? BOM + body : body
}
