import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@anotherharness/ah-session-log-export',
  ['lib/types/index.js'],
  { hostPhase: true },
)
