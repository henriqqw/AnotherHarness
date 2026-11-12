/**
 * Render every committed AnotherHarness brand asset from one mascot render and the brand font.
 *
 * The owner-supplied source is a raster render of the jellyfish mascot on black
 * (`resources/brand/mascot-on-black.webp`). {@link extractMascot} removes the
 * background that is connected to the image border, so the enclosed dark pupils
 * survive, and un-premultiplies the anti-aliased rim against black. The
 * wordmark is outlined from Plus Jakarta Sans Bold, so no output depends on an
 * installed font.
 *
 * Outputs: Desktop application, macOS and tray icons with their SVG sources,
 * NSIS installer art, the Desktop welcome wordmark, Web favicons and manifest
 * icons, and the generated `ui-primitives` artwork module. Rerun
 * `pnpm run render:brand-assets` in `apps/desktop` after changing the source
 * render or the palette; it also rewrites `resources/tray-windows.ico`.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as fontkit from 'fontkit'
import sharp from 'sharp'
import { packIco, renderTrayIconEntries } from './render-tray-icon.ts'

/** Brand palette from the AnotherHarness brand kit. */
export const BRAND_COLORS = {
  primaryLime: '#B8F34A',
  electricLime: '#D4FF65',
  deepForest: '#183D2B',
  softMint: '#76DDB7',
  warmIvory: '#F1F0E8',
  graphite: '#202124',
  obsidian: '#111214',
  slate: '#777E83',
  /** End stop of the brand kit's primary gradient. */
  gradientGreen: '#3DBE3A',
  /** Darkened gradient green for the wordmark on light surfaces, where lime lacks contrast. */
  leafGreen: '#237A2A',
} as const

const repo = (relative: string): string => fileURLToPath(new URL(`../../../${relative}`, import.meta.url))
const desktop = (relative: string): string => fileURLToPath(new URL(`../${relative}`, import.meta.url))

/** Source render and brand font consumed by the generator. */
export const BRAND_SOURCES = {
  mascot: desktop('resources/brand/mascot-on-black.webp'),
  font: repo('packages/client/ui-theme/src/styles/plus-jakarta-sans-700.woff2'),
} as const

/** Pixels whose brightest channel is at or below this value may belong to the black background. */
const BACKGROUND_CEILING = 60
/** Background pixels at or below this value become fully transparent. */
const TRANSPARENT_CEILING = 25
/** Brightest-channel value treated as fully opaque when un-premultiplying the rim against black. */
const OPAQUE_FLOOR = 150
/** Radius, in source pixels, of the foreground rim that is un-premultiplied. */
const RIM_RADIUS = 3

/**
 * Cut the mascot out of a render on black.
 * @param source - Encoded image (any format sharp reads) of the mascot on a black background.
 * @returns a PNG trimmed to the mascot with a transparent background.
 */
export async function extractMascot(source: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const brightness = (index: number): number => Math.max(data[index * 4]!, data[index * 4 + 1]!, data[index * 4 + 2]!)
  const background = new Uint8Array(width * height)
  const pending: number[] = []
  for (let x = 0; x < width; x++) pending.push(x, (height - 1) * width + x)
  for (let y = 0; y < height; y++) pending.push(y * width, y * width + width - 1)
  while (pending.length > 0) {
    const index = pending.pop()!
    if (background[index] === 1 || brightness(index) > BACKGROUND_CEILING) continue
    background[index] = 1
    const x = index % width
    const y = Math.floor(index / width)
    if (x > 0) pending.push(index - 1)
    if (x < width - 1) pending.push(index + 1)
    if (y > 0) pending.push(index - width)
    if (y < height - 1) pending.push(index + width)
  }
  const nearBackground = (x: number, y: number): boolean => {
    for (let dy = -RIM_RADIUS; dy <= RIM_RADIUS; dy++) {
      for (let dx = -RIM_RADIUS; dx <= RIM_RADIUS; dx++) {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && background[ny * width + nx] === 1) return true
      }
    }
    return false
  }
  const output = Buffer.alloc(width * height * 4)
  for (let index = 0; index < width * height; index++) {
    const value = brightness(index)
    let alpha = 255
    if (background[index] === 1) {
      alpha = value <= TRANSPARENT_CEILING ? 0 : Math.round(Math.min(1, value / OPAQUE_FLOOR) * 255)
    } else if (nearBackground(index % width, Math.floor(index / width))) {
      alpha = Math.round(Math.min(1, value / OPAQUE_FLOOR) * 255)
    }
    const gain = alpha > 0 ? 255 / alpha : 0
    for (let channel = 0; channel < 3; channel++) {
      output[index * 4 + channel] = Math.min(255, Math.round(data[index * 4 + channel]! * gain))
    }
    output[index * 4 + 3] = alpha
  }
  return sharp(output, { raw: { width, height, channels: 4 } }).trim({ threshold: 1 }).png().toBuffer()
}

