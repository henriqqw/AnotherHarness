// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { RUNNING_BELL_PATH, RUNNING_TENTACLE_PATHS, RunningJellyfish } from '../src/client/chat/RunningJellyfish.tsx'

afterEach(cleanup)

describe('RunningJellyfish', () => {
  it('AC-4 renders a decorative jellyfish glyph in currentColor without inline styles', () => {
    const view = render(<RunningJellyfish />)
    const icon = view.container.firstElementChild!
    expect(icon.tagName).toBe('SPAN')
    expect(icon.getAttribute('aria-hidden')).toBe('true')
    const svg = icon.querySelector('svg')!
    expect(svg.getAttribute('viewBox')).toBe('0 0 16 16')
    const paths = [...svg.querySelectorAll('path')]
    expect(paths.map(path => path.getAttribute('d'))).toEqual([RUNNING_BELL_PATH, ...RUNNING_TENTACLE_PATHS])
    for (const path of paths) expect(path.getAttribute('stroke')).toBe('currentColor')
    expect(view.container.querySelector('image')).toBeNull()
    expect(view.container.querySelector('[style]')).toBeNull()
  })

  it('AC-4 animates only through CSS that reduced motion and forced colors disable', () => {
    const stylesheet = readFileSync(resolve(import.meta.dirname, '../src/client/chat/ChatView.module.css'), 'utf8')
    expect(stylesheet).toContain('@media (prefers-reduced-motion: no-preference) and (forced-colors: none)')
    expect(stylesheet).toContain('animation: running-bell-pulse')
    expect(stylesheet).toContain('animation: running-tentacle-sway')
    expect(stylesheet).not.toContain('running-whale')
  })
})
