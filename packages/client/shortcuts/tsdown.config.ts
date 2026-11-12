import { clientBundle } from '../tsdown.client.ts'

export default clientBundle(
  '@anotherharness/ah-client-shortcuts',
  ['lib/types/index.js', 'lib/types/protocol.js'],
  { hostPhase: true },
)
