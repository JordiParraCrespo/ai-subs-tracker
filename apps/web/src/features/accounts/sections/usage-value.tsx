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

const width = (value: number) => ({ width: `${value.toFixed(1)}%` }) as CSSProperties;

/**
 * The usage screen's "Are your plans paying off?": what the plans cost for the
 * period against the same usage at pay-as-you-go rates, the running total,
 * and per subscription how much of what was paid the usage has made back.
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
  const series = dailySeries(rows, usage.data.since, days, 'spend');
  const running = cumulative(series.map((point) => point.value));
  const dayLabel = dateFormatter(locale, { month: 'short', day: 'numeric' });
  const money = (cents: number) => formatMoney(cents, locale);
  const figures = [
    { label: t('accounts.value.paid'), value: money(paid) },
    { label: t('accounts.value.api'), value: money(api) },
    {
      label: saved >= 0 ? t('accounts.value.saved') : t('accounts.value.unused'),
      value: money(Math.abs(saved)),
      tone: saved > 0 ? 'ds-t-up' : '',
    },
    {
      label: t('accounts.value.perDollar'),
      value: paid > 0 ? money((api / paid) * 100) : '—',
    },
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
            <span className={`ds-title-lg ${figure.tone}`}>{figure.value}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-border-default pt-6">
        <DsAreaChart
          title={t('accounts.value.chart')}
          data={running}
          labels={series.map((point) => dayLabel.format(new Date(`${point.day}T12:00:00`)))}
          formatValue={money}
          restLabel={t('accounts.usage.pastDays', { days })}
          height={140}
        />
      </div>
      <div className="flex flex-col gap-1 border-t border-border-default pt-4">
        {plans.map((row) => {
          const mark = accountMark(row.account);
          const name = accountTitle(row.account);
          const percent = row.ratio === null ? null : Math.round(row.ratio * 100);
          const paidOff = row.ratio !== null && row.ratio >= 1;
          const note =
            row.ratio === null
              ? t('accounts.value.noPrice')
              : paidOff
                ? t('accounts.value.paidOff', { amount: money(row.api - row.paid) })
                : row.api > 0
                  ? t('accounts.value.left', { amount: money(row.paid - row.api) })
                  : t('accounts.value.noUsage');
          return (
            <div key={row.account.id} className="flex flex-col gap-2 py-2.5">
              <div className="flex items-center gap-2.5">
                <DsAvatar initials={mark.initials} color={mark.color} size={24} />
                <span className="ds-label-strong min-w-0 flex-1 truncate">
                  {name}
                  <span className="ds-muted"> · {row.account.displayName}</span>
                </span>
                <span className="ds-text-label ds-muted whitespace-nowrap">
                  {row.ratio === null
                    ? money(row.api)
                    : t('accounts.value.usedOf', { used: money(row.api), paid: money(row.paid) })}
                </span>
                <span className={`ds-label-strong w-12 text-right ${paidOff ? 'ds-t-up' : ''}`}>
                  {percent === null ? '—' : `${percent}%`}
                </span>
              </div>
              <div
                className="ds-meter"
                role="img"
                aria-label={t('accounts.value.bar', { name, percent: percent ?? 0 })}
              >
                <div
                  className={paidOff ? 'ds-meter__fill' : 'ds-meter__fill ds-meter__fill--accent'}
                  style={width(Math.min(row.ratio ?? 0, 1) * 100)}
                />
              </div>
              <span className={`ds-cell-sub ${paidOff ? 'ds-t-up' : ''}`}>{note}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
