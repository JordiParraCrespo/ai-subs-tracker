import { Skeleton } from '@flama/design-system-web';
import { useAccounts, useUsageSummary } from '@flama/frontend-consumer/react';
import { useLocale } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { Stat } from '../components/stat';
import { formatMoney } from '../lib/format';
import { monthlySpendCents, wastedLastMonthCents } from '../lib/insights';

/** Monthly spend, and what it bought: run rate, accounts, value at API prices, waste. */
export function OverviewHeadline() {
  const { t } = useTranslation();
  const locale = useLocale();
  const accounts = useAccounts();
  const usage = useUsageSummary(30);

  if (!accounts.data) return <Skeleton className="mb-10 h-40 w-full" />;

  const spend = monthlySpendCents(accounts.data);
  const wasted = wastedLastMonthCents(accounts.data);
  const apiValue = usage.data?.totals.apiCostCents;
  const ratio = apiValue !== undefined && spend > 0 ? apiValue / spend : undefined;

  return (
    <section className="mb-10">
      <div className="text-sm text-ink-600">{t('accounts.overview.monthlySpend')}</div>
      <div className="mt-1 text-4xl font-medium tracking-tight text-ink-900">
        {formatMoney(spend, locale)}
      </div>
      <div className="mt-8 grid grid-cols-2 gap-6 border-t border-border-subtle pt-6 md:grid-cols-4">
        <Stat label={t('accounts.overview.runRate')} value={formatMoney(spend * 12, locale)} />
        <Stat
          label={t('accounts.overview.accounts')}
          value={t('accounts.overview.accountCount', { count: accounts.data.length })}
        />
        {ratio !== undefined && apiValue !== undefined && (
          <Stat
            label={t('accounts.overview.valuePerDollar')}
            value={`${ratio.toFixed(1)}×`}
            hint={t('accounts.overview.apiValue', { value: formatMoney(apiValue, locale) })}
          />
        )}
        <Stat
          label={t('accounts.overview.wasted')}
          value={<span className="text-data-down">{formatMoney(wasted, locale)}</span>}
          hint={t('accounts.overview.wastedHint')}
        />
      </div>
    </section>
  );
}
