import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '#': '/Users/local/catlico/catlico-web/src',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: false,
    globals: false,
  },
})
