import { LoaderCircle } from '@flama/design-system-web/icons';
import type { ReactNode } from 'react';

/** The card a sign-in step shows while the provider has not answered yet. */
export function WaitingCard({ title, detail }: { title: string; detail: ReactNode }) {
  return (
    <div className="ds-wait-card" role="status">
      <span className="ds-disc">
        <LoaderCircle />
      </span>
      <span className="ds-wait-card__meta">
        <span className="ds-label-strong">{title}</span>
        <span className="ds-t-sub">{detail}</span>
      </span>
    </div>
  );
}
