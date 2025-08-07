import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // TODO: prolly want to put integration tests in separate package/folder/something
    // projects: [ 'packages/*' ],
    include: [ '**/test/(unit|integration)/**/*.test.ts' ],
    coverage: {
      enabled: true,
    },
    chaiConfig: {
      truncateThreshold: 0,
    },
    hookTimeout: 60000,
    testTimeout: 60000,
  },
});
