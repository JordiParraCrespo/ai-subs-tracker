'use client';

import * as React from 'react';
import { cn } from '../lib/utils';

function useSize(ref: React.RefObject<HTMLDivElement | null>, fallback: number) {
  const [size, setSize] = React.useState({ width: fallback, height: 0 });
  // The outside system is the layout: the chart is drawn in pixels, so it
  // measures its box and follows resizes.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setSize({ width: el.clientWidth || fallback, height: el.clientHeight });
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      setSize({ width: box?.width || fallback, height: box?.height ?? 0 });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, fallback]);
  return size;
}

/**
 * The design's area chart (`designs/_ds`, `.ds-chart`): no grid and no axes;
 * the header is the legend, and hovering rewrites the value, the change and
 * the label. 2px line, a 25%→4% fill, the hatch at 28% fading downwards.
 *
 * With `fill`, the plot takes the height its flex-column parent leaves it,
 * between `height` and `maxHeight`, so a page can fit one screen: the chart
 * gives way before anything under it is pushed out of view.
 */
function DsAreaChart({
  data,
  labels = [],
  height = 240,
  fill = false,
  maxHeight = 320,
  title,
  formatValue,
  restLabel,
  tone = 'up',
  showChange = true,
  className,
}: {
  data: readonly number[];
  labels?: readonly string[];
  /** The plot's height, or its minimum with `fill`. */
  height?: number;
  fill?: boolean;
  maxHeight?: number;
  title?: React.ReactNode;
  formatValue: (value: number) => string;
  restLabel?: React.ReactNode;
  tone?: 'up' | 'down';
  /** Off where the change from the first point repeats the value, as on a running total. */
  showChange?: boolean;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const size = useSize(ref, 600);
  const w = size.width;
  const h = fill ? Math.max(height, size.height) : height;
  const [hi, setHi] = React.useState<number | null>(null);
  const uid = React.useId().replace(/:/g, '');
  const n = data.length;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const top = 8;
  const span = h * 0.72;
  const x = (i: number) => (n < 2 ? 0 : (i * w) / (n - 1));
  const y = (v: number) => top + (1 - (v - min) / (max - min || 1)) * span;
  const line = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const current = hi !== null ? data[hi] : data[n - 1];
  const diff = n ? (current ?? 0) - (data[0] ?? 0) : 0;
  const pct = data[0] ? (diff / data[0]) * 100 : 0;
  const up = diff >= 0;

  return (
    <div className={cn('ds-chart', fill && 'flex min-h-0 flex-1 flex-col', className)} data-tone={tone}>
      <div className="ds-chart__top">
        <div className="ds-chart__head">
          {title && <span className="ds-chart__label">{title}</span>}
          <span className="ds-chart__price">{n ? formatValue(current ?? 0) : '—'}</span>
          {n > 1 && (
            <span className="ds-chart__delta">
              {showChange && (
                <span className={up ? 'ds-t-up' : 'ds-t-down'}>
                  {up ? '▲' : '▼'} {formatValue(Math.abs(diff))}
                  {data[0] ? ` (${Math.abs(pct).toFixed(2)}%)` : ''}
                </span>
              )}
              <span>{hi !== null ? (labels[hi] ?? '') : restLabel}</span>
            </span>
          )}
        </div>
      </div>
      <div
        ref={ref}
        className={cn('w-full', fill && 'relative flex-1')}
        style={fill ? { minHeight: height, maxHeight } : undefined}
      >
        {n > 1 && (
          // biome-ignore lint/a11y/noSvgWithoutTitle: the header above is the chart's text
          <svg
            width={w}
            height={h}
            className={cn('cursor-crosshair', fill && 'absolute inset-0')}
            onMouseMove={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              const i = Math.round(((event.clientX - box.left) / box.width) * (n - 1));
              setHi(Math.max(0, Math.min(n - 1, i)));
            }}
            onMouseLeave={() => setHi(null)}
          >
            <defs>
              <linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="currentColor" stopOpacity=".25" />
                <stop offset="1" stopColor="currentColor" stopOpacity=".04" />
              </linearGradient>
              <pattern id={`p${uid}`} width="6" height="6" patternUnits="userSpaceOnUse">
                <path d="M5 0h1L0 6V5zM6 5v1H5z" fill="currentColor" />
              </pattern>
              <clipPath id={`c${uid}`}>
                <path d={area} />
              </clipPath>
              <linearGradient id={`mg${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff" />
                <stop offset=".4" stopColor="#fff" />
                <stop offset="1" stopColor="#000" />
              </linearGradient>
              <mask id={`m${uid}`}>
                <rect width={w} height={h} fill={`url(#mg${uid})`} />
              </mask>
            </defs>
            <path d={area} fill={`url(#g${uid})`} />
            <g clipPath={`url(#c${uid})`} mask={`url(#m${uid})`}>
              <rect width={w} height={h} fill={`url(#p${uid})`} opacity=".28" />
            </g>
            <path
              d={line}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {hi !== null && (
              <g>
                <line
                  x1={x(hi)}
                  x2={x(hi)}
                  y1="0"
                  y2={h}
                  className="ds-chart__crosshair"
                  strokeWidth="1"
                />
                <circle
                  cx={x(hi)}
                  cy={y(data[hi] ?? 0)}
                  r="4.5"
                  fill="currentColor"
                  className="ds-chart__dot"
                  strokeWidth="2"
                />
              </g>
            )}
          </svg>
        )}
      </div>
    </div>
  );
}

export { DsAreaChart };
