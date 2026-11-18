/**
 * One limit of a plan, laid out the way Claude's own usage page shows it: the
 * limit's name over its reset on the left, the bar in the middle, the share
 * used on the right. Narrow cards wrap the bar onto its own line. The fill and
 * the average's mark are data.
 */
export function LimitRow({
  label,
  sub,
  used,
  usedLabel,
  mark,
}: {
  label: string;
  sub: string;
  used: number | null;
  usedLabel: string;
  /** Where the group's average sits on this bar, as a CSS length. */
  mark?: string;
}) {
  const fill = used ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <div className="flex min-w-32 flex-[1_1_8rem] flex-col gap-0.5">
        <span className="ds-label-strong truncate">{label}</span>
        <span className="ds-t-sub truncate">{sub}</span>
      </div>
      <div className="ds-meter flex-[3_1_10rem]">
        <div
          className="ds-meter__fill"
          data-hot={fill >= 90 ? '' : undefined}
          // oxlint-disable-next-line no-inline-styles -- the fill is the reading
          style={{ width: `${Math.min(100, fill)}%` }}
        />
        {mark && (
          // oxlint-disable-next-line no-inline-styles -- the average is data
          <div className="ds-meter__mark" style={{ left: mark }} />
        )}
      </div>
      <span className="ds-t-sub shrink-0">{usedLabel}</span>
    </div>
  );
}
