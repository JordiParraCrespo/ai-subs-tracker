import { DsAvatar, Skeleton } from '@flama/design-system-web';
import { useAccounts, useUsageSummary } from '@flama/frontend-consumer/react';
import { useLocale } from '@flama/frontend-web';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../lib/format';
import { accountMark, accountTitle } from '../lib/marks';
import {
  filterAccounts,
  filtersOf,
  filterUsage,
  modelLabels,
  type UsageQuery,
  valueRows,
} from '../lib/usage-view';

const width = (value: number) => ({ width: `${value.toFixed(1)}%` }) as CSSProperties;

/**
 * The usage screen's first card, "Are your plans paying off?": how much of
 * what the plans cost for the period the usage has made back at API prices,
 * in total and per subscription.
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
  const left = paid - api;
  const overall = paid > 0 ? Math.min(api / paid, 1) * 100 : 0;
  const money = (cents: number) => formatMoney(cents, locale);

  return (
    <section className="ds-card flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="ds-body-strong">{t('accounts.value.title')}</h2>
        <span className="ds-cell-sub">{t('accounts.value.sub', { days })}</span>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
          <span className="ds-title-lg">
            {money(api)}
            <span className="ds-muted"> {t('accounts.value.ofPaid', { paid: money(paid) })}</span>
          </span>
          <span className={`ds-label-strong ${left <= 0 && paid > 0 ? 'ds-t-up' : 'ds-muted'}`}>
            {left > 0
              ? t('accounts.value.leftTotal', { amount: money(left) })
              : t('accounts.value.extraTotal', { amount: money(-left) })}
          </span>
        </div>
        <div
          className="ds-meter"
          role="img"
          aria-label={t('accounts.value.total', { percent: Math.round(overall) })}
        >
          <div
            className={left <= 0 ? 'ds-meter__fill' : 'ds-meter__fill ds-meter__fill--accent'}
            style={width(overall)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1 border-t border-border-default pt-3">
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
