import { DsAreaChart, DsAvatar, Skeleton } from '@flama/design-system-web';
import { useAccounts, useUsageSummary } from '@flama/frontend-consumer/react';
import { dateFormatter, useLocale } from '@flama/frontend-web';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../lib/format';
import { accountMark, accountTitle } from '../lib/marks';
import {
  cumulative,
  dailySeries,
  filterAccounts,
  filtersOf,
  filterUsage,
  modelLabels,
  type UsageQuery,
  valueRows,
} from '../lib/usage-view';

const width = (value: number) => ({ '--ds-w': `${value.toFixed(1)}%` }) as CSSProperties;

/**
 * The design's "What you'd pay at API prices": what the plans cost for the
 * period against the same usage at pay-as-you-go rates, the running total,
 * and each account's paid → API bar.
 */
export function UsageValue({ query }: { query: UsageQuery }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const days = query.days ?? 30;
  const usage = useUsageSummary(days);
  const accounts = useAccounts();

  if (!usage.data || !accounts.data) return <Skeleton className="h-120 w-full rounded-2xl" />;
  const filters = filtersOf(query);
  const byId = new Map(accounts.data.map((account) => [account.id, account]));
  // The account filters choose the plans; the search only narrows the tokens.
  const rows = filterUsage(usage.data.rows, byId, modelLabels(usage.data), filters);
  const plans = valueRows(filterAccounts(accounts.data, filters), rows, days);
  const paid = plans.reduce((sum, row) => sum + row.paid, 0);
  const api = plans.reduce((sum, row) => sum + row.api, 0);
  const saved = api - paid;
  const most = Math.max(1, ...plans.map((row) => Math.max(row.paid, row.api)));
  const series = dailySeries(rows, usage.data.since, days, 'spend');
  const running = cumulative(series.map((point) => point.value));
  const dayLabel = dateFormatter(locale, { month: 'short', day: 'numeric' });
  const figures = [
    { label: t('accounts.value.paid'), value: formatMoney(paid, locale) },
    { label: t('accounts.value.api'), value: formatMoney(api, locale) },
    {
      label: saved >= 0 ? t('accounts.value.saved') : t('accounts.value.over'),
      value: formatMoney(Math.abs(saved), locale),
      tone: saved >= 0 ? 'ds-t-up' : 'ds-t-down',
    },
    { label: t('accounts.value.multiple'), value: paid > 0 ? `${(api / paid).toFixed(1)}×` : '—' },
  ];

  return (
    <section className="ds-card flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="ds-body-strong">{t('accounts.value.title')}</h2>
        <span className="ds-cell-sub">{t('accounts.value.sub')}</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-6">
        {figures.map((figure) => (
          <div key={figure.label} className="flex flex-col gap-1">
            <span className="ds-text-label ds-muted">{figure.label}</span>
            <span className={`ds-title-lg ${figure.tone ?? ''}`}>{figure.value}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-border-default pt-6">
        <DsAreaChart
          title={t('accounts.value.chart')}
          data={running}
          labels={series.map((point) => dayLabel.format(new Date(`${point.day}T12:00:00`)))}
          formatValue={(value) => formatMoney(value, locale)}
          restLabel={t('accounts.usage.pastDays', { days })}
          height={140}
        />
      </div>
      <div className="flex flex-col gap-1 border-t border-border-default pt-4">
        <div className="ds-text-label ds-muted flex justify-end gap-4 pb-2">
          <span className="flex items-center gap-1.5">
            <span className="ds-swatch" />
            {t('accounts.value.legendPaid')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="ds-swatch" data-faint="" />
            {t('accounts.value.legendApi')}
          </span>
        </div>
        {plans.map((row) => {
          const mark = accountMark(row.account);
          const good = row.ratio === null || row.ratio >= 1;
          return (
            <div key={row.account.id} className="flex flex-col gap-2 py-2.5">
              <div className="flex items-center gap-2.5">
                <DsAvatar initials={mark.initials} color={mark.color} size={24} />
                <span className="ds-label-strong min-w-0 flex-1 truncate">
                  {accountTitle(row.account)}
                  <span className="ds-muted"> · {row.account.displayName}</span>
                </span>
                <span className="ds-text-label whitespace-nowrap">
                  <span className="ds-muted">{formatMoney(row.paid, locale)} →</span>{' '}
                  {row.api > 0 ? formatMoney(row.api, locale) : t('accounts.value.noUsage')}
                </span>
                <span
                  className={`ds-label-strong w-11 text-right ${good ? 'ds-t-up' : 'ds-t-down'}`}
                >
                  {row.ratio === null ? '—' : `${row.ratio.toFixed(1)}×`}
                </span>
              </div>
              <div
                className="ds-vbar"
                role="img"
                aria-label={t('accounts.value.bar', { name: accountTitle(row.account) })}
              >
                <div className="ds-vbar__api" style={width((row.api / most) * 100)} />
                <div
                  className="ds-vbar__paid"
                  data-over={good ? undefined : ''}
                  style={width((row.paid / most) * 100)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
