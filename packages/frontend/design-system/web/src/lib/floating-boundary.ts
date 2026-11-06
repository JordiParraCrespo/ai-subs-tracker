import * as React from 'react';

/**
 * The element a floating list opened inside it must stay within — a dialog's
 * scrolling body, so a select near the bottom of a form opens upward or
 * scrolls instead of covering the footer's Cancel and Save.
 *
 * `DialogBody` and `DsModalBody` provide it; `SelectContent`,
 * `DropdownMenuContent` and `PopoverContent` read it as their default
 * `collisionBoundary`. Base UI intersects it with the viewport, so outside a
 * dialog (no provider, `null`) nothing changes. Internal: not re-exported from
 * the barrel.
 */
export const FloatingBoundaryContext = React.createContext<HTMLElement | null>(null);

/** The boundary to hand Base UI: the provided element, else its default. */
export function useFloatingBoundary(): HTMLElement | 'clipping-ancestors' {
  return React.useContext(FloatingBoundaryContext) ?? 'clipping-ancestors';
}
