import { Badge } from '@flama/design-system-web';
import type { PaceStatus } from '@flama/shared/subscriptions';
import { useTranslation } from 'react-i18next';

const VARIANT = {
  limit: 'ended',
  expiring: 'paused',
  behind: 'draft',
  on_pace: 'active',
  ahead: 'active',
  unknown: 'neutral',
} as const satisfies Record<PaceStatus, string>;

export function PaceBadge({ status }: { status: PaceStatus }) {
  const { t } = useTranslation();
  return <Badge variant={VARIANT[status]}>{t(`accounts.pace.${status}`)}</Badge>;
}
