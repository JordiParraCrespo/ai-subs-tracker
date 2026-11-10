# @flama/site — Agent Instructions

The website: the home page and the SEO guides, in English and Spanish, on
Astro (scaffolded from astro-ignite's starter). Read the root
[`AGENTS.md`](../../AGENTS.md) first; [`README.md`](README.md) lists the pages
and the build.

**The name:** ResetOwl, on resetowl.com (the product was called Subtrack
until November 2026; tokenaitor.com redirects here, `nginx.conf`). The app
reads usage the way Orca does, with the client headers the vendors' own CLIs
send, so the copy makes no claim about the name it sends to vendors.

## Rules

- **Say only what the product does.** The root `README.md` is the source for
  ResetOwl's behaviour. Prices, plan names and API rates come from
  `@flama/shared/subscriptions` (`PlanTable`, `ApiPriceTable`); a price typed
  into a guide's prose must be one the catalog holds, and `pnpm test` fails
  otherwise. When the catalog changes, update the prose that names the old
  value and the guides' `checked` date.
- **Every page exists in every locale under the same slug.** A guide is
  `src/content/guides/<locale>/<slug>.mdx` in each locale; a page is
  `src/pages/<name>.astro` plus its twin in `src/pages/[lang]/`. Links inside a
  guide include the locale prefix (`/es/codex-pricing/`); links in components
  go through `localePath`. The tests and `scripts/check-seo.mjs` hold both.
- **UI strings live in `src/i18n/<locale>.json`.** English is the key type, so
  a key missing in Spanish fails `astro check`.
- **A guide's metadata is its search snippet:** `title` ≤70 characters,
  `description` 70–160 (the collection schema enforces both). `faq` renders
  on the page and as FAQPage data, so never add a question the page does not
  show.
- **No framework, no inline script.** Components are `.astro`; a behaviour is a
  small `<script>` Astro bundles to a same-origin file (the page is served
  under `script-src 'self'`, `nginx.conf`). The theme bootstrap is
  `public/theme-init.js`.
- **Styling is the design system's.** Use its classes (`.ds-card`, `.ds-btn`,
  `.ds-row`, `.ds-stats`) and `--ds-*` tokens; the site's own layout and type
  are `site-*` classes in `src/styles/site.css`. No raw colours, except the
  closing band's white button and the social card. The rules are
  [`.agents/rules/frontend-ui.md`](../../.agents/rules/frontend-ui.md).
- **Biome on `.astro`:** it reads the frontmatter only, so `noUnusedImports`,
  `noUnusedVariables` and import sorting are off for `.astro` files in the
  root `biome.json`. `astro check` covers what Biome cannot see.
- Check a change from a built `dist/` (`pnpm build && pnpm preview`), light and
  dark, at desktop and phone width, in both locales.

## Adding a guide

1. `src/content/guides/en/<slug>.mdx` and `src/content/guides/es/<slug>.mdx`,
   with the same `order` and `related` slugs.
2. Use `PlanTable` / `ApiPriceTable` for any price.
3. `pnpm build && pnpm test`. The routes, sitemap, hreflang, footer, guide hub
   and `llms.txt` pick it up from the collection.

## Adding a locale

Add it to `siteConfig.locales` and every locale-keyed record in
`src/config/site.ts`, add `src/i18n/<locale>.json`, and a folder of every
guide and legal page under `src/content/*/<locale>/`.
