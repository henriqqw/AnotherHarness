/**
 * Unit tests for the SearXNG search provider.
 * Uses a fake HTTP server so no real SearXNG instance is needed.
 */
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  SearXNGSearchProvider,
  mapSearXNGResult,
  mapSearXNGResponse,
  SEARXNG_PROVIDER_ID,
} from '../src/provider.ts'
import type { SearXNGResponse } from '../src/types.ts'

// ── mapSearXNGResult ──────────────────────────────────────────────────────────

describe('mapSearXNGResult', () => {
  it('maps a full result to a WebSearchSource', () => {
    expect(mapSearXNGResult({
      url: 'https://example.com',
      title: 'Example',
      content: 'A snippet.',
      publishedDate: '2024-01-15',
    })).toEqual({ url: 'https://example.com', title: 'Example', snippet: 'A snippet.', publishedAt: '2024-01-15' })
  })

  it('drops results with no content', () => {
    expect(mapSearXNGResult({ url: 'https://example.com' })).toBeUndefined()
    expect(mapSearXNGResult({ url: 'https://example.com', content: '   ' })).toBeUndefined()
  })

  it('omits title and publishedAt when absent', () => {
    const result = mapSearXNGResult({ url: 'https://example.com', content: 'snippet' })
    expect(result).toEqual({ url: 'https://example.com', snippet: 'snippet' })
  })
})

// ── mapSearXNGResponse ────────────────────────────────────────────────────────

describe('mapSearXNGResponse', () => {
  it('maps results, drops snippet-less entries, and respects maxResults', () => {
    const response: SearXNGResponse = {
      results: [
        { url: 'https://a.com', content: 'aaa' },
        { url: 'https://b.com' },             // no snippet → dropped
        { url: 'https://c.com', content: 'ccc' },
        { url: 'https://d.com', content: 'ddd' },
      ],
    }
    const result = mapSearXNGResponse(response, 2)
    expect(result.sources).toHaveLength(2)
    expect(result.sources[0]?.url).toBe('https://a.com')
    expect(result.sources[1]?.url).toBe('https://c.com')
    expect(result.truncated).toBe(true)
  })

  it('surfaces the first answer as content', () => {
    const result = mapSearXNGResponse({ results: [], answers: ['42 is the answer'] })
    expect(result.content).toBe('42 is the answer')
  })

  it('reports truncated false when results fit within maxResults', () => {
    const result = mapSearXNGResponse({ results: [{ url: 'https://a.com', content: 'x' }] }, 10)
    expect(result.truncated).toBe(false)
  })
})

// ── SearXNGSearchProvider ─────────────────────────────────────────────────────

describe('SearXNGSearchProvider', () => {
  it('has the correct stable provider id', () => {
    const provider = new SearXNGSearchProvider({
      baseURL: 'http://127.0.0.1:8888',
      categories: 'general',
      language: 'all',
    })
    expect(provider.id).toBe(SEARXNG_PROVIDER_ID)
  })

  it('is available when baseURL is a valid URL', () => {
    const ok = new SearXNGSearchProvider({ baseURL: 'http://127.0.0.1:8888', categories: 'general', language: 'all' })
    expect(ok.available()).toBe(true)

    const bad = new SearXNGSearchProvider({ baseURL: 'not-a-url', categories: 'general', language: 'all' })
    expect(bad.available()).toBe(false)
  })
})

// ── HTTP integration against a fake server ────────────────────────────────────

describe('SearXNGSearchProvider HTTP', () => {
  let server: Server
  let baseURL: string
  let lastUrl: string | undefined

  const fakeResponse: SearXNGResponse = {
    query: 'test',
    results: [
      { url: 'https://result1.com', title: 'Result 1', content: 'First result snippet.' },
      { url: 'https://result2.com', title: 'Result 2', content: 'Second result snippet.' },
      { url: 'https://nsnippet.com' },
    ],
    answers: [],
  }

  beforeAll(async () => {
    server = createServer((req, res) => {
      lastUrl = req.url
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(fakeResponse))
    })
    const addr = await new Promise<AddressInfo>((resolve) => {
      server.listen(0, '127.0.0.1', () => { resolve(server.address() as AddressInfo) })
    })
    baseURL = `http://127.0.0.1:${String(addr.port)}`
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => { server.close(() => { resolve() }) })
  })

  it('sends the correct query params and parses the response', async () => {
    const provider = new SearXNGSearchProvider({ baseURL, categories: 'general,it', language: 'en' })
    const result = await provider.search({ query: 'hello world', maxResults: 2 })

    expect(lastUrl).toContain('q=hello+world')
    expect(lastUrl).toContain('format=json')
    expect(lastUrl).toContain('categories=general%2Cit')
    expect(lastUrl).toContain('language=en')

    // 2 of 3 raw results have snippets; truncated to maxResults=2
    expect(result.sources).toHaveLength(2)
    expect(result.truncated).toBe(false) // only 2 valid results, maxResults=2
    expect(result.sources[0]?.url).toBe('https://result1.com')
    expect(result.sources[1]?.url).toBe('https://result2.com')
  })

  it('throws WEB_PROVIDER_ERROR when the server is unreachable', async () => {
    const provider = new SearXNGSearchProvider({ baseURL: 'http://127.0.0.1:1', categories: 'general', language: 'all' })
    await expect(provider.search({ query: 'test' })).rejects.toMatchObject({ code: 'WEB_PROVIDER_ERROR' })
  })

  it('throws WEB_ABORTED when the signal fires', async () => {
    const provider = new SearXNGSearchProvider({ baseURL, categories: 'general', language: 'all' })
    const controller = new AbortController()
    controller.abort()
    await expect(provider.search({ query: 'test' }, controller.signal)).rejects.toMatchObject({ code: 'WEB_ABORTED' })
  })
})
