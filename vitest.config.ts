import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,jsx}', 'server/**/*.cjs'],
      exclude: ['src/main.jsx', '**/node_modules/**']
    },
    // Increase timeout for integration tests
    testTimeout: 10000,
    // Use node environment for API tests to support native modules (better-sqlite3)
    // Context tests need jsdom for React Testing Library
    environmentMatchGlobs: [
      ['tests/integration/api/**', 'node'],
      ['tests/integration/mcp/**', 'node'],
      ['tests/integration/contexts/**', 'jsdom'],
      ['tests/unit/**', 'jsdom'],
      ['tests/component/**', 'jsdom'],
    ],
    // Use vmThreads pool for native module compatibility (better-sqlite3)
    pool: 'vmThreads',
    // Disable file parallelism for native module compatibility
    fileParallelism: false,
    // Isolate tests to prevent state leakage between files
    isolate: true,
    // Clear mocks between tests
    clearMocks: true,
    restoreMocks: true,
    // Reset module registry between tests to prevent state leakage
    mockReset: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
