import type * as React from 'react';
import { cn } from '../lib/utils';

export interface DsStat {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: 'positive' | 'negative';
}

/** The design's key-figure grid (`.ds-stats`): label over value, in columns. */
function DsStatGrid({
  items,
  columns = 3,
  className,
}: {
  items: readonly DsStat[];
  columns?: number;
  className?: string;
}) {
  return (
    <dl
      className={cn('ds-stats', className)}
      // oxlint-disable-next-line no-inline-styles -- the column count is the caller's
      style={{ '--ds-cols': columns } as React.CSSProperties}
    >
      {items.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list of figures
        <div key={i}>
          <dt>{item.label}</dt>
          <dd className={item.tone === 'positive' ? 'ds-t-up' : item.tone === 'negative' ? 'ds-t-down' : undefined}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export { DsStatGrid };
