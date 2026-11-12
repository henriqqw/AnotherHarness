// @vitest-environment jsdom
/** The editor chunk loads lazily, with a loading line while it arrives. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { makeTranslate } from '@anotherharness/ah-client-test-runtime'
import type { EditorBodyProps } from '../src/client/EditorBody.tsx'
import { LazyEditorBody } from '../src/client/LazyEditorBody.tsx'
import { zh } from '../src/client/locales.ts'

vi.mock('../src/client/EditorBody.tsx', () => ({ EditorBody: () => <p data-editor-body>editor</p> }))

afterEach(() => { cleanup() })

describe('LazyEditorBody', () => {
  it('shows the loading line, then the editor body', async () => {
    const props: Partial<EditorBodyProps> = { t: makeTranslate(zh) }
    const view = render(<LazyEditorBody {...props as EditorBodyProps} />)
    expect(view.container.textContent).toBe(zh.loading)
    await act(async () => { await vi.dynamicImportSettled() })
    expect(view.container.querySelector('[data-editor-body]')).not.toBeNull()
  })
})
