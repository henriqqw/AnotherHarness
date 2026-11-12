/** The brand font remains self-contained in the packaged Web application. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const WOFF2_SIGNATURE = 0x774f4632
const BRAND_WEIGHTS = [300, 400, 500, 600, 700, 800] as const

describe('offline brand font', () => {
  it('AC-7 ships local Plus Jakarta Sans WOFF2 faces with their redistribution license', () => {
    const css = readFileSync(new URL('../src/styles/brand-font.css', import.meta.url), 'utf8')
    expect(css).toContain("font-family: 'Plus Jakarta Sans'")
    expect(css).toContain('font-style: normal')
    expect(css).not.toMatch(/url\(https?:/)
    expect(css).not.toContain('Montserrat')
    for (const weight of BRAND_WEIGHTS) {
      expect(css).toContain(`font-weight: ${String(weight)}`)
      expect(css).toContain(`url(./plus-jakarta-sans-${String(weight)}.woff2)`)
      const font = readFileSync(new URL(`../src/styles/plus-jakarta-sans-${String(weight)}.woff2`, import.meta.url))
      expect(font.readUInt32BE(0)).toBe(WOFF2_SIGNATURE)
    }
    const license = readFileSync(new URL('../src/styles/PlusJakartaSans-OFL.txt', import.meta.url), 'utf8')
    expect(license).toContain('SIL Open Font License, Version 1.1')
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      files: string[]
      exports: Record<string, unknown>
    }
    expect(manifest.files).toContain('lib/styles')
    expect(manifest.exports['./brand-font.css']).toBe('./lib/styles/brand-font.css')
  })

  it('AC-7 selects Plus Jakarta Sans as the brand font family', () => {
    const base = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8')
    expect(base).toMatch(/--dsw-font-family-brand: 'Plus Jakarta Sans',/)
  })
})

describe('UI text font', () => {
  it('AC-4 leads the default text stack with Plus Jakarta Sans and keeps CJK and user fonts', () => {
    const base = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8')
    const stack = /--ah-font-family-text-default: ([^;]+);/.exec(base)![1]!.replace(/\s+/g, ' ')
    expect(stack.startsWith("'Plus Jakarta Sans',")).toBe(true)
    expect(stack).toContain("'PingFang SC'")
    expect(stack).toContain("'Microsoft YaHei'")
    expect(base).toContain('--dsw-font-family: var(--ah-font-family-text, var(--ah-font-family-text-default))')
  })
})
