import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Polyfill for @ethereumjs/util (used by @metamask/eth-sig-util) - browser has no Node events
      events: 'events',
    },
  },
  optimizeDeps: {
    include: ['events'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
