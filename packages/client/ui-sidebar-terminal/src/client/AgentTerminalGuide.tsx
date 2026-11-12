/** Agent terminal menu owned by the terminal provider's second guide entry. */
import { useEffect, useState, type ReactNode } from 'react'
import { Button, IconChevronDownOutlineRegular, Menu, PluginArtworkTerminal } from '@anotherharness/ah-client-ui-primitives'
import type { AgentTerminalInfo } from '@anotherharness/ah-api-terminal-controller/types'
import type { InjectFace, PropsLocale, PropsRuntime } from '@anotherharness/ah-client-ui-slots'
import type {} from '@anotherharness/ah-client-ui-sidebar-right/client'
import type {} from './locales.ts'
import css from './TerminalGuide.module.css'

/** Provider-owned listing of the agent's terminals. */
export interface AgentTerminalGuideInjected {
  /** @param signal - open menu lifetime. @returns the agent terminals of this Session. */
  readonly loadAgentTerminals: (signal: AbortSignal) => Promise<readonly AgentTerminalInfo[]>
}

/** Session guide owner props, framework hooks and agent terminal actions. */
export type AgentTerminalGuideProps = PropsRuntime<'sidebar.right.tab.guide.entry'> & PropsLocale<'sidebarTerminal'> & InjectFace<AgentTerminalGuideInjected>

type ListState = { phase: 'loading' } | { phase: 'ready'; terminals: readonly AgentTerminalInfo[] } | { phase: 'failed'; message: string }

/**
 * List the agent's terminals and open one as a live tab.
 * @param props - guide copy, enclosing tab actions and cancellable listing.
 * @returns the guide card with its agent terminal menu.
 */
export function AgentTerminalGuide({ title, description, kind, useTabInfo, loadAgentTerminals, t }: AgentTerminalGuideProps): ReactNode {
  const { tab } = useTabInfo()
  const [open, setOpen] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<ListState>({ phase: 'loading' })
  useEffect(() => {
    if (!open) return
    const lifetime = new AbortController()
    void loadAgentTerminals(lifetime.signal).then((terminals) => {
      if (!lifetime.signal.aborted) setState({ phase: 'ready', terminals })
    }, (error: unknown) => {
      if (!lifetime.signal.aborted) setState({ phase: 'failed', message: error instanceof Error ? error.message : String(error) })
    })
    return () => { lifetime.abort() }
  }, [open, attempt, loadAgentTerminals])
  const items = state.phase === 'ready'
    ? state.terminals.map(terminal => ({
      id: terminal.id,
      label: terminal.controlledBy === 'user' ? t('agentYouControlItem', { name: terminal.title }) : terminal.title,
    }))
    : state.phase === 'loading'
      ? [{ id: 'loading', label: t('agentLoading'), disabled: true }]
      : [{ id: 'error', label: t('failed', { message: state.message }), disabled: true }, { id: 'retry', label: t('retry') }]
  const show = (): void => { setState({ phase: 'loading' }); setOpen(value => !value) }
  return <div className={css.entry} data-sidebar-right-guide-entry={kind}>
    <Button variant="ghost" className={css.main} aria-label={description === undefined ? title : `${title} ${description}`} onClick={show} />
    <span className={css.icon} aria-hidden="true"><PluginArtworkTerminal size={description === undefined ? 22 : 26} /></span>
    <span className={css.text}>
      <span className={css.titleRow}>
        <span className={css.title} aria-hidden="true">{title}</span>
        <Menu
          open={open} portal autoFocus align="end" className={css.menu}
          items={items.length === 0 ? [{ id: 'empty', label: t('agentEmpty'), disabled: true }] : items}
          onClose={() => { setOpen(false) }}
          onSelect={(terminalId) => {
            if (state.phase === 'failed') { setState({ phase: 'loading' }); setAttempt(value => value + 1); return }
            setOpen(false)
            tab.actions.openTab('agent-terminal', { replaceTab: true, params: { terminalId } })
          }}
          anchor={<Button variant="ghost" className={css.trigger} aria-label={t('agentChoose')} aria-haspopup="menu" aria-expanded={open} onClick={show}>
            <IconChevronDownOutlineRegular />
          </Button>}
        />
      </span>
      {description !== undefined && <span className={css.description} aria-hidden="true">{description}</span>}
    </span>
  </div>
}
