import type * as React from 'react';
import { cn } from '../lib/utils';

/**
 * The design's flat panel (`.ds-card`), its 56px header and its list rows
 * (`.ds-row--card`): a leading mark, a title over a muted line, and an
 * end block of value over sub-value.
 */
function DsCard({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('ds-card min-w-0 overflow-hidden', className)} {...props} />;
}

function DsCardHeader({
  title,
  action,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('ds-card-header', className)}>
      <h2 className="ds-card-header__title">{title}</h2>
      {action}
    </div>
  );
}

function DsCardRow({
  leading,
  title,
  subtitle,
  value,
  subvalue,
  onClick,
  className,
}: {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  value?: React.ReactNode;
  subvalue?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn('ds-row ds-row--card ds-card-row', className)}
    >
      {leading}
      <div className="ds-row__txt">
        <span className="ds-card-row__title">{title}</span>
        {subtitle && <span className="ds-t-sub">{subtitle}</span>}
      </div>
      {(value !== undefined || subvalue !== undefined) && (
        <div className="ds-row__end">
          {value !== undefined && <span className="ds-card-row__value">{value}</span>}
          {subvalue !== undefined && <span className="ds-t-sub">{subvalue}</span>}
        </div>
      )}
    </Tag>
  );
}

export { DsCard, DsCardHeader, DsCardRow };
