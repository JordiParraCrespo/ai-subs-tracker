# @flama/site

Subtrack's landing page: one page that says what the desktop app does, shows
the Overview and Tokenmaxx screens in miniature, and links to the download.
It is built from `designs/Marketing Page.dc.html` on `@flama/design-system-web`,
so it shares the app's tokens, type and both themes.

The page is **prerendered**: `pnpm build` writes its full HTML into
`dist/index.html`, so it reads (and indexes) before any script runs, and the
client bundle then hydrates the same tree for the chart's hover and the theme
switch.

## Commands

```bash
pnpm --filter @flama/site dev       # http://localhost:3002, rendered in the browser
pnpm --filter @flama/site build     # dist/: the prerendered page and its assets
pnpm --filter @flama/site preview   # serve dist/ on http://localhost:3002
pnpm --filter @flama/site test      # the prerendered HTML: copy, anchors, links
pnpm --filter @flama/site lint:design
```

## How the build works

1. `vite build` bundles `src/entry-client.tsx` and leaves `<!--app-->` in
   `dist/index.html`.
2. `vite build --ssr src/entry-server.tsx` bundles the same page for Node into
   `dist-server/`.
3. `scripts/prerender.mjs` renders it, writes the markup over the placeholder
   and deletes `dist-server/`.

## Layout

| Path | What it holds |
| --- | --- |
| `src/site.tsx` | The page: the sections in the design's order |
| `src/sections/` | One file per section (header, hero, preview, features, how it works, privacy, closing band, footer) |
| `src/components/` | What the sections share: a link styled as the design-system button, the theme switch, feature icons |
| `src/lib/content.ts` | Every sentence and the preview's example figures |
| `src/lib/links.ts` | Where the links go |
| `src/styles.css` | Tailwind, the design system's styles, and the page's own display type and section layout |
| `public/theme-init.js` | Applies the theme before first paint |

## Configuration

| Variable | What it does |
| --- | --- |
| `VITE_SITE_APP_URL` | Where "Sign in" goes: the web app's public URL. Empty means `http://localhost:3000` |

It is read from the root `.env` at build time, like every `VITE_` value.

## Deploying

`apps/site/Dockerfile` builds the page and serves it with nginx on port 3002,
under the same Content-Security-Policy as the web app (`nginx.conf`). Pass the
sign-in URL as a build argument:

```bash
docker build -f apps/site/Dockerfile --build-arg VITE_SITE_APP_URL=https://app.example.com -t subtrack-site .
```

`dist/` is plain static files, so any static host serves it as well.
