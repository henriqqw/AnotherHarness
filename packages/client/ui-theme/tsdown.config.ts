import { clientBundle } from '../tsdown.client.ts'

export default clientBundle(
  '@anotherharness/ah-client-ui-theme',
  ['lib/types/index.js'],
  {
    lib: {
      copy: [{
        from: 'src/styles/{brand-font.css,plus-jakarta-sans-*.woff2,PlusJakartaSans-OFL.txt}',
        to: 'lib/styles',
      }],
    },
  },
)
