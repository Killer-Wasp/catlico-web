import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // Resolve `#/…` to this worktree's own src (matches tsconfig `#/*` →
      // `./src/*`). A hardcoded absolute path would make tests import a
      // sibling checkout instead of this branch's source.
      '#': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: false,
    globals: false,
  },
})
