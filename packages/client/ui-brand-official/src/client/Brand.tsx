import { BrandMark, BrandWordmark } from '@anotherharness/ah-client-ui-primitives'
import type { SidebarBrandMarkOwnerProps } from '@anotherharness/ah-client-ui-sidebar/client'

/**
 * Render the official mark with the presentation requested by its host surface.
 * @param props - Host-supplied mark presentation.
 * @returns the official jellyfish mark.
 */
export function OfficialBrandMark({ size }: SidebarBrandMarkOwnerProps) {
  return <BrandMark size={size} />
}

/**
 * Render the official name artwork without its independently slotted mark.
 * @returns the official "AnotherHarness" wordmark.
 */
export function OfficialBrandName() {
  return <BrandWordmark includeMark={false} size={18} />
}
