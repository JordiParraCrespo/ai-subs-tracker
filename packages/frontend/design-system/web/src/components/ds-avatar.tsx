import type * as React from 'react';
import { cn } from '../lib/utils';

/**
 * The design's identity marks (`.ds-avatar`): an entity is initials on a
 * colour, a contact the grey disc. `size` below 33px scales the type with it.
 */
function DsAvatar({
  kind = 'entity',
  initials,
  color,
  size = 40,
  className,
}: {
  kind?: 'entity' | 'contact';
  initials: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  const style: React.CSSProperties = { width: size, height: size };
  if (kind === 'entity' && color) style.background = color;
  if (size <= 32) style.fontSize = Math.round(size * 0.42);
  return (
    <span
      className={cn('ds-avatar', kind === 'entity' ? 'ds-avatar--token' : 'ds-avatar--contact', className)}
      // oxlint-disable-next-line no-inline-styles -- size and colour are the caller's data
      style={style}
    >
      {initials}
    </span>
  );
}

export { DsAvatar };
