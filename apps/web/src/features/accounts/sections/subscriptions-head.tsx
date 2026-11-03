import { useAccounts } from '@flama/frontend-consumer/react';
import { PageHead, useLocale } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../lib/format';
import { monthlySpendCents } from '../lib/insights';
import { AddSubscription } from './add-subscription';

/** The page header: "N accounts · $X/mo", and Add subscription. */
export function SubscriptionsHead() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { data: accounts = [] } = useAccounts();
  return (
    <PageHead
      className="mb-0"
      title={t('accounts.list.title')}
      sub={t('accounts.list.sub', {
        count: accounts.length,
        spend: formatMoney(monthlySpendCents(accounts), locale),
      })}
      action={<AddSubscription />}
    />
  );
}
