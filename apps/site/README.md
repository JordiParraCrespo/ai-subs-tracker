# @flama/site

Tokenaitor's website at **https://tokenaitor.com**. Tokenaitor is the product's public name; the code, the desktop app and the rest of this repository still call it Subtrack (it identifies itself to vendors as `subtrack-desktop`).

The site holds the home page and a set of
guides on Claude Code and Codex plans, limits and prices, in English (`/`)
and Spanish (`/es/`). Scaffolded from
[astro-ignite](https://github.com/JordiParraCrespo/astro-ignite)'s starter
(Astro 7) and cut down to static pages, styled with
`@flama/design-system-web`'s tokens and classes. No framework ships: every
page is static HTML plus two small scripts (the theme switch and the chart
hover).

## Pages

| URL | What it is |
| --- | --- |
| `/` | The home page (`designs/Marketing Page.dc.html`): hero, product preview, features, how it works, privacy, the guide hub |
| `/claude-code-usage-tracker/` | The pillar page: what a Claude Code usage tracker should show, and how Tokenaitor tracks several accounts |
| `/claude-code-pricing/` | Claude plans and prices, Anthropic's API rates |
| `/codex-pricing/` | ChatGPT plans for Codex, the Pro tiers, OpenAI's API rates |
| `/claude-code-usage-limits/` | The 5-hour and weekly windows on both vendors' plans |
| `/claude-pro-vs-max-vs-ultra/` | The three individual Claude plans compared |
| `/legal/privacy/`, `/legal/terms/` | Privacy and terms |

Each exists under `/es/` too. Plus `sitemap-index.xml`, `robots.txt`,
`llms.txt` and the social card `og.png`.

**The plan tables and API prices are read from `@flama/shared/subscriptions`**,
the catalog the app itself uses, so a price change there reaches every page.

## Commands

```bash
pnpm --filter @flama/site dev       # http://localhost:3002
pnpm --filter @flama/site build     # astro check, astro build, then the SEO check over dist/
pnpm --filter @flama/site preview   # serve dist/ on http://localhost:3002
pnpm --filter @flama/site test      # the copy: locales agree, links land, prices are the catalog's
```

`scripts/check-seo.mjs` runs after every build and fails it when a page loses
its single h1, its self-canonical, its reciprocal hreflang, its title or
description length, its JSON-LD, or gains an inline script.

The social card is `scripts/og.html` rendered to `public/og.png`:

```bash
CHROMIUM_PATH=/path/to/chrome node apps/site/scripts/render-og.cjs
```

## Layout

| Path | What it holds |
| --- | --- |
| `src/config/site.ts` | The domain, locales, names, descriptions and where the links go |
| `src/i18n/{en,es}.json` | Every UI string; English is the key type |
| `src/content/guides/<locale>/<slug>.mdx` | The guides: frontmatter (title, description, FAQ, related) and body |
| `src/content/legal/<locale>/` | Privacy and terms |
| `src/components/landing/` | The home page's sections |
| `src/components/guides/` | Plan and API-price tables, callout, FAQ |
| `src/components/ds/` | The design system's chart, avatar and stat grid as Astro components |
| `src/components/common/`, `seo/` | Header, footer, switchers, breadcrumbs; the head tags and JSON-LD |
| `src/layouts/` | Base, guide and legal layouts |
| `src/lib/` | Locale paths, the guide collection, JSON-LD builders, preview figures |
| `src/styles/site.css` | Tailwind, the design system's styles, and the site's own layout and type |

## Configuration

| Variable | What it does |
| --- | --- |
| `VITE_SITE_APP_URL` | Where "Sign in" goes: the web app's public URL. Empty means `http://localhost:3000` |

Read from the root `.env` at build time.

## Deploying

`apps/site/Dockerfile` builds the site and serves it with nginx on port 3002
under the same Content-Security-Policy as the web app (`nginx.conf`):

```bash
docker build -f apps/site/Dockerfile --build-arg VITE_SITE_APP_URL=https://app.tokenaitor.com -t tokenaitor-site .
```

`dist/` is plain static files, so any static host serves it as well.
