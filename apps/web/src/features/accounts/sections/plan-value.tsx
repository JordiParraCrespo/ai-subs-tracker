import { Card, CardContent, CardHeader, CardTitle } from '@flama/design-system-web';
import { useAccounts, useUsageSummary } from '@flama/frontend-consumer/react';
import { useLocale } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { AccountIdentity } from '../components/account-identity';
import { UsageBar } from '../components/usage-bar';
import { formatMoney } from '../lib/format';

/** Per account: what the plan cost for the period against the same usage at API prices. */
export function PlanValue({ days }: { days: number }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const usage = useUsageSummary(days);
  const { data: accounts = [] } = useAccounts();
  const valueById = new Map(
    (usage.data?.byAccount ?? []).map((row) => [row.accountId, row.apiCostCents]),
  );
  const rows = accounts
    .map((account) => {
      const paid = (account.monthlyPriceCents * days) / 30.44;
      const value = valueById.get(account.id) ?? 0;
      return { account, paid, value, ratio: paid > 0 ? value / paid : null };
    })
    .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0));
  const most = Math.max(1, ...rows.map((row) => Math.max(row.paid, row.value)));

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>{t('accounts.value.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {rows.map((row) => (
          <div key={row.account.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4">
              <AccountIdentity account={row.account} />
              <div className="text-right text-sm text-ink-600">
                {formatMoney(row.paid, locale)} → {formatMoney(row.value, locale)}
                {row.ratio !== null && (
                  <span className={row.ratio >= 1 ? 'ml-3 text-data-up' : 'ml-3 text-data-down'}>
                    {row.ratio.toFixed(1)}×
                  </span>
                )}
              </div>
            </div>
            <UsageBar
              value={(row.value / most) * 100}
              marker={(row.paid / most) * 100}
              label={t('accounts.value.bar', { name: row.account.displayName })}
            />
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-ink-600">{t('accounts.table.empty')}</p>}
      </CardContent>
    </Card>
  );
}
