/**
 * `SearXNGSearchProvider`: a `WebSearchProvider` backed by a self-hosted SearXNG
 * instance (`GET /search?format=json`). No API key required — just a running
 * SearXNG server on the configured base URL (default: `http://127.0.0.1:8888`).
 *
 * SearXNG aggregates dozens of engines (Google, Bing, DuckDuckGo, GitHub,
 * arXiv, Wikipedia…) in parallel and deduplicates results by URL.
 *
 * @module @anotherharness/ah-web-search-searxng/provider
 */

import { WebError } from '@anotherharness/ah-web'
import type {
  WebSearchProvider,
  WebSearchRequest,
  WebSearchResult,
  WebSearchSource,
} from '@anotherharness/ah-web'
import type { SearXNGResponse, SearXNGResult } from './types.ts'

/** Stable provider id registered on `ctx.web`. */
export const SEARXNG_PROVIDER_ID = 'searxng'

/** Default SearXNG instance URL (matches the docker-compose in this repo). */
export const SEARXNG_DEFAULT_BASE_URL = 'http://127.0.0.1:8888'

/**
 * SearXNG categories to request. `general` covers most engines.
 * Override per request via `searchCategories`.
 */
export const SEARXNG_DEFAULT_CATEGORIES = 'general'

/** SearXNG language setting — `all` returns results in any language. */
export const SEARXNG_DEFAULT_LANGUAGE = 'all'

/** Resolved provider options (the plugin's `apply` supplies defaults). */
export interface SearXNGSearchProviderOptions {
  /** SearXNG base URL. Trailing slash is stripped before appending `/search`. */
  baseURL: string
  /** Comma-separated SearXNG categories, e.g. `general,it,science`. */
  categories: string
  /** SearXNG language code or `all`. */
  language: string
  /** Default result count when a request carries no `maxResults`. */
  numResults?: number
}

/**
 * Map one SearXNG result to a normalized source, or `undefined` when it
 * carries no snippet (content). Results without a snippet are dropped to keep
 * model context clean.
 */
export function mapSearXNGResult(result: SearXNGResult): WebSearchSource | undefined {
  const snippet = result.content?.trim()
  if (!snippet) return undefined
  return {
    url: result.url,
    ...result.title?.trim() ? { title: result.title.trim() } : {},
    snippet,
    ...result.publishedDate?.trim() ? { publishedAt: result.publishedDate.trim() } : {},
  }
}

/**
 * Map a SearXNG response to a normalized `WebSearchResult`.
 * Drops snippet-less results and respects the requested `maxResults` bound.
 */
export function mapSearXNGResponse(response: SearXNGResponse, maxResults?: number): WebSearchResult {
  const sources = (response.results ?? [])
    .map(mapSearXNGResult)
    .filter((s): s is WebSearchSource => s !== undefined)
  const capped = maxResults !== undefined && sources.length > maxResults
    ? sources.slice(0, maxResults)
    : sources
  // A direct answer (e.g. from an infobox engine) surfaces as the result content.
  const firstAnswer = response.answers?.find(a => typeof a === 'string' && a.trim().length > 0)
  return {
    ...firstAnswer !== undefined ? { content: firstAnswer as string } : {},
    sources: capped,
    truncated: maxResults !== undefined && sources.length > maxResults,
  }
}

/** SearXNG search provider — requires no API key, only a running local instance. */
export class SearXNGSearchProvider implements WebSearchProvider {
  readonly id = SEARXNG_PROVIDER_ID

  constructor(private readonly options: SearXNGSearchProviderOptions) {}

  available(): boolean {
    return URL.canParse(this.options.baseURL)
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    const base = this.options.baseURL.replace(/\/$/, '')
    const params = new URLSearchParams({
      q: request.query,
      format: 'json',
      categories: this.options.categories,
      language: this.options.language,
    })
    // SearXNG does not have a results-count param; we post-filter client-side.
    const url = `${base}/search?${params.toString()}`

    let response: Response
    try {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'accept': 'application/json',
          'user-agent': 'AnotherHarness/0.2.1',
        },
        ...signal !== undefined ? { signal } : {},
      })
    } catch (error: unknown) {
      if (isAbortError(error)) throw new WebError('SearXNG search aborted', 'WEB_ABORTED', { cause: error })
      throw new WebError(
        `SearXNG request failed — is SearXNG running at ${base}? Error: ${String(error)}`,
        'WEB_PROVIDER_ERROR',
        { cause: error },
      )
    }

    if (!response.ok) {
      throw new WebError(
        `SearXNG returned HTTP ${String(response.status)} — check the instance at ${base}`,
        'WEB_PROVIDER_ERROR',
      )
    }

    try {
      const payload = await response.json() as SearXNGResponse
      const maxResults = request.maxResults ?? this.options.numResults
      return mapSearXNGResponse(payload, maxResults)
    } catch (error: unknown) {
      if (isAbortError(error)) throw new WebError('SearXNG search aborted', 'WEB_ABORTED', { cause: error })
      throw new WebError(
        `SearXNG returned an unprocessable response: ${String(error)}`,
        'WEB_PROVIDER_ERROR',
        { cause: error },
      )
    }
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
