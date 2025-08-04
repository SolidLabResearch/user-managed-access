import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // TODO: prolly want to put integration tests in separate package/folder/something
    // projects: [ 'packages/*' ],
    include: [ '**/test/(unit|integration)/**/*.test.ts' ],
    hookTimeout: 60000,
    testTimeout: 60000,
  },
});