/** Outlined text: SVG path data in a coordinate space whose origin is the top-left of the em box. */
export interface OutlinedText {
  readonly d: string
  readonly width: number
}

/**
 * Outline one string of a font as SVG path data.
 * @param font - Font that supplies the glyphs.
 * @param text - Text to outline.
 * @param size - Font size in output units.
 * @param x - Left edge of the first glyph's advance.
 * @param baseline - Baseline position in output units.
 * @param tracking - Extra advance after each glyph, in em.
 * @returns the path data and the advance width including tracking.
 */
export function outlineText(font: fontkit.Font, text: string, size: number, x: number, baseline: number, tracking = 0): OutlinedText {
  const scale = size / font.unitsPerEm
  const run = font.layout(text)
  const parts: string[] = []
  let pen = x
  run.glyphs.forEach((glyph, index) => {
    const position = run.positions[index]!
    const path = glyph.path.transform(scale, 0, 0, -scale, pen + position.xOffset * scale, baseline - position.yOffset * scale)
    parts.push(path.toSVG())
    pen += position.xAdvance * scale + tracking * size
  })
  return { d: parts.join(''), width: pen - x }
}

/** The two-tone "AnotherHarness" wordmark outlined at one size. */
export interface Wordmark {
  readonly another: OutlinedText
  readonly harness: OutlinedText
  readonly width: number
  readonly height: number
}

/** Tracking of the wordmark, in em. */
const WORDMARK_TRACKING = -0.02

/**
 * Outline the wordmark with its em box starting at the origin.
 * @param font - Plus Jakarta Sans Bold.
 * @param size - Font size in output units; the result is `size` tall.
 * @returns both halves of the wordmark and the combined advance width.
 */
export function outlineWordmark(font: fontkit.Font, size: number): Wordmark {
  const baseline = size * 0.8
  const another = outlineText(font, 'Another', size, 0, baseline, WORDMARK_TRACKING)
  const harness = outlineText(font, 'Harness', size, another.width, baseline, WORDMARK_TRACKING)
  return { another, harness, width: Math.ceil(another.width + harness.width), height: size }
}

/**
 * Encode a PNG as a data URI.
 * @param png - PNG bytes.
 * @returns the `data:image/png;base64,` URI.
 */
export function pngDataUri(png: Buffer): string {
  return `data:image/png;base64,${png.toString('base64')}`
}

/**
 * Resize the mascot to a height, keeping its aspect ratio.
 * @param mascot - Transparent mascot PNG.
 * @param height - Target height in pixels.
 * @returns the resized PNG with its dimensions.
 */
async function mascotAtHeight(mascot: Buffer, height: number): Promise<{ png: Buffer; width: number; height: number }> {
  const png = await sharp(mascot).resize({ height }).png({ compressionLevel: 9 }).toBuffer()
  const meta = await sharp(png).metadata()
  return { png, width: meta.width, height: meta.height }
}

/** Application tile geometry in the 1104-unit master coordinate space, matching the tray renderer's glyph center. */
const TILE = { x: 40, y: 32, edge: 1024, center: { x: 552, y: 544 } } as const

/** Platform variants of the application icon. */
export type AppIconVariant = 'master' | 'windows' | 'macos'

const APP_ICON_FRAMES: Record<AppIconVariant, { canvas: number; transform: string; radius: number }> = {
  master: { canvas: 1104, transform: '', radius: 0 },
  windows: { canvas: 1024, transform: 'translate(32 32) scale(0.9375) translate(-40 -32)', radius: 192 },
  macos: { canvas: 1024, transform: 'translate(100 100) scale(0.8046875) translate(-40 -32)', radius: 230 },
}

/**
 * Compose the application icon SVG: an Obsidian tile with a lime glow and the mascot in the `tray-glyph` group.
 * @param mascot - Mascot bitmap and its pixel size.
 * @param variant - Platform frame.
 * @returns the SVG document.
 */
