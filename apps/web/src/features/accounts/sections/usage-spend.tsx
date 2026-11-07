import { DsAreaChart, Skeleton } from '@flama/design-system-web';
import { useAccounts, useUsageSummary } from '@flama/frontend-consumer/react';
import { dateFormatter, useLocale } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { formatCompact, formatMoney } from '../lib/format';
import {
  cumulative,
  dailySeries,
  filtersOf,
  filterUsage,
  modelLabels,
  tokensOf,
  type UsageQuery,
} from '../lib/usage-view';

/**
 * The usage screen's chart: what the filtered usage has added up to over the
 * period, at API prices or in tokens, with the tokens and their average price.
 */
export function UsageSpend({ query }: { query: UsageQuery }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const days = query.days ?? 30;
  const usage = useUsageSummary(days);
  const accounts = useAccounts();

  if (!usage.data || !accounts.data) return <Skeleton className="h-100 w-full rounded-2xl" />;
  const byId = new Map(accounts.data.map((account) => [account.id, account]));
  const rows = filterUsage(usage.data.rows, byId, modelLabels(usage.data), filtersOf(query));
  const api = rows.reduce((sum, row) => sum + row.apiCostCents, 0);
  const tokens = rows.reduce((sum, row) => sum + tokensOf(row), 0);
  const metric = query.metric ?? 'spend';
  const series = dailySeries(rows, usage.data.since, days, metric);
  const dayLabel = dateFormatter(locale, { month: 'short', day: 'numeric' });
  const stats = [
    { label: t('accounts.usage.kpi.tokens'), value: formatCompact(tokens, locale) },
    {
      label: t('accounts.usage.kpi.perMillion'),
      value: tokens > 0 ? formatMoney((api / tokens) * 1_000_000, locale) : '—',
    },
  ];

  return (
    <section className="ds-card flex flex-col gap-6 p-6">
      <DsAreaChart
        title={t(`accounts.usage.chart.${metric}`)}
        data={cumulative(series.map((point) => point.value))}
        labels={series.map((point) => dayLabel.format(new Date(`${point.day}T12:00:00`)))}
        formatValue={(value) =>
          metric === 'spend' ? formatMoney(value, locale) : formatCompact(value, locale)
        }
        restLabel={t('accounts.usage.pastDays', { days })}
        height={160}
        showChange={false}
      />
      <div className="flex flex-wrap gap-x-10 gap-y-3 border-t border-border-default pt-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-0.5">
            <span className="ds-text-label ds-muted">{stat.label}</span>
            <span className="ds-label-strong">{stat.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
