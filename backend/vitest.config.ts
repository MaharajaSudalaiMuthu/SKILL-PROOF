import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false,
    testTimeout: 25000,
    hookTimeout: 30000,
    globalSetup: ['./tests/globalSetup.ts'],
  },
});