export function appIconSvg(mascot: { png: Buffer; width: number; height: number }, variant: AppIconVariant): string {
  const frame = APP_ICON_FRAMES[variant]
  const glyphHeight = 720
  const glyphWidth = glyphHeight * mascot.width / mascot.height
  const glyphX = TILE.center.x - glyphWidth / 2
  const glyphY = TILE.center.y - glyphHeight / 2
  const tile = `<rect x="${String(TILE.x)}" y="${String(TILE.y)}" width="${String(TILE.edge)}" height="${String(TILE.edge)}" rx="${String(frame.radius)}"`
  const body = [
    `${tile} fill="url(#tile)"/>`,
    `${tile} fill="url(#glow)"/>`,
    `<g id="tray-glyph"><image x="${glyphX.toFixed(2)}" y="${glyphY.toFixed(2)}" width="${glyphWidth.toFixed(2)}" height="${String(glyphHeight)}" href="${pngDataUri(mascot.png)}"/></g>`,
  ].join('\n')
  return [
    `<svg width="${String(frame.canvas)}" height="${String(frame.canvas)}" viewBox="0 0 ${String(frame.canvas)} ${String(frame.canvas)}" fill="none" xmlns="http://www.w3.org/2000/svg">`,
    '<defs>',
    `<linearGradient id="tile" x1="552" y1="32" x2="552" y2="1056" gradientUnits="userSpaceOnUse"><stop stop-color="${BRAND_COLORS.graphite}"/><stop offset="1" stop-color="${BRAND_COLORS.obsidian}"/></linearGradient>`,
    `<radialGradient id="glow" cx="552" cy="520" r="460" gradientUnits="userSpaceOnUse"><stop stop-color="${BRAND_COLORS.primaryLime}" stop-opacity="0.22"/><stop offset="1" stop-color="${BRAND_COLORS.primaryLime}" stop-opacity="0"/></radialGradient>`,
    '</defs>',
    frame.transform === '' ? body : `<g transform="${frame.transform}">\n${body}\n</g>`,
    '</svg>',
    '',
  ].join('\n')
}

/** Wordmark colors per surface. */
export const WORDMARK_COLORS = {
  light: { another: BRAND_COLORS.obsidian, harness: BRAND_COLORS.leafGreen },
  dark: { another: BRAND_COLORS.warmIvory, harness: BRAND_COLORS.primaryLime },
} as const

/**
 * Compose the Desktop welcome brand line: mascot plus wordmark, recolored by `prefers-color-scheme`.
 * @param mascot - Mascot bitmap and its pixel size.
 * @param wordmark - Wordmark outlined at 26 units.
 * @returns the 472 × 40 SVG document.
 */
export function welcomeBrandSvg(mascot: { png: Buffer; width: number; height: number }, wordmark: Wordmark): string {
  const markHeight = 40
  const markWidth = markHeight * mascot.width / mascot.height
  const gap = 12
  const total = markWidth + gap + wordmark.width
  const left = (472 - total) / 2
  const top = (40 - wordmark.height) / 2
  return [
    '<svg width="472" height="40" viewBox="0 0 472 40" fill="none" xmlns="http://www.w3.org/2000/svg">',
    '<style>',
    `  .another { fill: ${WORDMARK_COLORS.light.another}; }`,
    `  .harness { fill: ${WORDMARK_COLORS.light.harness}; }`,
    '  @media (prefers-color-scheme: dark) {',
    `    .another { fill: ${WORDMARK_COLORS.dark.another}; }`,
    `    .harness { fill: ${WORDMARK_COLORS.dark.harness}; }`,
    '  }',
    '</style>',
    `<image x="${left.toFixed(2)}" y="0" width="${markWidth.toFixed(2)}" height="${String(markHeight)}" href="${pngDataUri(mascot.png)}"/>`,
    `<g transform="translate(${(left + markWidth + gap).toFixed(2)} ${top.toFixed(2)})">`,
    `<path class="another" d="${wordmark.another.d}"/>`,
    `<path class="harness" d="${wordmark.harness.d}"/>`,
    '</g>',
    '</svg>',
    '',
  ].join('\n')
}

/**
 * Compose installer brand art: the application tile above the wordmark.
 * @param iconPng - Rendered Windows application icon.
 * @param wordmark - Wordmark outlined at 30 units.
 * @param theme - Installer page theme.
 * @returns the 600 × 196 SVG document.
 */
