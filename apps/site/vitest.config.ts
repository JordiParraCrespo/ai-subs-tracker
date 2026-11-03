/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

/**
 * Astro's own Vite config, so the tests render components through the
 * Container API with `astro:i18n`, the `@/` alias and the content layer
 * resolved the way the build resolves them.
 */
export default getViteConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
