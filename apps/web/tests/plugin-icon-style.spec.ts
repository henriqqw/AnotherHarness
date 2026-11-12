/** Plugin list icons share one drawing style: filled gradient glyphs on the 36-unit grid. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** The six icons redrawn by specs/client/0002 to match the reference plugin icons. */
const REDRAWN = [
  'packages/experimental/tool-worktree/icon.svg',
  'packages/experimental/cot-translation-bundle/icon.svg',
  'packages/experimental/terminal-bundle/icon.svg',
  'packages/experimental/session-search/icon.svg',
  'packages/experimental/session-titles-bundle/icon.svg',
  'packages/experimental/badge-skill-bundle/icon.svg',
] as const

const GLYPH_MIN = 6
const GLYPH_MAX = 30
const MIN_STROKE = 1.8
const GRADIENT_START = ['#67C7FE', '#7AC2FF']
const GRADIENT_END = ['#3F77D8', '#4A65E8']

const read = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8')

function attributes(element: string): Record<string, string> {
  return Object.fromEntries([...element.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1]!, match[2]!]))
}

function shapes(svg: string): { tag: string; attrs: Record<string, string> }[] {
  return [...svg.matchAll(/<(circle|ellipse|rect|path)\b([^>]*)\/?>/g)].map(match => ({ tag: match[1]!, attrs: attributes(match[2]!) }))
}

/**
 * Conservative extent of one shape, including half its stroke width.
 * Path extents use their control points, which bound every Bézier segment.
 */
function extent(tag: string, attrs: Record<string, string>): [number, number, number, number] {
  const half = attrs.stroke !== undefined ? Number(attrs['stroke-width']) / 2 : 0
  const n = (name: string): number => Number(attrs[name])
  switch (tag) {
    case 'circle':
      return [n('cx') - n('r') - half, n('cy') - n('r') - half, n('cx') + n('r') + half, n('cy') + n('r') + half]
    case 'ellipse': {
      // Every ellipse in the set is rotated by ±45°, which spreads both radii equally over x and y.
      expect(attrs.transform).toMatch(/^rotate\(-?45 18 18\)$/)
      const reach = Math.sqrt((n('rx') ** 2 + n('ry') ** 2) / 2) + half
      return [n('cx') - reach, n('cy') - reach, n('cx') + reach, n('cy') + reach]
    }
    case 'rect':
      return [n('x') - half, n('y') - half, n('x') + n('width') + half, n('y') + n('height') + half]
    default: {
      const d = attrs.d!
      // Only absolute commands, so every coordinate is a position on the grid.
      expect(d).toMatch(/^M[MLCHVZ\d.\s-]*$/)
      const xs: number[] = []
      const ys: number[] = []
      let lastX = 0
      let lastY = 0
      for (const command of d.matchAll(/([MLCHVZ])([^MLCHVZ]*)/g)) {
        const args = [...command[2]!.matchAll(/-?\d+(?:\.\d+)?/g)].map(match => Number(match[0]))
        if (command[1] === 'H') {
          for (const x of args) { xs.push(x); ys.push(lastY); lastX = x }
        } else if (command[1] === 'V') {
          for (const y of args) { xs.push(lastX); ys.push(y); lastY = y }
        } else {
          for (let at = 0; at + 1 < args.length; at += 2) {
            lastX = args[at]!
            lastY = args[at + 1]!
            xs.push(lastX)
            ys.push(lastY)
          }
        }
      }
      return [Math.min(...xs) - half, Math.min(...ys) - half, Math.max(...xs) + half, Math.max(...ys) + half]
    }
  }
}

describe.each(REDRAWN)('%s', (path) => {
  const svg = read(path)

  it('AC-1 draws on the 36-unit grid inside the 6–30 glyph box without a root stroke width', () => {
    const root = attributes(/<svg\b([^>]*)>/.exec(svg)![1]!)
    expect(root.viewBox).toBe('0 0 36 36')
    expect(root['stroke-width']).toBeUndefined()
    for (const { tag, attrs } of shapes(svg)) {
      const [minX, minY, maxX, maxY] = extent(tag, attrs)
      expect(Math.min(minX, minY)).toBeGreaterThanOrEqual(GLYPH_MIN)
      expect(Math.max(maxX, maxY)).toBeLessThanOrEqual(GLYPH_MAX)
    }
  })

  it('AC-2 fills its body with the reference blue gradient and keeps every stroke bold', () => {
    const stops = [...svg.matchAll(/<stop\b[^>]*stop-color="([^"]+)"/g)].map(match => match[1]!.toUpperCase())
    expect(stops).toHaveLength(2)
    expect(GRADIENT_START).toContain(stops[0])
    expect(GRADIENT_END).toContain(stops[1])
    const gradientId = /<linearGradient\b[^>]*id="([^"]+)"/.exec(svg)![1]!
    const all = shapes(svg)
    expect(all.some(({ attrs }) => attrs.fill === `url(#${gradientId})`)).toBe(true)
    for (const { attrs } of all) {
      if (attrs.stroke !== undefined) expect(Number(attrs['stroke-width'])).toBeGreaterThanOrEqual(MIN_STROKE)
    }
  })
})

it('AC-2 gives every redrawn icon its own gradient id', () => {
  const ids = REDRAWN.map(path => /<linearGradient\b[^>]*id="([^"]+)"/.exec(read(path))![1])
  expect(new Set(ids).size).toBe(REDRAWN.length)
})
