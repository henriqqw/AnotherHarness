import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@anotherharness/ah-api-session-controller',
  ['lib/types/index.js'],
  { hostPhase: true },
)
