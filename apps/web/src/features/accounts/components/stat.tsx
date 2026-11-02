import type { ReactNode } from 'react';

/** A label over a value, the stat row under each page's headline. */
export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-sm text-ink-600">{label}</div>
      <div className="mt-1 text-xl font-medium text-ink-900">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-400">{hint}</div>}
    </div>
  );
}
