import { ChevronLeft, ChevronRight } from 'lucide-react';
import type * as React from 'react';
import { cn } from '../lib/utils';

export interface DsGridColumn<TRow> {
  key: string;
  label: React.ReactNode;
  align?: 'left' | 'right';
  render: (row: TRow) => React.ReactNode;
}

/**
 * The design's list table (Subscriptions, Tokenmaxx's queue): a header on the
 * tinted band, the rows in a rounded card inside it, laid out on one CSS
 * grid template, and a footer with the count and the pager.
 */
function DsGridTable<TRow>({
  columns,
  template,
  rows,
  rowKey,
  onRowClick,
  expanded,
  footer,
  page,
  pages = 1,
  onPage,
  minWidth = 880,
  className,
}: {
  columns: readonly DsGridColumn<TRow>[];
  /** `grid-template-columns` for the header and every row. */
  template: string;
  rows: readonly TRow[];
  rowKey: (row: TRow) => string;
  onRowClick?: (row: TRow) => void;
  /** What opens under a row (the design's people detail); null keeps it closed. */
  expanded?: (row: TRow) => React.ReactNode;
  footer?: React.ReactNode;
  page?: number;
  pages?: number;
  onPage?: (page: number) => void;
  minWidth?: number;
  className?: string;
}) {
  // oxlint-disable-next-line no-inline-styles -- the column template is the caller's
  const grid = { gridTemplateColumns: template } as React.CSSProperties;
  return (
    <div className={cn('ds-gtable-scroll', className)}>
      {/* oxlint-disable-next-line no-inline-styles -- the caller's minimum width */}
      <div className="ds-gtable" style={{ minWidth }}>
        <div className="ds-gtable__head" style={grid}>
          {columns.map((column) => (
            <span key={column.key} data-align={column.align}>
              {column.label}
            </span>
          ))}
        </div>
        <div className="ds-gtable__body">
          {rows.map((row) => {
            const detail = expanded?.(row) ?? null;
            return (
              <div key={rowKey(row)} className="ds-gtable__group">
                {/* biome-ignore lint/a11y/noStaticElementInteractions: the row's own controls are its accessible actions; the click is a shortcut */}
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: as above */}
                <div
                  className="ds-gtable__row"
                  style={grid}
                  data-clickable={onRowClick ? '' : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((column) => (
                    <div key={column.key} className="ds-gtable__cell" data-align={column.align}>
                      {column.render(row)}
                    </div>
                  ))}
                </div>
                {detail !== null && <div className="ds-gtable__expand">{detail}</div>}
              </div>
            );
          })}
        </div>
        {(footer || pages > 1) && (
          <div className="ds-gtable__foot">
            <span>{footer}</span>
            {pages > 1 && page !== undefined && onPage && (
              <div className="ds-pager">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={page <= 1}
                  onClick={() => onPage(page - 1)}
                >
                  <ChevronLeft className="size-4" />
                </button>
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    data-current={n === page ? '' : undefined}
                    onClick={() => onPage(n)}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={page >= pages}
                  onClick={() => onPage(page + 1)}
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { DsGridTable };
