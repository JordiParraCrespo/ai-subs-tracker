import { cn } from '@flama/design-system-web';

/**
 * The heading every page opens with (the design's page header): a 20px title,
 * a 14px muted line under it, and an optional action on the right.
 */
export function PageHead({
  title,
  sub,
  action,
  className,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-6 flex flex-wrap items-center justify-between gap-4', className)}>
      <div className="flex min-w-60 flex-[1_1_320px] flex-col gap-1">
        <h1 className="text-xl font-medium tracking-tight text-ink-900">{title}</h1>
        {sub && <p className="text-sm text-pretty text-ink-600">{sub}</p>}
      </div>
      {action && <div className="flex-none">{action}</div>}
    </header>
  );
}
