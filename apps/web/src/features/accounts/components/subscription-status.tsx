import { DsStatusBadge } from '@flama/design-system-web';
import { useTranslation } from 'react-i18next';
import type { SubscriptionStatus } from '../lib/subscriptions';

/** The status cell: the design's live Active pill, the review wash, or the red limit pill. */
export function SubscriptionStatusPill({ status }: { status: SubscriptionStatus }) {
  const { t } = useTranslation();
  if (status === 'active') return <DsStatusBadge>{t('accounts.status.active')}</DsStatusBadge>;
  if (status === 'limit')
    return <span className="ds-negative-pill">{t('accounts.status.limit')}</span>;
  return <span className="ds-review-pill">{t(`accounts.status.${status}`)}</span>;
}
