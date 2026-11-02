import type * as React from 'react';
import { cn } from '../lib/utils';

export interface DsTableColumn<TRow> {
  key: string;
  label: React.ReactNode;
  align?: 'left' | 'right';
  width?: number | string;
  render: (row: TRow) => React.ReactNode;
}

/** The design's table (`.ds-table`): header on a tinted band, the body as a rounded card inside it. */
function DsTable<TRow>({
  columns,
  rows,
  rowKey,
  onRowClick,
  className,
}: {
  columns: readonly DsTableColumn<TRow>[];
  rows: readonly TRow[];
  rowKey: (row: TRow) => string;
  onRowClick?: (row: TRow) => void;
  className?: string;
}) {
  return (
    <div className={cn('ds-table', className)}>
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                data-align={column.align}
                // oxlint-disable-next-line no-inline-styles -- a column's width is the caller's
                style={column.width ? { width: column.width } : undefined}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              data-clickable={onRowClick ? '' : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((column) => (
                <td key={column.key} data-align={column.align}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { DsTable };
