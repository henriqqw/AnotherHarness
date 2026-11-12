/** The design-platform sheet maps the AnotherHarness palette onto the brand aliases with readable contrast. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sheet = readFileSync(new URL('../src/styles/design-platform.css', import.meta.url), 'utf8')

/**
 * Collect the custom properties declared by each top-level rule for one selector, in source order.
 * @param selector - Exact rule selector.
 * @returns one declaration map per matching rule.
 */
function declarations(selector: string): Map<string, string>[] {
  const rules: Map<string, string>[] = []
  const pattern = new RegExp(`^${selector.replace(/[[\]]/g, '\\$&')} \\{\\n([\\s\\S]*?)\\n\\}`, 'gm')
  for (const match of sheet.matchAll(pattern)) {
    const map = new Map<string, string>()
    for (const line of match[1]!.split('\n')) {
      const declaration = /^\s*(--[\w-]+):\s*(.+);$/.exec(line)
      if (declaration) map.set(declaration[1]!, declaration[2]!)
    }
    rules.push(map)
  }
  return rules
}

const [lightStatic, lightAlias] = declarations('body')
const [darkStatic, darkAlias] = declarations('body[data-ds-dark-theme]')
const light = new Map([...lightStatic!, ...lightAlias!])
// The dark rules match `body` too, so they layer over the light declarations.
const dark = new Map([...light, ...darkStatic!, ...darkAlias!])

/**
 * Resolve a custom property to an sRGB triple through `var()` references.
 * @param theme - Declarations in effect.
 * @param name - Custom property name.
 * @returns the red, green and blue channels.
 */
function resolve(theme: Map<string, string>, name: string): [number, number, number] {
  const value = theme.get(name)
  if (value === undefined) throw new Error(`${name} is not declared`)
  const reference = /^var\((--[\w-]+)\)$/.exec(value)
  if (reference) return resolve(theme, reference[1]!)
  const rgb = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(value)
  if (!rgb) throw new Error(`${name} is not an opaque rgb() color: ${value}`)
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
}

