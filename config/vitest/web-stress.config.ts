import { fileURLToPath } from 'node:url'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'
import { standardDecoratorPlugin, vitestExecArgv } from './shared.ts'

/** Opt-in browser performance lane; no default Vitest config includes *.stress.ts. */
export default defineConfig({
  // Configs live in config/vitest/; every relative path below resolves from the repository root.
  root: fileURLToPath(new URL('../..', import.meta.url)),
  plugins: [tsconfigPaths({ projects: ['./tsconfig.base.json'] }), standardDecoratorPlugin()],
  test: {
    execArgv: vitestExecArgv,
    include: ['apps/web/stress-tests/**/*.stress.ts'],
    testTimeout: 600_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
})
