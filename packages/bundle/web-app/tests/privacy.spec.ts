/** Spec 0002: the shipped Web application mounts no telemetry, analytics, or Session-log upload. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadOverlayPatches } from '@anotherharness/ah-app-boot'
import { expect, it } from 'vitest'

it('ships no product telemetry, product analytics, or Session-log upload rows', () => {
  const patches = loadOverlayPatches('privacy', fileURLToPath(new URL('../cordis.patch.yml', import.meta.url)))
  const ids = patches.flatMap(patch => patch.insert ?? []).map(row => row.id)
  for (const id of ['desktop-product-telemetry', 'product-analytics', 'ui-settings-session-log']) expect(ids).not.toContain(id)
  const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')) as { dependencies?: Record<string, string> }
  for (const dependency of [
    '@anotherharness/ah-host-product-telemetry-otel',
    '@anotherharness/ah-client-product-analytics',
    '@anotherharness/ah-client-ui-settings-session-log',
  ]) expect(manifest.dependencies ?? {}).not.toHaveProperty(dependency)
})
