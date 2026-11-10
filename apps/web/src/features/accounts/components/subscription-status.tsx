import { DsStatusBadge } from '@flama/design-system-web';
import { useTranslation } from 'react-i18next';
import type { SubscriptionStatus } from '../lib/subscriptions';

/**
 * The status cell: the design's live Active pill, the review wash, or the red
 * limit pill. `reason` is what the last reading said (why it is not active),
 * shown on hover.
 */
export function SubscriptionStatusPill({
  status,
  reason,
}: {
  status: SubscriptionStatus;
  reason?: string | null;
}) {
  const { t } = useTranslation();
  if (status === 'active') return <DsStatusBadge>{t('accounts.status.active')}</DsStatusBadge>;
  const title = reason ?? undefined;
  if (status === 'limit')
    return (
      <span className="ds-negative-pill" title={title}>
        {t('accounts.status.limit')}
      </span>
    );
  return (
    <span className="ds-review-pill" title={title} data-testid="status-pill">
      {t(`accounts.status.${status}`)}
    </span>
  );
}
