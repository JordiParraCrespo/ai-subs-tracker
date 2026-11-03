'use client';

import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import * as React from 'react';
import { cn } from '../lib/utils';

export interface DsFilterOption<TValue extends string> {
  value: TValue;
  label: string;
}

/**
 * The design's toolbar filter (`designs/Filter Select`): a 36px trigger that
 * lights up when it holds anything but its first option, opening a menu of
 * checkable rows. `neutral` keeps it unlit (a sort, a goal).
 */
function DsFilterSelect<TValue extends string>({
  options,
  value,
  onChange,
  icon,
  neutral = false,
  align = 'left',
  className,
}: {
  options: readonly DsFilterOption<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
  icon?: React.ReactNode;
  neutral?: boolean;
  align?: 'left' | 'right';
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const current = options.find((option) => option.value === value) ?? options[0];
  const active = !neutral && options.length > 0 && value !== options[0]?.value;

  return (
    <div className={cn('ds-fselect', className)}>
      <button
        type="button"
        className="ds-fselect__trigger"
        data-active={active ? '' : undefined}
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
      >
        {icon && <span className="ds-fselect__icon">{icon}</span>}
        <span>{current?.label}</span>
        {open ? (
          <ChevronUp className="ds-fselect__chevron" />
        ) : (
          <ChevronDown className="ds-fselect__chevron" />
        )}
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close"
            className="ds-fselect__scrim"
            onClick={() => setOpen(false)}
          />
          <div className="ds-fselect__menu" data-align={align}>
            {options.map((option, i) => (
              <React.Fragment key={option.value}>
                {i === 1 && !neutral && <div className="ds-fselect__divider" />}
                <button
                  type="button"
                  className="ds-fselect__item"
                  data-selected={option.value === value ? '' : undefined}
                  onClick={() => {
                    setOpen(false);
                    onChange(option.value);
                  }}
                >
                  <span className="flex-1">{option.label}</span>
                  <span className="ds-fselect__check">
                    {option.value === value && <Check className="size-4" />}
                  </span>
                </button>
              </React.Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export { DsFilterSelect };
