import { defineConfig } from 'vitest/config';
import { getTestDatabaseUrl } from './test/test-database.js';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    env: { DATABASE_URL: getTestDatabaseUrl() },
  },
});