export function installerBrandSvg(iconPng: Buffer, wordmark: Wordmark, theme: 'light' | 'dark'): string {
  const colors = WORDMARK_COLORS[theme]
  const icon = 132
  const left = (600 - wordmark.width) / 2
  return [
    '<svg width="600" height="196" viewBox="0 0 600 196" fill="none" xmlns="http://www.w3.org/2000/svg">',
    `<image x="${String((600 - icon) / 2)}" y="4" width="${String(icon)}" height="${String(icon)}" href="${pngDataUri(iconPng)}"/>`,
    `<g transform="translate(${left.toFixed(2)} 148)">`,
    `<path fill="${colors.another}" d="${wordmark.another.d}"/>`,
    `<path fill="${colors.harness}" d="${wordmark.harness.d}"/>`,
    '</g>',
    '</svg>',
    '',
  ].join('\n')
}

/**
 * Compose a square favicon SVG around an embedded mascot bitmap.
 * @param mascot - Mascot bitmap and its pixel size.
 * @returns the 64 × 64 SVG document.
 */
export function faviconSvg(mascot: { png: Buffer; width: number; height: number }): string {
  const height = 64
  const width = height * mascot.width / mascot.height
  return [
    '<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">',
    `<image x="${((64 - width) / 2).toFixed(2)}" y="0" width="${width.toFixed(2)}" height="${String(height)}" href="${pngDataUri(mascot.png)}"/>`,
    '</svg>',
    '',
  ].join('\n')
}

/**
 * Generate the TypeScript module that `ui-primitives` renders the brand mark and wordmark from.
 * @param mascot - Mascot bitmap and its pixel size.
 * @param wordmark - Wordmark outlined at 24 units.
 * @returns module source.
 */
export function brandArtworkModule(mascot: { png: Buffer; width: number; height: number }, wordmark: Wordmark): string {
  return [
    '/**',
    ' * AnotherHarness brand artwork rendered by `BrandMark` and `BrandWordmark`.',
    ' *',
    ' * Generated by `apps/desktop/scripts/render-brand-assets.ts`; rerun',
    ' * `pnpm run render:brand-assets` in `apps/desktop` instead of editing this file.',
    ' */',
    '',
    '/** Transparent PNG of the jellyfish mascot as a data URI. */',
    `export const BRAND_MARK_IMAGE = '${pngDataUri(mascot.png)}'`,
    '',
    '/** Pixel width of {@link BRAND_MARK_IMAGE}. */',
    `export const BRAND_MARK_WIDTH = ${String(mascot.width)}`,
    '',
    '/** Pixel height of {@link BRAND_MARK_IMAGE}. */',
    `export const BRAND_MARK_HEIGHT = ${String(mascot.height)}`,
    '',
    '/** SVG viewBox of the outlined wordmark. */',
    `export const WORDMARK_VIEWBOX = '0 0 ${String(wordmark.width)} ${String(wordmark.height)}'`,
    '',
    '/** Path data of the "Another" half of the wordmark. */',
    `export const WORDMARK_ANOTHER_PATH = '${wordmark.another.d}'`,
    '',
    '/** Path data of the "Harness" half of the wordmark. */',
    `export const WORDMARK_HARNESS_PATH = '${wordmark.harness.d}'`,
    '',
  ].join('\n')
}

/** Every file the generator writes, relative to the repository root. */
export const BRAND_OUTPUTS = {
  mascot: 'apps/desktop/resources/brand/mascot.png',
  iconMasterSvg: 'apps/desktop/resources/icon.svg',
  iconMasterPng: 'apps/desktop/resources/icon.png',
  iconWindowsSvg: 'apps/desktop/resources/icon-windows.svg',
  iconWindowsPng: 'apps/desktop/resources/icon-windows.png',
  iconMacosSvg: 'apps/desktop/resources/icon-macos.svg',
  iconMacosPng: 'apps/desktop/resources/icon-macos.png',
  tray: 'apps/desktop/resources/tray-windows.ico',
  installerLight: 'apps/desktop/installer/assets/brand.png',
  installerLight2x: 'apps/desktop/installer/assets/brand-2x.png',
  installerDark: 'apps/desktop/installer/assets/brand-dark.png',
  installerDark2x: 'apps/desktop/installer/assets/brand-dark-2x.png',
  uninstallerSidebar: 'apps/desktop/installer/assets/uninstaller-sidebar.png',
  welcomeBrand: 'apps/desktop/renderer/assets/welcome-brand.svg',
  favicon: 'apps/web/public/favicon.svg',
  faviconDark: 'apps/web/public/favicon-dark.svg',
  faviconIco: 'apps/web/public/favicon.ico',
  appleTouchIcon: 'apps/web/public/apple-touch-icon.png',
  manifestIcon192: 'apps/web/public/icon-192.png',
  manifestIcon512: 'apps/web/public/icon-512.png',
  artworkModule: 'packages/client/ui-primitives/src/brand-artwork.ts',
} as const

