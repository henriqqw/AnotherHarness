import type { TurnBoundaryProjection } from './types.ts'
import type {} from '@anotherharness/ah-session-projection'

declare module '@anotherharness/ah-session-projection/types' {
  interface SessionProjectionStateMap {
    /** The agent session's open/last turn and step boundary facts (whole value). */
    turnBoundary: TurnBoundaryProjection
  }
}

export {}
