import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The workspace packages from their source, as the app's own bundle takes
  // them (scripts/build.mjs): a spec then never runs against a stale `dist`.
  // Node resolves a linked package itself unless it is inlined, and reads
  // only the `ssr` conditions when it is.
  resolve: { conditions: ['flama-source'] },
  ssr: { resolve: { conditions: ['flama-source'] } },
  test: {
    include: ['src/**/__tests__/*.spec.ts'],
    server: { deps: { inline: [/^@flama\//] } },
  },
});
