# Dashboard Design System

A generic, **dark-first** design system for building data dashboards. It is almost entirely neutral: hierarchy comes from gray surface steps, translucent fills and 1px outlines, never card shadows. The **brand is purple**, matched to Ubuntu's (Yaru) purple highlight colour #7764D8, sampled from the user's Ubuntu Appearance settings screenshot. **Every former green is now purple too**: up values, success badges and chart lines use lighter/darker steps of the same purple; down and errors stay red. A light theme (`data-theme="light"`) and a green variant (`data-accent="green"`, the original source look, restoring brand + signals) ship alongside.

## Sources
- The user pasted a component/tokens spec, *"near.com design system (compact)"* plus the full *"near.com Design System"* doc. It was extracted (Oct 2026) from near.com's compiled Tailwind v4 CSS and about 260 component class strings. Original artifact link: https://claude.ai/artifact/6ZEsEJ6xXLYqHbb67czXmK (it rendered client-side, so it couldn't be fetched; the content was pasted instead).
- The source is a fintech wallet. As requested, this system is **generalised for any dashboard**: finance names were dropped (token → entity, tx-swap/tx-transfer → `--cat-violet`/`--cat-sky`, "NEAR green" → `--accent`; at the user's request the brand was then switched to Ubuntu's purple highlight colour (#7764D8), and all signal greens were moved to the same purple). Every numeric value (radii, heights, paddings, type, colours) is copied exactly.
- No logo, icon files or font binaries were supplied.

## Index
- `styles.css`: the entry point (imports only).
- `tokens/`: `colors.css` (dark + light semantic tokens and raw gray/green/red/blue scales), `accent-green.css`, `typography.css` (`--type-*` shorthands + `.t-*` utility classes), `spacing.css` (space, radius, control heights, layout widths), `effects.css` (shadows, motion, hatch tile), `fonts.css`.
- `components/components.css`: class recipes (`ds-*`) that the React components render.
- `components/<group>/`: React components (`.jsx` + `.d.ts` + `.prompt.md` + one card per folder).
- `guidelines/`: foundation specimen cards (colours, type, spacing, effects, brand).
- `ui_kits/dashboard/`: interactive dashboard recreation (see its README).
- `SKILL.md`: agent-skill entry. `thumbnail.html`: project tile.

## Components
Bundled under `window.DashboardDesignSystem_d616c8`.
- **actions/**: Button, IconButton
- **selection/**: Chip, ChipGroup, SegmentedControl, Tabs, Checkbox, OptionTile
- **forms/**: Input, Select, SelectField, AmountInput, AmountPair
- **display/**: Badge, StatusBadge, Avatar, Icon, Hatch
- **surfaces/**: Card, CardRow, ReviewRow, ExploreCard, Banner
- **data/**: Table, ListRow, StatGrid
- **charts/**: AreaChart, Sparkline
- **overlays/**: Sheet, Dialog
- **navigation/**: Sidebar, ContentPanel, BottomNav, Stepper
- **feedback/**: Skeleton, EmptyState

### Intentional additions
- **Icon**: a wrapper for the Lucide glyph set, because the spec describes the icon style but ships no icons.
- **Hatch**: the spec's hatch motif as a reusable layer.
- **ChipGroup / AmountPair / CardRow / ContentPanel**: thin composition helpers for patterns the spec describes (single-select chip groups, the sell/buy pair with the seam switch, list-card rows, the desktop content panel).

## Usage
```html
<html data-theme="dark"> <!-- or "light"; add data-accent="green" for the green-brand variant -->
<link rel="stylesheet" href="styles.css">
<script src="https://unpkg.com/lucide@0.469.0/dist/umd/lucide.min.js"></script>
<script src="_ds_bundle.js"></script>
```
Layout: below 1280px, use a single column on `--bg-app` with a floating BottomNav. At 1280px and up, use the 272px Sidebar on `--bg-frame` with the page inside a ContentPanel (r16, 1px outline). Flows and forms use a 464–512px column, pages cap at 1280px, and tables can run full width. Breakpoints are 640 / 768 / 1024 / 1280.

---

## CONTENT FUNDAMENTALS
- **Sentence case everywhere**: "Create report", "Select metric", "No reports yet". Never Title Case or ALL CAPS, except 11px eyebrows.
- **Short and plain.** Labels are a word or two. Descriptions are one line.
- **Buttons are verbs**: "Export", "Create alert", "Show more".
- **Disabled CTAs say what's missing**: "Enter a name", "Select a metric", "Enter a threshold". Keep the button visible at 40% opacity.
- **Errors say what to do**: "Enter a valid email address.", not "Invalid input".
- **Empty states point forward**: "Create a report to start tracking a metric."
- **Voice**: the interface addresses the user as *you/your* ("Your workspace at a glance"), sparingly. There's no first person and no exclamation marks.
- **No emoji.** Arrows ▲▼ are used as text in change values.
- **Numbers**: show the most useful unit first and the secondary unit muted. Money in rows uses −0.05em tracking. Change values take a sign or arrow plus a percentage with two decimals in chart headers.
- The vibe is calm, confident and factual, like an instrument panel rather than a marketing page.

## VISUAL FOUNDATIONS
- **Colour.** Neutrals do the work: gray-900 frame, gray-850 page, gray-800 cards (dark), or white page and white cards with gray-200 borders (light). `--brand` (purple #7764D8 in both themes, white on it) is reserved for identity: the account tile, the support button, selected option tiles, icon discs, promo cards and the selection highlight. **It is never the primary button.** `--accent` / `--positive` (purple-400 #9D91E8 on dark, purple-600 #5F4CC2 on light) carries signals: up values, success badges, chart lines and the hatch. Primary is white with gray-900 text in dark mode, and gray-900 in light mode. Other signals: red for down/error, blue for info, fuchsia for "needs review", violet/sky for categories.
- **Inversions.** The bottom nav pill and the floating round buttons are light in dark mode and dark in light mode. The sidebar and the ExploreCard art panels stay dark in both themes.
- **Type.** Figtree for everything. **Running text is weight 500**, titles and names 600, and 700 only for big amount entry and error codes. Tracking is −0.025em on 16px+ and on buttons, −0.05em on money in rows, and +0.12em on uppercase eyebrows.
- **Shape.** Radius grows with element size: 8px for 32/36px controls, 10px for 40px controls and inputs, 12px for 48px buttons and sidebar items, 16px for cards, tables, dialogs and rows, 24px for notice/settings cards and sheet tops, and full for chips, avatars, the nav pill and floating buttons. Controls snap to 32 / 36 / 40 / 44 / 48 / 52 / 72px.
- **Spacing.** A 4px grid with 2/6/10 half steps. **Page gutter** (horizontal padding inside the dashboard): `--page-gutter` = 16px below 640, 24px from 640, and from 1024 a fluid `clamp(32px, 4vw, 64px)`; content caps at `--page-max` 1280px. Wrap page content and headers in `.ds-container` (`--wide` removes the cap, `--narrow` caps at 512px). List-card rows are 20×24px, sheets use a 464px column, and tables have 24px outer padding.
- **Depth.** Cards are flat. Separate things with surface steps, white/6 fills and 1px white/5 outlines. Only floating things get `--shadow-float`, the support button gets `--shadow-glow`, and only light-mode overlays get `--shadow-overlay`.
- **Borders.** Use 1px outlines (`--outline-card`, `--outline-field`) and `--divider` between rows. Focus is a 2px `--outline-focus` (inputs, amount boxes) or a 2px `--text` outline inset by 2px (buttons).
- **Hover.** Fills step up (white/6 → white/10), ghosts gain white/6, rows gain `--surface-hover`, and primary darkens to gray-200. Cards never lift: ExploreCard hover is a 2px outline. Transitions are colour-only at 150ms.
- **Press / disabled.** There's no shrink. Disabled is 40% opacity (fields 60%).
- **Motion.** 150ms colour transitions, spring-like rise for sheets (side slide at ≥1280px), opacity fades for the dialog and nav, and a slow pulse on skeletons and the status dot. All of it is off under reduced motion.
- **Backgrounds & imagery.** These are flat colour grounds, with no gradients except chart fills and the review wash. There are no photos or illustrations. "Art" is built from the UI's own parts (mini charts, curves, slider tracks) on a dark ground.
- **Texture.** The **hatch**, a 6×6 diagonal tile (`M5 0h1L0 6V5zM6 5v1H5z`), runs at 28% over area-chart fills and art, fading out toward the bottom. It also cuts through the fuchsia wash on review rows. Never use it as a page background.
- **Charts.** No grid. Area charts have no axes, and the header is the legend: hovering rewrites the value, change and date, with no tooltip. The line is 2px, the fill runs 25%→4%, and the crosshair is a 1px vertical line plus a 4.5px dot.
- **Transparency / blur.** Translucent white fills carry the hierarchy in dark mode. There's no backdrop blur. Overlays dim with `--overlay` (black/60 dark, /30 light).
- **Layout rules.** The sidebar is fixed on the left at ≥1280px. Below that, the nav pill floats at bottom-centre with Back/Search satellites and the Support button is fixed bottom-right.

## ICONOGRAPHY
- **Style.** Outline icons with a 1.5px stroke, round caps and joins, in `currentColor`. They come at 16px (buttons, inputs), 20px (default, sidebar) and 22px (bottom nav).
- **Set.** No icon files were supplied. **Lucide** (CDN, `lucide@0.469.0`) is substituted because it matches the stroke and style. Render icons with `<Icon name="…">`, which reads `window.lucide.icons`. Replace it with your own set if you have one.
- **Logos.** Entity logos are 40px circles with a 1px white/10 outline and an optional 16px corner badge. Supply your own images via `Avatar src`. Previews use initials on colour.
- **No emoji.** Unicode ▲▼ appear in change values, and ⌘ appears in kbd hints.
- **Brand mark.** None was supplied. Wherever a mark would go (sidebar header, thumbnail), the name is set in plain Figtree 700.

## Caveats
- Figtree loads from Google Fonts; there are no local binaries.
- The original charts use TradingView Lightweight Charts. Here they are dependency-free SVG; the candlestick chart was removed as too finance-specific for a generic dashboard with the same visual spec, and without the TradingView watermark.
- Inputs don't automatically switch to the compact 36px size at ≥1024px. Pass `size="sm"`.
