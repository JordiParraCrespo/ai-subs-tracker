/**
 * A percentage over a thin track, for a table cell. The fill's width is data,
 * and so is the optional mark: where use would be on an even pace through the
 * window, so a fill short of it is behind and one past it is ahead.
 */
export function UsageCell({
  value,
  sub,
  mark = null,
  markLabel,
}: {
  value: number | null;
  sub: string;
  mark?: number | null;
  markLabel?: string;
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="relative h-1.5 w-20 rounded-full bg-data-track">
          <span
            className="block h-full rounded-full bg-data-line"
            // oxlint-disable-next-line no-inline-styles -- the fill is the reading
            style={{ width: `${Math.min(100, value ?? 0)}%` }}
          />
          {mark !== null && value !== null && (
            <span
              className="ds-meter__mark"
              title={markLabel}
              // oxlint-disable-next-line no-inline-styles -- the even-pace mark is data
              style={{ left: `${Math.min(100, Math.max(0, mark)).toFixed(1)}%` }}
            />
          )}
        </span>
        <span className="ds-cell">{value === null ? '—' : `${Math.round(value)}%`}</span>
      </div>
      <span className="ds-cell-sub">{sub}</span>
    </>
  );
}
