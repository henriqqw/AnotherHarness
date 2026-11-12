/**
 * Deciding, for one model a gateway listing advertises, whether it accepts
 * images — so model discovery can pre-declare `['text', 'image']` and the
 * Models page offers the image input pre-checked, instead of every gateway
 * vision model arriving text-only and needing a manual toggle.
 *
 * Two sources answer, strongest first. An enriched listing that states its own
 * input modalities (the OpenRouter `architecture.input_modalities` array, a
 * top-level `input_modalities`/`modalities` array, or an `architecture.modality`
 * string such as `"text+image->text"`) is authoritative and never guessed. A
 * bare listing — the plain OpenAI `GET /models` shape reports no modalities —
 * falls to {@link inferImageCapable}, a curated match over well-known vision
 * families. Both only seed the Models page draft the user reviews before saving;
 * nothing here requests anything, and an over-claim an endpoint refuses is
 * refused by the provider mid-turn, exactly as a hand-declared `input` is.
 *
 * @module ah-llm-pi-ai/vision
 */

import type { PiAiModality } from './catalog.ts'

/** Upstream modality spellings that map onto a pi-ai request modality. */
const LISTED_MODALITY_ALIASES: Readonly<Record<string, PiAiModality>> = {
  text: 'text',
  image: 'image',
  images: 'image',
  vision: 'image',
}

/**
 * Curated id/name markers of image-capable model families, matched
 * case-insensitively against the listed id and display name together. Each
 * entry is a family whose vision support is a published fact, not a tunable;
 * the list is a fallback for listings that disclose no modalities, and a miss
 * only leaves the model text-only with the manual toggle still available, so
 * the bias is toward precision over reach.
 */
const IMAGE_CAPABLE_PATTERNS: readonly RegExp[] = [
  // Explicit capability words any provider may stamp on a vision model.
  /\bvision\b/,
  /multimodal/,
  /\bomni\b/,
  // "-vl" / "vl-" vision-language suffixes: Qwen-VL, DeepSeek-VL, Llama-VL, QVQ.
  /(?:^|[^a-z])vl(?:[^a-z]|$)/,
  /\bqvq\b/,
  // Vision-only families whose "vl" is glued into the name or absent entirely.
  /internvl/,
  /pixtral/,
  // GLM vision line: glm-4v, glm-4.1v, glm-4.5v, glm-4v-plus.
  /glm-?\d+(?:\.\d+)?v/,
  // OpenAI multimodal lines: gpt-4o / chatgpt-4o, gpt-4.1, gpt-4-turbo, gpt-4-vision, gpt-5.
  /gpt-4o/,
  /gpt-4\.1/,
  /gpt-4-turbo/,
  /gpt-4-vision/,
  /gpt-5/,
  // Claude 3 and newer are image-capable; Claude 2 and bare unversioned ids are not.
  /claude-(?:[3-9]|opus-[4-9]|sonnet-[4-9]|haiku-[4-9]|fable)/,
  // Gemini 1.5 and 2.x are image-capable; the retired 1.0 "gemini-pro" is not, so it is not matched.
  /gemini-(?:1\.5|2|exp|flash|pro-vision)/,
  // Grok vision and the multimodal Grok 4.
  /grok.*vision/,
  /grok-2-image/,
  /grok-4/,
  // DeepSeek-V4.1-Flash is image-capable per spec 0001; V4-Pro is text-only and is not matched.
  /deepseek-?v4(?:\.1)?-?flash/,
]

/**
 * Whether a listed model id or name names a known image-capable family.
 * @param id - the request id the endpoint accepts.
 * @param name - the display name the endpoint supplied, when any.
 * @returns `true` when a curated vision marker matches either string.
 */
export function inferImageCapable(id: string, name?: string): boolean {
  // Whitespace, underscores, and slashes collapse to the hyphen the patterns
  // expect, so a spaced display name ("Qwen 2 VL") matches like its id.
  const haystack = `${id} ${name ?? ''}`.toLowerCase().replace(/[\s_/]+/g, '-')
  return IMAGE_CAPABLE_PATTERNS.some(pattern => pattern.test(haystack))
}

/** Capability metadata a few enriched gateway listings nest per entry. */
interface ListingArchitecture {
  input_modalities?: unknown
  modality?: unknown
}

/** The modality-bearing fields a model-listing entry may expose. */
export interface ModalityListingEntry {
  architecture?: ListingArchitecture | null
  input_modalities?: unknown
  modalities?: unknown
}

/** Collect the recognized pi-ai modalities named by one upstream value, in `['text', 'image']` order. */
function mapListedModalities(value: unknown): PiAiModality[] | undefined {
  const names: string[] = []
  if (Array.isArray(value)) {
    for (const item of value) if (typeof item === 'string') names.push(item)
  } else if (typeof value === 'string') {
    // An `architecture.modality` string describes a pipeline, e.g.
    // "text+image->text"; only its input half names request modalities.
    const input = value.split('->')[0] ?? value
    for (const token of input.split(/[+,/ ]/)) if (token.length > 0) names.push(token)
  } else {
    return undefined
  }
  const mapped = new Set<PiAiModality>()
  for (const raw of names) {
    const modality = LISTED_MODALITY_ALIASES[raw.trim().toLowerCase()]
    if (modality !== undefined) mapped.add(modality)
  }
  if (mapped.size === 0) return undefined
  return (['text', 'image'] as const).filter(modality => mapped.has(modality))
}

/**
 * The input modalities to record for one discovered model. A listing that
 * states its own modalities wins; otherwise a curated vision family seeds
 * `['text', 'image']`, and an unrecognized bare listing returns `undefined` so
 * the route's default (text) stands and the user may still mark the model.
 * @param entry - the raw listing entry, read only for modality fields.
 * @param id - the model's adopted request id.
 * @param name - the model's display name, when the listing supplied one.
 * @returns the modalities to pre-declare, or `undefined` when unknown.
 */
export function listedInputModalities(
  entry: ModalityListingEntry | null | undefined,
  id: string,
  name?: string,
): PiAiModality[] | undefined {
  const declared = mapListedModalities(entry?.architecture?.input_modalities)
    ?? mapListedModalities(entry?.input_modalities)
    ?? mapListedModalities(entry?.modalities)
    ?? mapListedModalities(entry?.architecture?.modality)
  if (declared !== undefined) return declared
  return inferImageCapable(id, name) ? ['text', 'image'] : undefined
}
