import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@anotherharness/ah-api-workspace-files',
  ['lib/types/index.js'],
  { hostPhase: true },
)
