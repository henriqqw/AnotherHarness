/** Spec workspace/0001 AC-9: every suffix maps to a language whose support loads. */
import { describe, expect, it } from 'vitest'
import { EDITOR_LANGUAGES, editorLanguageById, editorLanguageForPath } from '../src/client/languages.ts'

describe('editor languages', () => {
  it('picks languages by suffix and by well-known file name', () => {
    expect(editorLanguageForPath('src/app.tsx').id).toBe('tsx')
    expect(editorLanguageForPath('C:\\work\\main.PY').id).toBe('python')
    expect(editorLanguageForPath('Dockerfile').id).toBe('dockerfile')
    expect(editorLanguageForPath('docker/Dockerfile.dev').id).toBe('dockerfile')
    expect(editorLanguageForPath('.env').id).toBe('properties')
    expect(editorLanguageForPath('notes').id).toBe('plaintext')
    expect(editorLanguageForPath('.hidden').id).toBe('plaintext')
    expect(editorLanguageForPath('a.unknown').id).toBe('plaintext')
    expect(editorLanguageById('nope').id).toBe('plaintext')
  })

  it('loads every language support', async () => {
    for (const language of EDITOR_LANGUAGES) {
      await expect(language.load(), language.id).resolves.toBeDefined()
    }
  })
})
