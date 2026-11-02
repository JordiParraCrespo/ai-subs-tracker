import { Card, CardContent, CardHeader, CardTitle } from '@flama/design-system-web';
import { useAccounts } from '@flama/frontend-consumer/react';
import { useLocale } from '@flama/frontend-web';
import { useNow } from '@flama/react-hooks';
import { useTranslation } from 'react-i18next';
import { AccountIdentity } from '../components/account-identity';
import { formatPercent, formatResetIn } from '../lib/format';
import { upcomingResets } from '../lib/insights';

/** Weekly resets coming up: what is left on each account before it rolls over. */
export function UpcomingResets() {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(60_000);
  const { data: accounts = [] } = useAccounts();
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const resets = upcomingResets(accounts, new Date(now)).slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('accounts.resets.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border-subtle">
        {resets.length === 0 && (
          <p className="py-3 text-sm text-ink-600">{t('accounts.resets.empty')}</p>
        )}
        {resets.map((pace) => {
          const account = byId.get(pace.id);
          if (!account) return null;
          return (
            <div key={pace.id} className="flex items-center justify-between gap-4 py-3">
              <AccountIdentity account={account} />
              <div className="text-right text-sm">
                <div className="font-medium text-ink-900">
                  {t('accounts.resets.left', { left: formatPercent(pace.left) })}
                </div>
                <div className="text-ink-600">
                  {formatResetIn(pace.weeklyResetsAt, now, locale)}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
