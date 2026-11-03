import { DsAreaChart, Skeleton } from '@flama/design-system-web';
import { useAccounts, useUsageSummary } from '@flama/frontend-consumer/react';
import { dateFormatter, useLocale } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { formatCompact, formatMoney } from '../lib/format';
import {
  dailySeries,
  filterAccounts,
  filtersOf,
  filterUsage,
  modelLabels,
  paidCents,
  tokensOf,
  type UsageQuery,
} from '../lib/usage-view';

/**
 * The design's first usage card: four key figures over the filtered usage,
 * then the day-by-day chart of what it was worth at API prices, or of tokens.
 */
export function UsageSpend({ query }: { query: UsageQuery }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const days = query.days ?? 30;
  const usage = useUsageSummary(days);
  const accounts = useAccounts();

  if (!usage.data || !accounts.data) return <Skeleton className="h-100 w-full rounded-2xl" />;
  const filters = filtersOf(query);
  const byId = new Map(accounts.data.map((account) => [account.id, account]));
  const rows = filterUsage(usage.data.rows, byId, modelLabels(usage.data), filters);
  const paid = paidCents(filterAccounts(accounts.data, filters), days);
  const api = rows.reduce((sum, row) => sum + row.apiCostCents, 0);
  const tokens = rows.reduce((sum, row) => sum + tokensOf(row), 0);
  const metric = query.metric ?? 'spend';
  const series = dailySeries(rows, usage.data.since, days, metric);
  const dayLabel = dateFormatter(locale, { month: 'short', day: 'numeric' });
  const kpis = [
    { label: t('accounts.usage.kpi.paid'), value: formatMoney(paid, locale) },
    { label: t('accounts.usage.kpi.api'), value: formatMoney(api, locale) },
    { label: t('accounts.usage.kpi.tokens'), value: formatCompact(tokens, locale) },
    {
      label: t('accounts.usage.kpi.perMillion'),
      value: tokens > 0 ? formatMoney((api / tokens) * 1_000_000, locale) : '—',
    },
  ];

  return (
    <section className="ds-card flex flex-col gap-6 p-6">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(104px,1fr))] gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="flex min-w-0 flex-col gap-1">
            <span className="ds-text-label ds-muted">{kpi.label}</span>
            <span className="ds-section-value">{kpi.value}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-border-default pt-6">
        <DsAreaChart
          title={t(`accounts.usage.chart.${metric}`)}
          data={series.map((point) => point.value)}
          labels={series.map((point) => dayLabel.format(new Date(`${point.day}T12:00:00`)))}
          formatValue={(value) =>
            metric === 'spend' ? formatMoney(value, locale) : formatCompact(value, locale)
          }
          restLabel={t('accounts.usage.pastDays', { days })}
          height={160}
        />
      </div>
    </section>
  );
}