async function write(relative: string, content: string | Buffer): Promise<void> {
  const path = repo(relative)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

async function svgToPng(svg: string, width: number, height = width): Promise<Buffer> {
  return sharp(Buffer.from(svg)).resize(width, height).png({ compressionLevel: 9 }).toBuffer()
}

async function main(): Promise<void> {
  const mascot = await extractMascot(await readFile(BRAND_SOURCES.mascot))
  const opened = fontkit.create(await readFile(BRAND_SOURCES.font))
  if (!('layout' in opened)) throw new Error('brand assets: the brand font is a collection, expected one face')
  const font = opened
  await write(BRAND_OUTPUTS.mascot, mascot)

  const iconMascot = await mascotAtHeight(mascot, 640)
  const iconSvgs = {
    master: appIconSvg(iconMascot, 'master'),
    windows: appIconSvg(iconMascot, 'windows'),
    macos: appIconSvg(iconMascot, 'macos'),
  }
  await write(BRAND_OUTPUTS.iconMasterSvg, iconSvgs.master)
  await write(BRAND_OUTPUTS.iconWindowsSvg, iconSvgs.windows)
  await write(BRAND_OUTPUTS.iconMacosSvg, iconSvgs.macos)
  const windowsPng = await svgToPng(iconSvgs.windows, 1024)
  await write(BRAND_OUTPUTS.iconMasterPng, await svgToPng(iconSvgs.master, 1104))
  await write(BRAND_OUTPUTS.iconWindowsPng, windowsPng)
  await write(BRAND_OUTPUTS.iconMacosPng, await svgToPng(iconSvgs.macos, 1024))
  await write(BRAND_OUTPUTS.tray, packIco(await renderTrayIconEntries(Buffer.from(iconSvgs.windows))))

  const installerWordmark = outlineWordmark(font, 30)
  for (const [theme, single, double] of [
    ['light', BRAND_OUTPUTS.installerLight, BRAND_OUTPUTS.installerLight2x],
    ['dark', BRAND_OUTPUTS.installerDark, BRAND_OUTPUTS.installerDark2x],
  ] as const) {
    const svg = installerBrandSvg(windowsPng, installerWordmark, theme)
    await write(single, await svgToPng(svg, 600, 196))
    await write(double, await svgToPng(svg, 1200, 392))
  }
  const sidebarIcon = await sharp(windowsPng).resize(132, 132).png().toBuffer()
  await write(BRAND_OUTPUTS.uninstallerSidebar, await sharp({ create: { width: 164, height: 314, channels: 3, background: '#F7F7F5' } })
    .composite([{ input: sidebarIcon, left: 16, top: 91 }])
    .png({ compressionLevel: 9 })
    .toBuffer())

  await write(BRAND_OUTPUTS.welcomeBrand, welcomeBrandSvg(await mascotAtHeight(mascot, 120), outlineWordmark(font, 26)))

  const faviconMascot = await mascotAtHeight(mascot, 128)
  const favicon = faviconSvg(faviconMascot)
  await write(BRAND_OUTPUTS.favicon, favicon)
  await write(BRAND_OUTPUTS.faviconDark, favicon)
  const faviconEntries = await Promise.all([16, 32, 48].map(async size => ({ size, png: await svgToPng(favicon, size) })))
  await write(BRAND_OUTPUTS.faviconIco, packIco(faviconEntries))
  const fullBleed = appIconSvg(iconMascot, 'master').replace('viewBox="0 0 1104 1104"', `viewBox="${String(TILE.x)} ${String(TILE.y)} ${String(TILE.edge)} ${String(TILE.edge)}"`)
  await write(BRAND_OUTPUTS.appleTouchIcon, await svgToPng(fullBleed, 180))
  await write(BRAND_OUTPUTS.manifestIcon192, await svgToPng(iconSvgs.windows, 192))
  await write(BRAND_OUTPUTS.manifestIcon512, await svgToPng(iconSvgs.windows, 512))

  await write(BRAND_OUTPUTS.artworkModule, brandArtworkModule(await mascotAtHeight(mascot, 128), outlineWordmark(font, 24)))
  console.info(`brand assets: wrote ${String(Object.keys(BRAND_OUTPUTS).length)} files`)
}

if (process.argv[1] !== undefined && import.meta.filename === resolve(process.argv[1])) await main()
