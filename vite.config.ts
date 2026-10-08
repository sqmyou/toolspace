import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
