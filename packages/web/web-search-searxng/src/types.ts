/**
 * Wire types for the SearXNG JSON search API (`GET /search?format=json`).
 * SearXNG docs: https://searxng.github.io/searxng/dev/search_api.html
 * @module @anotherharness/ah-web-search-searxng/types
 */

/** One result entry from SearXNG's `results[]`. */
export interface SearXNGResult {
  /** Canonical URL of the result. */
  readonly url: string
  /** Page title. */
  readonly title?: string
  /** Snippet / summary text extracted by the engine. */
  readonly content?: string
  /** ISO-8601 publication date, when available. */
  readonly publishedDate?: string
  /** Thumbnail URL, when available. */
  readonly thumbnail?: string
  /** Engine(s) that returned this result. */
  readonly engine?: string
  /** Relevance score (higher = more relevant). */
  readonly score?: number
}

/** Top-level SearXNG JSON response envelope. */
export interface SearXNGResponse {
  /** Original query. */
  readonly query?: string
  /** Number of results found (may be an estimate). */
  readonly number_of_results?: number
  /** Search results. */
  readonly results?: readonly SearXNGResult[]
  /** Suggested alternative queries. */
  readonly suggestions?: readonly string[]
  /** Direct answers (e.g. from Wolfram Alpha engines). */
  readonly answers?: readonly string[]
  /** Infobox entries (Wikipedia-style summaries). */
  readonly infoboxes?: readonly unknown[]
}
