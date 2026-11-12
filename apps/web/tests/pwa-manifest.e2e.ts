import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const DIST_ROOT = fileURLToPath(new URL('../dist', import.meta.url))

it('AC-1 ships install metadata with jellyfish icons in the built web application', async () => {
  const index = await readFile(join(DIST_ROOT, 'index.html'), 'utf8')
  expect(index).toContain('<link rel="manifest" href="./manifest.webmanifest" />')

  const manifest: unknown = JSON.parse(await readFile(join(DIST_ROOT, 'manifest.webmanifest'), 'utf8'))
  // No `id`: a browser resolves an explicit `id` against the start URL's origin,
  // so only an absent `id`, which defaults to the resolved `start_url`, gives
  // each mount its own identity. `public-mount.e2e.ts` reads the resolved form.
  expect(manifest).toEqual({
    name: 'AnotherHarness',
    short_name: 'AH',
    start_url: './',
    scope: './',
    display: 'fullscreen',
    background_color: '#111214',
    theme_color: '#111214',
    icons: [
      { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  })
  for (const [name, edge] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]] as const) {
    const png = await readFile(join(DIST_ROOT, name))
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([edge, edge])
  }
  expect(index).toContain('<link rel="apple-touch-icon" href="./apple-touch-icon.png" />')
})

it('AC-1 ships jellyfish favicons selected by document media queries', async () => {
  const index = await readFile(join(DIST_ROOT, 'index.html'), 'utf8')
  expect(index).toContain('<link rel="icon" type="image/svg+xml" href="./favicon-dark.svg" media="(prefers-color-scheme: dark)" />')
  expect(index).toContain('<link rel="icon" type="image/svg+xml" href="./favicon.svg" media="(prefers-color-scheme: light)" />')
  const light = await readFile(join(DIST_ROOT, 'favicon.svg'), 'utf8')
  const dark = await readFile(join(DIST_ROOT, 'favicon-dark.svg'), 'utf8')
  expect(light).toContain('href="data:image/png;base64,')
  expect(light).not.toContain('<path')
  expect(dark).toBe(light)
  const ico = await readFile(join(DIST_ROOT, 'favicon.ico'))
  expect([ico.readUInt16LE(2), ico.readUInt16LE(4)]).toEqual([1, 3])
})
