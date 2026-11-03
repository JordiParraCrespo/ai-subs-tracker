import type * as React from 'react';
import { cn } from '../lib/utils';

/**
 * The design's state card: a page with nothing to show, or a page that could
 * not be shown. A 56px disc with the icon, an optional eyebrow ("Error 404"),
 * the title, one line of text and its actions, centred in a card. `status`
 * is the taller one that stands in for a whole page (not found, an error,
 * offline); `empty` sits where a page's content will appear (first run).
 */
function DsStateCard({
  icon,
  eyebrow,
  title,
  text,
  actions,
  variant = 'empty',
  className,
}: {
  icon: React.ReactNode;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  text?: React.ReactNode;
  actions?: React.ReactNode;
  variant?: 'status' | 'empty';
  className?: string;
}) {
  const Title = variant === 'status' ? 'h1' : 'h2';
  return (
    <div className={cn('ds-card ds-state', `ds-state--${variant}`, className)}>
      <div className="ds-state__body">
        <span className="ds-disc ds-state__disc">{icon}</span>
        <div className="ds-state__text">
          {eyebrow && <span className="ds-state__eyebrow">{eyebrow}</span>}
          <Title className="ds-state__title">{title}</Title>
          {text && <p className="ds-state__line">{text}</p>}
        </div>
        {actions && <div className="ds-state__actions">{actions}</div>}
      </div>
    </div>
  );
}

export { DsStateCard };
