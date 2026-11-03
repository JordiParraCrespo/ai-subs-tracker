import type * as React from 'react';
import { cn } from '../lib/utils';

/**
 * The design's status pills. `DsBadge` is the small label (`.ds-badge`), tinted
 * by tone; `DsStatusBadge` is the purple pill with a trailing dot (`.ds-status`).
 */
function DsBadge({
  tone = 'info',
  children,
  className,
}: {
  tone?: 'info' | 'review' | 'negative' | 'neutral';
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('ds-badge', className)} data-tone={tone}>
      {children}
    </span>
  );
}

function DsStatusBadge({
  children,
  pulse = false,
  className,
}: {
  children: React.ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('ds-status', className)} data-pulse={pulse ? '' : undefined}>
      <span className="pr-0.5">{children}</span>
      <span className="ds-status__dot">
        <i />
      </span>
    </span>
  );
}

export { DsBadge, DsStatusBadge };
