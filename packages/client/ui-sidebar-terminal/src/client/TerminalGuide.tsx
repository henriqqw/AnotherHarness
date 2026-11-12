/** Terminal profile menu owned by the terminal provider's guide entry. */
import { useEffect, useState, type ReactNode } from 'react'
import type { ShortcutCatalogEntry } from '@anotherharness/ah-client-shortcuts/client'
import type { HostObservable } from '@anotherharness/ah-client-ui-slots'
import { PluginArtworkTerminal, ShortcutKeys, Button, IconChevronDownOutlineRegular, Menu } from '@anotherharness/ah-client-ui-primitives'
import type { TerminalLaunchShells } from '@anotherharness/ah-api-terminal-controller/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@anotherharness/ah-client-ui-slots'
import type {} from '@anotherharness/ah-client-ui-sidebar-right/client'
import type {} from './locales.ts'
import css from './TerminalGuide.module.css'

/** Provider-owned discovery and browser preference writes. */
export interface TerminalGuideInjected {
  readonly hooks: { readonly shortcuts: HostObservable<readonly ShortcutCatalogEntry[]> }
  /** @param signal - open menu lifetime. @returns current Host choices and browser preference. */
  readonly loadShells: (signal: AbortSignal) => Promise<TerminalLaunchShells>
  /** @param profileId - Host profile selected for the next terminal. */
  readonly selectShell: (profileId: string) => void
  /**
   * Store a profile as the Host default; absent when no settings service is mounted.
   * @param profileId - Host profile to open by default in every browser.
   * @returns true once the Host accepted the change.
   */
  readonly setDefaultProfile?: ((profileId: string) => Promise<boolean>) | undefined
}

/** Menu item that stores the preselected profile as the Host default. */
const SET_DEFAULT = '@set-default'

/** Session guide owner props, framework hooks and terminal actions. */
export type TerminalGuideProps = PropsRuntime<'sidebar.right.tab.guide.entry'> & PropsLocale<'sidebarTerminal'> & InjectFace<TerminalGuideInjected>

type MenuState = { phase: 'loading' } | { phase: 'ready'; choices: TerminalLaunchShells } | { phase: 'failed'; message: string }

/**
 * Open the remembered shell from the card or choose another shell from its menu.
 * The card displays its effective shortcut; the shell menu sits beside the title.
 * @param props - guide copy, enclosing tab actions and cancellable discovery.
 * @returns separate launch and menu buttons within one guide card.
 */
export function TerminalGuide({
  title, description, kind, useTabInfo, loadShells, selectShell, setDefaultProfile, t, useShortcuts,
}: TerminalGuideProps): ReactNode {
  const shortcut = useShortcuts(entries => entries.find(entry => entry.id === 'terminal.new'))
  const { tab } = useTabInfo()
  const [open, setOpen] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<MenuState>({ phase: 'loading' })
  useEffect(() => {
    if (!open) return
    const lifetime = new AbortController()
    void loadShells(lifetime.signal).then((choices) => {
      if (!lifetime.signal.aborted) setState({ phase: 'ready', choices })
    }, (error: unknown) => {
      if (!lifetime.signal.aborted) setState({ phase: 'failed', message: error instanceof Error ? error.message : String(error) })
    })
    return () => { lifetime.abort() }
  }, [open, attempt, loadShells])
  const selected = state.phase === 'ready'
    ? state.choices.shells.find(shell => shell.id === state.choices.selectedShell)
    : undefined
  // Menu actions other than opening a profile, keyed by their item id.
  const actions = new Map<string, () => void>()
  if (setDefaultProfile !== undefined && selected !== undefined && state.phase === 'ready'
    && selected.id !== state.choices.defaultProfileId) {
    actions.set(SET_DEFAULT, () => { void setDefaultProfile(selected.id) })
  }
  const items = state.phase === 'ready'
    ? [
      ...state.choices.shells.map(shell => ({
        id: shell.id,
        label: shell.id === state.choices.defaultProfileId ? t('profileDefault', { name: shell.name }) : shell.name,
      })),
      ...actions.has(SET_DEFAULT) ? [{ id: SET_DEFAULT, label: t('setDefault', { name: selected?.name }) }] : [],
    ]
    : state.phase === 'loading'
      ? [{ id: 'loading', label: t('shellLoading'), disabled: true }]
      : [{ id: 'error', label: t('failed', { message: state.message }), disabled: true }, { id: 'retry', label: t('retry') }]
  return <div className={css.entry} data-sidebar-right-guide-entry={kind}>
    <Button variant="ghost" className={css.main} aria-label={description === undefined ? title : `${title} ${description}`} aria-keyshortcuts={shortcut?.aria}
      onClick={() => { tab.actions.openTab('terminal', { replaceTab: true }) }} />
    <span className={css.icon} aria-hidden="true"><PluginArtworkTerminal size={description === undefined ? 22 : 26} /></span>
    <span className={css.text}>
      <span className={css.titleRow}>
        <span className={css.title} aria-hidden="true">{title}</span>
        <Menu
          open={open} portal autoFocus align="end" className={css.menu}
          items={items.length === 0 ? [{ id: 'empty', label: t('shellEmpty'), disabled: true }] : items}
          selectedId={state.phase === 'ready' ? state.choices.selectedShell : undefined}
          onClose={() => { setOpen(false) }}
          onSelect={(profileId) => {
            if (state.phase === 'failed') { setState({ phase: 'loading' }); setAttempt(value => value + 1); return }
            const action = actions.get(profileId)
            if (action !== undefined) {
              setOpen(false)
              action()
              return
            }
            selectShell(profileId)
            setOpen(false)
            tab.actions.openTab('terminal', { replaceTab: true, params: { profileId } })
          }}
          anchor={<Button variant="ghost" className={css.trigger} aria-label={t('shell')} aria-haspopup="menu" aria-expanded={open}
            onClick={() => { setState({ phase: 'loading' }); setOpen(value => !value) }}>
            <IconChevronDownOutlineRegular />
          </Button>}
        />
      </span>
      {description !== undefined && <span className={css.description} aria-hidden="true">{description}</span>}
    </span>
    {shortcut !== undefined && shortcut.keys.length > 0 && <ShortcutKeys keys={shortcut.keys} className={css.shortcut} />}
  </div>
}
