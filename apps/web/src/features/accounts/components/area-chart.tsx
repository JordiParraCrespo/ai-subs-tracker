/**
 * The design's area chart: a 2px line over a fading fill, no axes and no
 * grid — the header above it is the legend. Values are plotted left to right
 * at even spacing.
 */
export function AreaChart({ values, label }: { values: readonly number[]; label: string }) {
  const width = 600;
  const height = 160;
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const points = values.map((value, index) => [
    index * step,
    height - 8 - (value / max) * (height - 16),
  ]);
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className="h-40 w-full text-data-line"
    >
      <defs>
        <linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <g>
        <path d={area} fill="url(#area-fill)" />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  );
}
