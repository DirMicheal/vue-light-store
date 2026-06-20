import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
      thresholds: {
        lines: 90,
        functions: 89.5,
        branches: 90,
        statements: 90
      }
    }
  },
  resolve: {
    alias: {
      'vue-light-store': resolve(__dirname, 'src/index.ts'),
      '@': resolve(__dirname, 'src')
    }
  }
})
