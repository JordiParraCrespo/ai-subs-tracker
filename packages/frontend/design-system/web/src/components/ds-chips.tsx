import type * as React from 'react';
import { cn } from '../lib/utils';

/** The design's single-select chips (`.ds-chips`): pills, or the flat filter row. */
function DsChipGroup<TValue extends string>({
  options,
  value,
  onChange,
  variant = 'filter',
  className,
}: {
  options: readonly { value: TValue; label: React.ReactNode }[];
  value: TValue;
  onChange: (value: TValue) => void;
  variant?: 'pill' | 'filter';
  className?: string;
}) {
  return (
    <div role="group" className={cn('ds-chips', variant === 'pill' && 'ds-chips--pill', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          data-checked={option.value === value ? '' : undefined}
          className={variant === 'pill' ? 'ds-chip' : 'ds-filter'}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** The design's segmented control (`.ds-seg`): a tinted track with a thumb. */
function DsSegmented<TValue extends string>({
  options,
  value,
  onChange,
  size = 'sm',
  className,
}: {
  options: readonly { value: TValue; label: React.ReactNode; icon?: React.ReactNode }[];
  value: TValue;
  onChange: (value: TValue) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('ds-seg', size !== 'lg' && `ds-seg--${size}`, className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          data-active={option.value === value ? '' : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export { DsChipGroup, DsSegmented };
