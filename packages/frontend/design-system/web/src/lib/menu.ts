/**
 * The one menu look every list that floats over the page wears — `Select`,
 * `DropdownMenu`, `SelectMenu`, `FilterMenu` and `Combobox` — ported from the
 * design's filter menu (`.ds-fselect__menu` in `resetowl-ds-extras.css`):
 * a 12px card with 4px of padding, 32px rows of 14px type at a 6px radius,
 * secondary ink that turns primary under the pointer or when picked.
 *
 * Only the shared shape lives here; each primitive adds the state selector
 * its library speaks (`data-highlighted` for Base UI's select, `focus` for its
 * menu, `hover` for a plain button). Internal: not re-exported from the barrel.
 */

/** The floating card: border, overlay surface, the soft menu shadow. */
export const MENU_SURFACE =
  'rounded-xl border border-border-default bg-popover p-1 text-popover-foreground shadow-menu';

/** The scrolling list inside the card: the thin bar, no scroll chaining onto the page. */
export const MENU_SCROLL = 'overflow-y-auto overscroll-contain scrollbar-thin';

/** A row. `min-h-8` rather than `h-8` so a row with a second line can grow. */
export const MENU_ITEM =
  'flex min-h-8 w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-ink-600 outline-hidden select-none transition-colors data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0';

/** A group's heading: small, tertiary, sitting close to the rows it names. */
export const MENU_LABEL = 'px-2 pt-2 pb-1 text-xs text-ink-400';

/** The hairline between groups, bleeding to the card's padding edge. */
export const MENU_SEPARATOR = '-mx-1 my-1 h-px bg-border-subtle';
