import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@anotherharness/ah-api-remotes',
  ['lib/types/index.js'],
  { hostPhase: true },
)
