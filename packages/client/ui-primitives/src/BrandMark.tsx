import { BRAND_MARK_HEIGHT, BRAND_MARK_IMAGE, BRAND_MARK_WIDTH } from './brand-artwork.ts'
import type { IconProps } from './icons/props.ts'

/** Width-to-height ratio of the jellyfish mascot artwork. */
export const BRAND_MARK_ASPECT = BRAND_MARK_WIDTH / BRAND_MARK_HEIGHT

/**
 * Render the AnotherHarness jellyfish mascot.
 * @param props.size - height in px (default 24; width keeps the artwork ratio).
 * @param props.className - extra class for layout placement.
 * @returns the mascot svg (aria-hidden; pair it with the product name for accessibility).
 */
export function BrandMark({ size = 24, className }: IconProps) {
  const width = size * BRAND_MARK_ASPECT
  return (
    <svg
      width={width}
      height={size}
      className={className}
      viewBox={`0 0 ${String(BRAND_MARK_WIDTH)} ${String(BRAND_MARK_HEIGHT)}`}
      fill="none"
      aria-hidden="true"
    >
      <image href={BRAND_MARK_IMAGE} width={BRAND_MARK_WIDTH} height={BRAND_MARK_HEIGHT} />
    </svg>
  )
}