function hex(color: [number, number, number]): string {
  return `#${color.map(channel => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

function luminance(color: [number, number, number]): number {
  const [r, g, b] = color.map((channel) => {
    const value = channel / 255
    return value <= 0.039_28 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(theme: Map<string, string>, foreground: string, background: string): number {
  const levels = [luminance(resolve(theme, foreground)), luminance(resolve(theme, background))]
  const [high, low] = levels.sort((a, b) => b - a) as [number, number]
  return (high + 0.05) / (low + 0.05)
}

describe('brand palette', () => {
  it('AC-5 fills dark-mode primary actions with Primary Lime on the dark page that the boot paint matches', () => {
    expect(hex(resolve(dark, '--dsw-alias-button-primary-fill'))).toBe('#B8F34A')
    expect(hex(resolve(dark, '--dsw-alias-bg-base'))).toBe('#121311')
    expect(hex(resolve(dark, '--dsw-alias-bg-layer-1'))).toBe('#1A1B19')
    const boot = readFileSync(new URL('../src/boot-theme.ts', import.meta.url), 'utf8')
    expect(boot.toUpperCase()).toContain(`DARK_BACKGROUND = '${hex(resolve(dark, '--dsw-alias-bg-base'))}'`)
  })

  it('AC-6 uses Deep Forest primary actions and a dark leaf-green link on the ivory light-mode page', () => {
    expect(hex(resolve(light, '--dsw-alias-button-primary-fill'))).toBe('#183D2B')
    expect(hex(resolve(light, '--dsw-alias-link'))).toBe('#237A2A')
    expect(hex(resolve(light, '--dsw-alias-bg-base'))).toBe('#F1F0E8')
  })

  it.each([
    ['light', light, '--dsw-alias-label-primary-foreground', '--dsw-alias-button-primary-fill'],
    ['light', light, '--dsw-alias-link', '--dsw-alias-bg-base'],
    ['light', light, '--dsw-alias-brand-accent-text', '--dsw-alias-bg-base'],
    ['light', light, '--dsw-alias-label-primary', '--dsw-specific-bubble'],
    ['dark', dark, '--dsw-alias-label-primary-foreground', '--dsw-alias-button-primary-fill'],
    ['dark', dark, '--dsw-alias-link', '--dsw-alias-bg-base'],
    ['dark', dark, '--dsw-alias-brand-accent-text', '--dsw-alias-bg-base'],
    ['dark', dark, '--dsw-alias-label-primary', '--dsw-alias-bg-base'],
  ] as const)('AC-6 keeps %s %s on %s at WCAG AA contrast', (_mode, theme, foreground, background) => {
    expect(contrast(theme, foreground, background)).toBeGreaterThanOrEqual(4.5)
  })

  it('AC-6 never uses lime as light-mode text', () => {
    const lime = resolve(light, '--dsw-static-brand-lime')
    for (const name of ['--dsw-alias-link', '--dsw-alias-brand-text', '--dsw-alias-brand-accent-text', '--dsw-alias-label-primary']) {
      expect(resolve(light, name)).not.toEqual(lime)
    }
  })
})

describe('Field Notes materials', () => {
  it('AC-1 warms every intermediate neutral step', () => {
    const steps = [...light.keys()].filter(name => /^--dsw-static-neutral-bluish-\d+$/.test(name))
      .filter(name => !name.endsWith('-00') && !name.endsWith('-1000'))
    expect(steps.length).toBeGreaterThan(15)
    for (const theme of [light, dark]) {
      for (const name of steps) {
        const [r, g, b] = resolve(theme, name)
        expect(r, name).toBeGreaterThanOrEqual(b)
        expect(g, name).toBeGreaterThanOrEqual(b)
      }
    }
  })

  it('AC-2 paints the dark olive-black and light ivory materials that the boot paint matches', () => {
    expect(hex(resolve(dark, '--dsw-alias-bg-base'))).toBe('#121311')
    expect(hex(resolve(dark, '--dsw-specific-sidebar-fill'))).toBe('#0E0F0D')
    expect(hex(resolve(dark, '--dsw-alias-bg-rail'))).toBe('#0E0F0D')
    expect(hex(resolve(dark, '--dsw-alias-bg-layer-1'))).toBe('#1A1B19')
    expect(hex(resolve(light, '--dsw-alias-bg-base'))).toBe('#F1F0E8')
    expect(hex(resolve(light, '--dsw-alias-bg-layer-1'))).toBe('#FAF9F3')
    expect(hex(resolve(light, '--dsw-alias-bg-rail'))).toBe('#E8E7DD')
    expect(hex(resolve(dark, '--dsw-alias-brand-marker'))).toBe('#B8F34A')
    expect(hex(resolve(light, '--dsw-alias-brand-marker'))).toBe('#3DBE3A')
    const boot = readFileSync(new URL('../src/boot-theme.ts', import.meta.url), 'utf8')
    expect(boot).toContain("LIGHT_BACKGROUND = '#F1F0E8'")
    expect(boot).toContain("DARK_BACKGROUND = '#121311'")
  })

  it.each([
    ['light', light, '--dsw-alias-label-primary', 4.5],
    ['light', light, '--dsw-alias-label-secondary', 4.5],
    ['light', light, '--dsw-alias-label-tertiary', 3],
    ['dark', dark, '--dsw-alias-label-primary', 4.5],
    ['dark', dark, '--dsw-alias-label-secondary', 4.5],
    ['dark', dark, '--dsw-alias-label-tertiary', 3],
  ] as const)('AC-3 keeps %s %s readable on the page', (_mode, theme, label, minimum) => {
    expect(contrast(theme, label, '--dsw-alias-bg-base')).toBeGreaterThanOrEqual(minimum)
  })
})
