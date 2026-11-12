/** The "Field Notes" restyle (specs/client/0003) keeps its marker, ink selection and effect-free rules. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string): string => readFileSync(new URL(`../../../packages/client/${path}`, import.meta.url), 'utf8')

/**
 * Return the declarations of the first rule whose selector list is exactly `selector`.
 * @param css - Stylesheet source.
 * @param selector - Selector text as written before `{`.
 * @returns the declaration block body.
 */
function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(?:^|\\n)${escaped} \\{\\n([\\s\\S]*?)\\n\\}`).exec(css)
  if (!match) throw new Error(`rule ${selector} is missing`)
  return match[1]!
}

const SIDEBAR = read('ui-sidebar/src/client/SidebarRoot.module.css')
const ROWS = read('ui-workspace/src/client/rows/Rows.module.css')
const BROWSER = read('ui-workspace/src/client/rows/WorkspaceBrowser.module.css')
const HERO = read('ui-conversation/src/client/skeleton/HeroShell.module.css')
const SETTINGS = read('ui-settings-general/src/client/SettingsRoot.module.css')
const APPEARANCE = read('ui-theme/src/client/AppearanceRow.module.css')
const MODELS = read('ui-settings-models/src/client/ModelsSection.module.css')
const PRESETS = read('ui-agent-preset/src/client/AgentPresetSection.module.css')
const INVENTORY = read('ui-settings-plugin-inventory/src/client/PluginInventorySettingsTab.module.css')

describe('sidebar', () => {
  it('AC-5 fills New session with the primary button and marks the active panel, workspace and session', () => {
    expect(rule(SIDEBAR, '.newSession')).toContain('background: var(--dsw-alias-button-primary-fill)')
    expect(rule(SIDEBAR, '.newSession')).toContain('color: var(--dsw-alias-label-primary-foreground)')
    expect(SIDEBAR).not.toMatch(/\[data-platform='darwin'\]\) \.newSession/)
    expect(rule(SIDEBAR, '.panelRow.panelActive::after')).toContain('background: var(--dsw-alias-brand-marker)')
    expect(rule(ROWS, '.folderActive .marker')).toContain('background: var(--dsw-alias-brand-marker)')
    expect(rule(ROWS, '.sessionRow.selected')).toContain('border-inline-start: 2px solid var(--dsw-alias-brand-marker)')
    const label = rule(BROWSER, '.sectionLabel')
    expect(label).toContain('font-family: var(--ds-font-family-code)')
    expect(label).toContain('text-transform: uppercase')
  })
})

describe('settings', () => {
  it('AC-7 selects with a 2px text-coloured border and shows provider status as squares', () => {
    expect(rule(APPEARANCE, '.selected')).toContain('border: 2px solid var(--dsw-alias-label-primary)')
    expect(rule(APPEARANCE, '.selected::after')).toContain('background: var(--dsw-alias-brand-marker)')
    expect(rule(PRESETS, '.cardActive')).toContain('border: 2px solid var(--dsw-alias-label-primary)')
    const dot = rule(MODELS, '.credentialDot')
    expect(dot).not.toContain('border-radius')
    expect(rule(MODELS, '.credentialDotConfigured')).toContain('var(--dsw-alias-brand-marker)')
    expect(rule(MODELS, '.credentialDotMissing')).toContain('solid var(--dsw-alias-state-error-primary)')
    expect(rule(MODELS, '.rowTag')).toContain('font-family: var(--ds-font-family-code)')
    expect(rule(SETTINGS, '.navTitle')).toContain('font-weight: 800')
    expect(rule(SETTINGS, '.navCell.active::after')).toContain('background: var(--dsw-alias-brand-marker)')
  })
})

/** Rules this spec added or rewrote; none may carry a decorative effect. */
const RESTYLED: [string, string, string[]][] = [
  ['sidebar', SIDEBAR, ['.newSession', '.newSession:hover', '.panelRow', '.panelRow.panelActive', '.panelRow.panelActive::after', '.newSessionShortcut']],
  ['rows', ROWS, ['.sessionRow.selected', '.marker', '.folderActive .marker', '.time']],
  ['browser', BROWSER, ['.sectionLabel']],
  ['hero', HERO, ['.headline', '.titleGroup', '.eyebrow', '.eyebrow::before', '.title,\n.titleAccent', '.titleAccent', '.capabilities', '.previewBadge']],
  ['settings', SETTINGS, ['.navTitle', '.navCell', '.navCell.active', '.navCell.active::after']],
  ['appearance', APPEARANCE, ['.title', '.themeCube', '.selected', '.selected::after']],
  ['models', MODELS, ['.title', '.rows', '.rowCard', '.rowCard + .rowCard', '.rowTag', '.credentialDot', '.credentialDotConfigured', '.credentialDotMissing']],
  ['presets', PRESETS, ['.title', '.groupHead', '.card', '.cardActive']],
  ['inventory', INVENTORY, ['.card', ".card[data-open='true']", '.groupTitle']],
]

describe.each(RESTYLED)('%s', (_name, css, selectors) => {
  it.each(selectors)('AC-8 keeps %s free of gradients, blur and glow', (selector) => {
    const body = rule(css, selector)
    expect(body).not.toMatch(/gradient\(|blur\(|backdrop-filter|box-shadow|text-shadow|filter:/)
  })
})
