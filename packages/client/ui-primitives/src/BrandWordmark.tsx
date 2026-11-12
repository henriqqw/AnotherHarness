import {
  BRAND_MARK_HEIGHT,
  BRAND_MARK_IMAGE,
  BRAND_MARK_WIDTH,
  WORDMARK_ANOTHER_PATH,
  WORDMARK_HARNESS_PATH,
  WORDMARK_VIEWBOX,
} from './brand-artwork.ts'
import type { IconProps } from './icons/props.ts'

/** Display options for the AnotherHarness wordmark. */
export interface BrandWordmarkProps extends IconProps {
  /** Whether to include the leading jellyfish mark; defaults to true. */
  includeMark?: boolean | undefined
}

/** Height, in wordmark units, that the artwork module outlines the wordmark at. */
const WORDMARK_HEIGHT = 24
/** Space between the mark and the name, in wordmark units. */
const MARK_GAP = 6
const WORDMARK_WIDTH = Number(WORDMARK_VIEWBOX.split(' ')[2])
const MARK_WIDTH = (WORDMARK_HEIGHT * BRAND_MARK_WIDTH) / BRAND_MARK_HEIGHT

/**
 * Render the two-tone "AnotherHarness" wordmark.
 *
 * "Another" uses `currentColor`; "Harness" uses `--dsw-alias-brand-accent-text`,
 * which the theme sets per light and dark mode.
 * @param props.size - height in px (default 24; width follows the selected artwork).
 * @param props.className - extra class for layout placement.
 * @param props.includeMark - whether to include the leading jellyfish mark.
 * @returns the wordmark svg (aria-hidden decorative brand art).
 */
export function BrandWordmark({ size = 24, className, includeMark = true }: BrandWordmarkProps) {
  const offset = includeMark ? MARK_WIDTH + MARK_GAP : 0
  const width = offset + WORDMARK_WIDTH
  return (
    <svg
      width={(size * width) / WORDMARK_HEIGHT}
      height={size}
      className={className}
      viewBox={`0 0 ${width.toFixed(2)} ${String(WORDMARK_HEIGHT)}`}
      fill="none"
      aria-hidden="true"
    >
      {includeMark && <image href={BRAND_MARK_IMAGE} width={MARK_WIDTH} height={WORDMARK_HEIGHT} />}
      <g transform={`translate(${offset.toFixed(2)} 0)`}>
        <path d={WORDMARK_ANOTHER_PATH} fill="currentColor" />
        <path d={WORDMARK_HARNESS_PATH} fill="var(--dsw-alias-brand-accent-text)" />
      </g>
    </svg>
  )
}
