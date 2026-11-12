/** Spec workspace/0001 AC-12: hover, definition, and references through `ctx.lsp`. */
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LspQueryRequest, LspQueryResult, LspService } from '@anotherharness/ah-lsp'
import { failureOf, openWorkspace, signal, type Harness } from './harness.ts'

let h: Harness
afterEach(async () => { await h.dispose() })

function provideLsp(query: (request: LspQueryRequest) => Promise<LspQueryResult>): ReturnType<typeof vi.fn<LspService['query']>> {
  const spy = vi.fn<LspService['query']>(query)
  h.ctx.provide('lsp', { registerProvider: () => () => {}, query: spy } satisfies LspService as never)
  return spy
}

describe('workspaceFiles.navigate', () => {
  it('returns hover text and maps file locations to absolute paths', async () => {
    h = await openWorkspace('wf-nav-')
    await writeFile(join(h.workspace, 'a.ts'), 'const a = 1\n')
    const target = join(h.workspace, 'b.ts')
    const definition: LspQueryResult = {
      kind: 'locations',
      resolvedWorkspaceUri: pathToFileURL(h.workspace).href,
      locations: [
        { uri: pathToFileURL(target).href, range: { start: { line: 2, character: 4 }, end: { line: 2, character: 5 } } },
        { uri: 'untitled:x', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } },
      ],
    }
    const query = provideLsp(request => Promise.resolve(request.operation === 'hover'
      ? { kind: 'hover', hover: { contents: 'const a: 1' } }
      : definition))
    const files = h.endpoint()
    expect(await files.navigate(h.scope, 'a.ts', { line: 0, character: 6 }, 'hover', signal()))
      .toEqual({ kind: 'hover', contents: 'const a: 1' })
    expect(query).toHaveBeenCalledWith({
      operation: 'hover', filePath: join(h.workspace, 'a.ts'), position: { line: 0, character: 6 }, workspaceRoot: h.workspace,
    }, expect.any(AbortSignal))
    expect(await files.navigate(h.scope, 'a.ts', { line: 0, character: 6 }, 'goToDefinition', signal())).toEqual({
      kind: 'locations',
      locations: [{ absolutePath: target, start: { line: 2, character: 4 }, end: { line: 2, character: 5 } }],
    })
  })

  it('reports no hover as a hover without contents', async () => {
    h = await openWorkspace('wf-nav-')
    await writeFile(join(h.workspace, 'a.ts'), 'x')
    provideLsp(() => Promise.resolve({ kind: 'hover', hover: null }))
    expect(await h.endpoint().navigate(h.scope, 'a.ts', { line: 0, character: 0 }, 'hover', signal()))
      .toStrictEqual({ kind: 'hover' })
  })

  it('AC-12: refuses without a language server, for unhandled files, and for bad positions', async () => {
    h = await openWorkspace('wf-nav-')
    await writeFile(join(h.workspace, 'a.ts'), 'x')
    const files = h.endpoint()
    expect(await failureOf(files.navigate(h.scope, 'a.ts', { line: 0, character: 0 }, 'hover', signal())))
      .toEqual({ code: 'workspace-file/no-language-server', details: { path: 'a.ts' } })
    expect((await failureOf(files.navigate(h.scope, 'a.ts', { line: -1, character: 0 }, 'hover', signal()))).code).toBe('gateway/bad-request')
    expect((await failureOf(files.navigate(h.scope, 'a.ts', { line: 0, character: 0.5 }, 'hover', signal()))).code).toBe('gateway/bad-request')
    const unavailable = Object.assign(new Error('none'), { code: 'LSP_UNAVAILABLE' })
    provideLsp(() => Promise.reject(unavailable))
    expect((await failureOf(files.navigate(h.scope, 'a.ts', { line: 0, character: 0 }, 'hover', signal()))).code)
      .toBe('workspace-file/no-language-server')
  })

  it('passes other language-server failures through', async () => {
    h = await openWorkspace('wf-nav-')
    await writeFile(join(h.workspace, 'a.ts'), 'x')
    const broken = new Error('server crashed')
    provideLsp(() => Promise.reject(broken))
    await expect(h.endpoint().navigate(h.scope, 'a.ts', { line: 0, character: 0 }, 'findReferences', signal())).rejects.toBe(broken)
  })
})
