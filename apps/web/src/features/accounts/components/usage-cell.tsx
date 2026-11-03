/** A percentage over a thin track, for a table cell. The fill's width is data. */
export function UsageCell({ value, sub }: { value: number | null; sub: string }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-data-track">
          <span
            className="block h-full rounded-full bg-data-line"
            // oxlint-disable-next-line no-inline-styles -- the fill is the reading
            style={{ width: `${Math.min(100, value ?? 0)}%` }}
          />
        </span>
        <span className="ds-cell">{value === null ? '—' : `${Math.round(value)}%`}</span>
      </div>
      <span className="ds-cell-sub">{sub}</span>
    </>
  );
}
