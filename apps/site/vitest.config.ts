import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * The page is rendered to a string, the way the build prerenders it, so the
 * tests need no DOM: what they hold is that the static HTML says what the
 * product does and that every link goes somewhere.
 */
export default defineConfig({
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
});
