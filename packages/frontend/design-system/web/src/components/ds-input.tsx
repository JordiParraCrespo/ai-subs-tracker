import type * as React from 'react';
import { cn } from '../lib/utils';

/** The design's text field (`.ds-input`): a faint ground, a 1px outline, an optional leading icon. */
function DsInput({
  icon,
  size = 'md',
  className,
  ...props
}: Omit<React.ComponentProps<'input'>, 'size'> & {
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={cn('ds-input', size === 'sm' && 'ds-input--sm', className)}>
      {icon}
      <input {...props} />
    </div>
  );
}

export { DsInput };
