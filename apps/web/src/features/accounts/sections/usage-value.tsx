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

const width = (value: number) => ({ '--ds-w': `${value.toFixed(1)}%` }) as CSSProperties;

/**
 * "What you'd pay at API prices": everything the accounts used in the period,
 * priced at each provider's pay-as-you-go rates, in total and per account.
 * Each account's bar fills towards its plan's price and turns the accent
 * once the usage is worth what the plan costs.
 */
export function UsageValue({ query }: { query: UsageQuery }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const days = query.days ?? 30;
  const usage = useUsageSummary(days);
  const accounts = useAccounts();

  if (!usage.data || !accounts.data) return <Skeleton className="h-80 w-full rounded-2xl" />;
  const filters = filtersOf(query);
  const byId = new Map(accounts.data.map((account) => [account.id, account]));
  // The account filters choose the plans; the search only narrows the tokens.
  const rows = filterUsage(usage.data.rows, byId, modelLabels(usage.data), filters);
  const plans = valueRows(filterAccounts(accounts.data, filters), rows, days);
  const paid = plans.reduce((sum, row) => sum + row.paid, 0);
  const api = plans.reduce((sum, row) => sum + row.api, 0);

  return (
    <section className="ds-card flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="ds-body-strong">{t('accounts.value.title')}</h2>
        <span className="ds-t-sub">{t('accounts.value.sub')}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="ds-title-lg">{formatMoney(api, locale)}</span>
        <span className="ds-text-label ds-muted">
          {t('accounts.value.plans', { value: formatMoney(paid, locale), count: days })}
        </span>
      </div>
      <div className="flex flex-col gap-1 border-t border-border-default pt-4">
        {plans.map((row) => {
          const mark = accountMark(row.account);
          // How far the usage has gone towards paying for the plan: grey on
          // the way, the accent once it is worth the plan's price.
          const progress = row.ratio === null ? null : Math.round(row.ratio * 100);
          const paidOff = progress !== null && progress >= 100;
          return (
            <div key={row.account.id} className="flex flex-col gap-2 py-2.5">
              <div className="flex items-center gap-2.5">
                <DsAvatar initials={mark.initials} color={mark.color} size={24} />
                <span className="ds-label-strong min-w-0 flex-1 truncate">
                  {accountTitle(row.account)}
                  <span className="ds-muted"> · {row.account.displayName}</span>
                </span>
                <span className="ds-text-label whitespace-nowrap">
                  <span className="ds-label-strong">{formatMoney(row.api, locale)}</span>
                  {row.paid > 0 && (
                    <span className="ds-muted">
                      {' '}
                      {t('accounts.value.ofPlan', { value: formatMoney(row.paid, locale) })}
                    </span>
                  )}
                </span>
                <span
                  className={`ds-text-label w-12 text-right ${paidOff ? 'ds-t-up' : 'ds-muted'}`}
                >
                  {progress === null ? '—' : `${progress}%`}
                </span>
              </div>
              <div
                className="flex"
                role="img"
                aria-label={t('accounts.value.bar', {
                  name: accountTitle(row.account),
                  value: formatMoney(row.api, locale),
                  percent: progress ?? 0,
                })}
              >
                <div className="ds-share">
                  <div
                    className="ds-share__fill"
                    data-under={paidOff ? undefined : ''}
                    style={width(Math.min(progress ?? 0, 100))}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
