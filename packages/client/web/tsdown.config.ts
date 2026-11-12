import { staticLinked } from '../tsdown.client.ts'

export default staticLinked(
  '@anotherharness/ah-client-web',
  ['lib/types/index.js', 'lib/types/apply-injections.js'],
)
