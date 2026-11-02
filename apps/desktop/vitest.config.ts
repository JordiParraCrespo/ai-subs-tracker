import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['flama-source'] },
  test: {
    include: ['src/**/__tests__/*.spec.ts'],
  },
});
