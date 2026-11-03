import { Check } from 'lucide-react';
import type * as React from 'react';
import { cn } from '../lib/utils';

/** The design's checkbox (`.ds-check`): a 16px box beside its label. */
function DsCheckbox({
  checked,
  onCheckedChange,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type' | 'checked' | 'onChange'> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className={cn('ds-check', className)} data-checked={checked ? '' : undefined}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        {...props}
      />
      <span className="ds-check__box">{checked && <Check className="size-3" strokeWidth={3} />}</span>
      {children}
    </label>
  );
}

export { DsCheckbox };
