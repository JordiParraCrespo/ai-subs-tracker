import { DsButton } from '@flama/design-system-web';
import { useAccounts } from '@flama/frontend-consumer/react';
import { PageHead, useLocale } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../lib/format';
import { monthlySpendCents } from '../lib/insights';
import { AddAccountMenu } from './add-account-menu';

/** The page header: "N accounts · $X/mo", and Add account where the desktop app can sign one in. */
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
      action={
        <AddAccountMenu trigger={(props) => <DsButton variant="primary" size="sm" {...props} />} />
      }
    />
  );
}
