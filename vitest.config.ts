import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    exclude: ['**/*.e2e-spec.ts', '**/*.integration.spec.ts', 'test/phases-integration.spec.ts', 'node_modules/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.spec.ts',
        '**/*.e2e-spec.ts',
        'test/**',
        '**/*.d.ts',
        'prisma/**',
        'src/main.ts',
        'src/**/*.module.ts',
        'src/**/*.dto.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
  },
});
