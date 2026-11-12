/** Filesystem ownership for the Electron-managed desktop installation. */

import { join } from 'node:path'
import { resolveAhHome } from '@anotherharness/ah-home-paths'

/** Stable desktop installation paths under the shared Harness home. */
export interface DesktopPaths {
  readonly profile: string
  readonly lock: string
}

/**
 * Resolve every Electron-owned path without changing the shared data roots.
 * @param ahHome - Harness home shared with npm-installed ah.
 * @returns immutable desktop path set.
 */
export function resolveDesktopPaths(ahHome: string = resolveAhHome()): DesktopPaths {
  return {
    profile: join(ahHome, 'profiles', 'desktop'),
    lock: join(ahHome, 'profiles', 'desktop', 'lock'),
  }
}
