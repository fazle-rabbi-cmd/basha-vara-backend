import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts', '**/*.integration.spec.ts'],
    exclude: ['node_modules/**'],
    testTimeout: 60000,
    hookTimeout: 60000,
    environment: 'node',
    setupFiles: ['./test/setup-e2e.ts'],
    sequence: {
      concurrent: false,
    },
  },
});
