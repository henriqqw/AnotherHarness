/** Animated jellyfish glyph for the running Chat status. */
import css from './ChatView.module.css'

/** Bell outline: a dome closed by a shallow lower curve. */
export const RUNNING_BELL_PATH = 'M2.5 8.25C2.5 4.9 4.95 2.5 8 2.5C11.05 2.5 13.5 4.9 13.5 8.25C11.6 9.05 4.4 9.05 2.5 8.25Z'

/** Tentacle strokes, left to right, hanging from the bell rim. */
export const RUNNING_TENTACLE_PATHS = [
  'M5.25 9.4C4.7 10.8 5.8 11.9 5.1 13.4',
  'M8 9.7C7.45 11.3 8.55 12.6 7.9 14.4',
  'M10.75 9.4C10.2 10.8 11.3 11.9 10.6 13.4',
] as const

/**
 * Render the decorative running icon. CSS pulses the bell and sways the
 * tentacles; reduced motion and forced colors keep the glyph static.
 * @returns the jellyfish svg in `currentColor`.
 */
export function RunningJellyfish() {
  return (
    <span className={css.runningIcon} aria-hidden="true">
      <svg className={css.runningJellyfish} width="100%" height="100%" viewBox="0 0 16 16" fill="none">
        <path className={css.runningBell} d={RUNNING_BELL_PATH} stroke="currentColor" strokeWidth={1.2} strokeLinejoin="round" />
        {RUNNING_TENTACLE_PATHS.map(d => (
          <path key={d} className={css.runningTentacle} d={d} stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" />
        ))}
      </svg>
    </span>
  )
}
