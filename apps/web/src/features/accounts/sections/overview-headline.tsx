import { DsAreaChart, DsStatGrid, Skeleton } from '@flama/design-system-web';
import { useAccounts, useUsageSummary } from '@flama/frontend-consumer/react';
import { dateFormatter, useLocale } from '@flama/frontend-web';
import { useNow } from '@flama/react-hooks';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../lib/format';
import { monthlySpendHistory } from '../lib/history';
import { monthlySpendCents, wastedLastMonthCents } from '../lib/insights';

/**
 * The design's overview head: monthly spend over the past twelve months as
 * the hatched area chart, then the four key figures under a divider.
 */
export function OverviewHeadline() {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(3_600_000);
  const accounts = useAccounts();
  const usage = useUsageSummary(30);

  if (!accounts.data) return <Skeleton className="h-96 w-full" />;
  const history = monthlySpendHistory(accounts.data, new Date(now));
  const monthLabel = dateFormatter(locale, { month: 'short', year: 'numeric' });
  const spend = monthlySpendCents(accounts.data);
  const wasted = wastedLastMonthCents(accounts.data);
  const apiValue = usage.data?.totals.apiCostCents;

  return (
    // Grows into the page's spare height, and the chart takes it, so the
    // cards under it stay on screen on a laptop.
    <section className="flex flex-1 flex-col gap-6 [@media(max-height:800px)]:gap-4">
      <DsAreaChart
        title={t('accounts.overview.monthlySpend')}
        data={history.map((point) => point.cents)}
        labels={history.map((point) => monthLabel.format(point.month))}
        formatValue={(cents) => formatMoney(cents, locale)}
        restLabel={t('accounts.overview.past12')}
        height={72}
        maxHeight={240}
        fill
      />
      <div className="border-t border-border-default pt-6 [@media(max-height:800px)]:pt-4">
        <DsStatGrid
          columns={4}
          items={[
            { label: t('accounts.overview.runRate'), value: formatMoney(spend * 12, locale) },
            {
              label: t('accounts.overview.subscriptions'),
              value: t('accounts.overview.accountCount', { count: accounts.data.length }),
            },
            {
              label: t('accounts.overview.valuePerDollar'),
              value:
                apiValue !== undefined && spend > 0
                  ? formatMoney((apiValue / spend) * 100, locale)
                  : '—',
            },
            {
              label: t('accounts.overview.savings'),
              value: formatMoney(wasted, locale),
              tone: 'positive',
            },
          ]}
        />
      </div>
    </section>
  );
}
