import { Progress } from '@flama/design-system-web';

/**
 * How much of a window is used, with an optional mark where an even pace
 * would be. The mark's position is data, hence the one inline style.
 */
export function UsageBar({
  value,
  marker,
  label,
}: {
  value: number | null;
  marker?: number | null;
  label: string;
}) {
  return (
    <div className="relative w-full min-w-24">
      <Progress value={value === null ? null : Math.min(100, value)} aria-label={label} />
      {marker !== null && marker !== undefined && (
        <span
          aria-hidden
          className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-ink-900"
          // oxlint-disable-next-line no-inline-styles -- the mark sits where the data puts it
          style={{ left: `${Math.min(100, Math.max(0, marker))}%` }}
        />
      )}
    </div>
  );
}
