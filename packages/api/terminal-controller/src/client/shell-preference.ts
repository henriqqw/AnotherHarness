/** Browser-local terminal profile preference; the Host profile list decides whether the saved identity is usable. */
import type { TerminalProfiles } from '../types.ts'

const KEY = 'ah.terminal.profile'

/**
 * Read the browser preference.
 * @returns the last selected profile identity, or null when storage is unavailable.
 */
export function preferredProfile(): string | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY) }
  catch (_storageUnavailable) { return null }
}

/**
 * Remember the selected profile without making storage a startup dependency.
 * @param profileId - profile identity offered by the Host.
 */
export function rememberProfile(profileId: string): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, profileId) }
  catch (_storageUnavailable) { /* Private browsing or quota failure leaves this launch usable. */ }
}

/**
 * Choose the profile a new terminal opens: this browser's last available choice,
 * then the Host default, then the first listed profile.
 * @param listing - the Host profile list.
 * @returns the chosen profile identity, or undefined for an empty list.
 */
export function chooseProfile(listing: TerminalProfiles): string | undefined {
  const previous = preferredProfile()
  const ids = listing.profiles.map(profile => profile.id)
  if (previous !== null && ids.includes(previous)) return previous
  return listing.defaultProfileId ?? ids[0]
}
