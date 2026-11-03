# @flama/site — Agent Instructions

The landing page (`designs/Marketing Page.dc.html`). Read the root
[`AGENTS.md`](../../AGENTS.md) first; [`README.md`](README.md) describes the
build.

## Rules

- **It describes the product that exists.** Every claim is something
  Subtrack does today (`README.md` at the root is the source); the preview's
  figures are labelled as an example, and plan names and prices are the ones
  in `packages/shared/src/subscriptions/plans.ts`. The design's own copy
  described a team-spend tool and was rewritten for that reason; keep its
  layout, not its sentences.
- **Copy lives in `src/lib/content.ts`, links in `src/lib/links.ts`.** A
  section file is markup over that data.
- **The page must prerender.** Nothing may read `window`, `document` or
  `localStorage` while rendering: put it in an event handler, as
  `ThemeToggle` does. A render that depends on the visitor (their theme,
  their viewport) is CSS, so the server's markup and the hydrated tree agree.
  `pnpm test` renders the page the way the build does.
- **Components come from `@flama/design-system-web`** (root export; icons from
  `/icons`), under the same rules as `apps/web`:
  [`.agents/rules/frontend-ui.md`](../../.agents/rules/frontend-ui.md). A
  layout class goes on an element around a design-system component, not on
  the component (`pnpm lint:design` holds this). Colours are `--ds-*` tokens,
  never a raw value, except the closing band's white button, which the design
  draws white in both themes.
- **No inline script.** The page is served under `script-src 'self'`
  (`nginx.conf`); anything that must run before React is a file in `public/`.
- Check a change light and dark, at desktop and phone width, from a built
  `dist/` (`pnpm build && pnpm preview`), since that is what ships.

## Not here

The site has no sign-in, no API calls and no router. When it needs a second
page, add a router and prerender each route rather than serving one HTML for
every URL.
