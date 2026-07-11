import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Resolve `#/*` relative to this file. A hardcoded absolute path here breaks
// every checkout but the author's.
const srcPath = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '#': srcPath,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: false,
    globals: false,
  },
})
