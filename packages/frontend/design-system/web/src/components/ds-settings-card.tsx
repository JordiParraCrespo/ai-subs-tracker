import type * as React from 'react';
import { cn } from '../lib/utils';

/**
 * A Settings card from the design: a 48px tinted disc with the section's icon
 * beside its title, a muted line and whatever the section holds.
 */
function DsSettingsCard({
  icon,
  title,
  description,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'section'>, 'title'> & {
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <section className={cn('ds-card ds-settings-card', className)} {...props}>
      <span className="ds-settings-card__disc">{icon}</span>
      <div className="ds-settings-card__main">
        <div className="ds-settings-card__titles">
          <h2 className="ds-settings-card__title">{title}</h2>
          {description && <span className="ds-settings-card__sub">{description}</span>}
        </div>
        {children}
      </div>
    </section>
  );
}

/** The design's option tile (`OptionTile`): an icon over a label, one of a radio group. */
function DsOptionTile({
  icon,
  label,
  checked = false,
  className,
  ...props
}: Omit<React.ComponentProps<'button'>, 'children'> & {
  icon?: React.ReactNode;
  label: React.ReactNode;
  checked?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      data-checked={checked ? '' : undefined}
      className={cn('ds-option', className)}
      {...props}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export { DsOptionTile, DsSettingsCard };
