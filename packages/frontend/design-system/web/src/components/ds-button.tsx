import type * as React from 'react';
import { cn } from '../lib/utils';

/**
 * The design's button (`.ds-btn`): the radius grows with the height. Primary is
 * white on dark (never the brand), `text` the muted inline action.
 */
function DsButton({
  variant = 'secondary',
  size = 'md',
  icon,
  iconEnd,
  block = false,
  className,
  children,
  type = 'button',
  ...props
}: React.ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'text';
  icon?: React.ReactNode;
  iconEnd?: React.ReactNode;
  block?: boolean;
}) {
  return (
    <button
      // biome-ignore lint/a11y/useButtonType: the type is the caller's, defaulting to button
      type={type}
      className={cn(
        'ds-btn',
        `ds-btn--${size}`,
        variant !== 'secondary' && `ds-btn--${variant}`,
        block && 'ds-btn--block',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
      {iconEnd}
    </button>
  );
}

export { DsButton };
