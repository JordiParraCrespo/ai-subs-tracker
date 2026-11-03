import { cn } from '@flama/design-system-web';
import type * as React from 'react';

/**
 * `DsButton`'s look on a link. Every call to action on this page navigates, so
 * it is an `<a>` wearing the design system's `.ds-btn` classes rather than a
 * button that sets `location`.
 */
export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  ...props
}: React.ComponentProps<'a'> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}) {
  return (
    <a
      className={cn(
        'ds-btn',
        `ds-btn--${size}`,
        variant !== 'secondary' && `ds-btn--${variant}`,
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </a>
  );
}
