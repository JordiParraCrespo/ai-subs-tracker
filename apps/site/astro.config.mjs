// @ts-check
import path from 'node:path';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

import { siteConfig } from './src/config/site.ts';

// Scaffolded from astro-ignite's starter (Astro 7) and cut to a landing page:
// static output, no adapter, no Actions, no blog. The i18n block and the
// sitemap are the starter's.
export default defineConfig({
  site: siteConfig.url,
  trailingSlash: 'ignore',
  output: 'static',
  build: {
    format: 'directory',
    // The page's stylesheet ships in the HTML: no render-blocking request.
    inlineStylesheets: 'always',
  },
  i18n: {
    defaultLocale: siteConfig.defaultLocale,
    locales: siteConfig.locales,
    routing: { prefixDefaultLocale: false, redirectToDefaultLocale: false },
  },
  integrations: [
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: siteConfig.defaultLocale,
        locales: Object.fromEntries(
          siteConfig.locales.map((l) => [l, siteConfig.hreflang[l] ?? l]),
        ),
      },
      serialize(item) {
        if (new URL(item.url).pathname === '/') item.priority = 1.0;
        if (item.url.includes('/legal/')) item.priority = 0.3;
        return item;
      },
    }),
  ],
  vite: {
    // One .env, at the monorepo root (VITE_SITE_APP_URL; root .env.example).
    envDir: path.resolve(import.meta.dirname, '../..'),
    // Never inline a script: the site is served under `script-src 'self'`
    // (nginx.conf), so every script must be a same-origin file.
    build: { assetsInlineLimit: 0 },
    // `@flama/shared` hands a bundler its TypeScript source under this
    // condition; the plan catalog and model prices are read from it.
    resolve: { conditions: ['flama-source'] },
    ssr: { resolve: { conditions: ['flama-source'] }, noExternal: ['@flama/shared'] },
    plugins: [/** @type {any} */ (tailwindcss())],
  },
});
