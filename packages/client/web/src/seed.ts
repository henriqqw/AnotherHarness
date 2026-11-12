/**
 * Platform-singleton module-table. These are the ONLY entities the shell
 * shares into the frozen module table — fetch bundles resolve their externals
 * against exactly this set through the loader's require. Keys come from the
 * platform constant module ({@link ./platform.ts}, the single source
 * of truth with the tsdown client externals); values stay shell-static
 * imports so every bundle sees the same instance.
 */
import * as React from 'react'
import * as ReactJsxRuntime from 'react/jsx-runtime'
import * as ReactDom from 'react-dom'
import * as ReactDomClient from 'react-dom/client'
import * as Cordis from '@anotherharness/cordis'
import * as ClientStore from '@anotherharness/ah-client-store'
import * as UiSlots from '@anotherharness/ah-client-ui-slots'
import * as UiPrimitives from '@anotherharness/ah-client-ui-primitives'
import * as UiDockkit from '@anotherharness/ah-client-ui-dockkit'
import type { PlatformModule } from './platform.ts'

/**
 * Build the static table handed to the module loader at boot.
 * @returns module specifier → exported entity (one entry per platform word).
 */
export function getStaticModules(): Record<string, unknown> {
  // The satisfies pin is the projection contract: a word added to
  // PLATFORM_MODULES without a static import here (or vice versa) fails to
  // compile instead of drifting into a runtime require miss.
  return {
    'react': React,
    'react/jsx-runtime': ReactJsxRuntime,
    'react-dom': ReactDom,
    'react-dom/client': ReactDomClient,
    '@anotherharness/cordis': Cordis,
    '@anotherharness/ah-client-store': ClientStore,
    '@anotherharness/ah-client-ui-slots': UiSlots,
    '@anotherharness/ah-client-ui-primitives': UiPrimitives,
    '@anotherharness/ah-client-ui-dockkit': UiDockkit,
  } satisfies Record<PlatformModule, unknown>
}
