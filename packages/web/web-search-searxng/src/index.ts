/**
 * SearXNG-backed `WebSearchProvider` plugin. Connects to a self-hosted SearXNG
 * instance and registers it on `ctx.web`. No API key required.
 *
 * Quick start:
 * ```yaml
 * - name: '@anotherharness/ah-web'
 * - name: '@anotherharness/ah-web-search-searxng'
 *   config:
 *     baseURL: http://127.0.0.1:8888   # default; omit if SearXNG runs there
 * ```
 *
 * Run SearXNG with Docker (once):
 * ```
 * docker compose -f docker/searxng.yml up -d
 * ```
 *
 * @module @anotherharness/ah-web-search-searxng
 */

import type { Context } from '@anotherharness/cordis'
import { launchEnvironmentOf } from '@anotherharness/ah-launch-environment'
import z from '@anotherharness/schemastery'
import type {} from '@anotherharness/ah-web'
import {
  SearXNGSearchProvider,
  SEARXNG_DEFAULT_BASE_URL,
  SEARXNG_DEFAULT_CATEGORIES,
  SEARXNG_DEFAULT_LANGUAGE,
} from './provider.ts'

export {
  SEARXNG_DEFAULT_BASE_URL,
  SEARXNG_DEFAULT_CATEGORIES,
  SEARXNG_DEFAULT_LANGUAGE,
  SEARXNG_PROVIDER_ID,
  SearXNGSearchProvider,
} from './provider.ts'
export type { SearXNGSearchProviderOptions } from './provider.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'web-search-searxng'

/** The web seam this provider registers into. */
export const inject = ['web']

/** Plugin config (all optional — defaults work with the bundled docker-compose). */
export interface Config {
  /**
   * SearXNG instance base URL.
   * Falls back to `$SEARXNG_BASE_URL` env var, then `http://127.0.0.1:8888`.
   */
  baseURL?: string
  /**
   * Comma-separated SearXNG categories.
   * Falls back to `$SEARXNG_CATEGORIES` env var, then `general`.
   * Use `general,it,science` for broader technical coverage.
   */
  categories?: string
  /**
   * SearXNG language. Falls back to `$SEARXNG_LANGUAGE` env var, then `all`.
   * Example: `en`, `pt`, `all`.
   */
  language?: string
  /**
   * Default result count when a request carries no `maxResults`.
   * Omitted = no default (SearXNG returns however many engines produce).
   */
  numResults?: number
}

export const Config: z<Config> = z.object({
  baseURL: z.string(),
  categories: z.string(),
  language: z.string(),
  numResults: z.number().step(1).min(1),
})

/** Register the SearXNG search provider with `ctx.web`. */
export function apply(ctx: Context, config: Config): void {
  const env = launchEnvironmentOf(ctx)
  ctx.web.registerSearchProvider(new SearXNGSearchProvider({
    baseURL: config.baseURL
      ?? env.get('SEARXNG_BASE_URL')?.value
      ?? SEARXNG_DEFAULT_BASE_URL,
    categories: config.categories
      ?? env.get('SEARXNG_CATEGORIES')?.value
      ?? SEARXNG_DEFAULT_CATEGORIES,
    language: config.language
      ?? env.get('SEARXNG_LANGUAGE')?.value
      ?? SEARXNG_DEFAULT_LANGUAGE,
    ...config.numResults !== undefined ? { numResults: config.numResults } : {},
  }))
}
