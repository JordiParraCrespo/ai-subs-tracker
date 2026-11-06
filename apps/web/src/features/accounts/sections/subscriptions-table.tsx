import { DsAvatar, type DsGridColumn, DsGridTable } from '@flama/design-system-web';
import { useAccounts } from '@flama/frontend-consumer/react';
import { dateFormatter, useLocale } from '@flama/frontend-web';
import { useNow } from '@flama/react-hooks';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { SubscriptionStatusPill } from '../components/subscription-status';
import { UsageCell } from '../components/usage-cell';
import { formatMoney, formatResetIn } from '../lib/format';
import { accountMark, accountTitle } from '../lib/marks';
import {
  type SubscriptionRow,
  type SubscriptionsQuery,
  subscriptionRows,
} from '../lib/subscriptions';
import { SubscriptionsToolbar } from './subscriptions-toolbar';

const PAGE_SIZE = 8;
// The minimums hold each column's English copy (avatar and a plan name, the
// usage bar and its percentage, "5-hour window", "Monthly cost", "in 3 days")
// and add up to 652px, so the table fits the desktop window at ~1150px with
// the sidebar open; the fr shares give the longer Spanish copy its room on a
// wide screen. Status is fixed at the widest badge in either locale.
const TEMPLATE =
  'minmax(168px,2.4fr) minmax(124px,1.2fr) minmax(96px,1fr) minmax(88px,0.9fr) minmax(72px,1fr) 104px';

/** The design's Subscriptions list: toolbar, result line, and the grid of accounts. */
export function SubscriptionsTable({
  query,
  onQuery,
}: {
  query: SubscriptionsQuery;
  onQuery: (next: SubscriptionsQuery) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(60_000);
  const navigate = useNavigate();
  const { data: accounts = [] } = useAccounts();
  const rows = subscriptionRows(accounts, query, new Date(now));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(query.page ?? 1, pages);
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const day = dateFormatter(locale, { month: 'short', day: 'numeric' });

  const columns: DsGridColumn<SubscriptionRow>[] = [
    {
      key: 'account',
      label: t('accounts.table.account'),
      render: ({ account }) => {
        const mark = accountMark(account);
        return (
          <div className="flex min-w-0 flex-row items-center gap-3">
            <DsAvatar initials={mark.initials} color={mark.color} size={32} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="ds-cell-strong">{accountTitle(account)}</span>
              <span className="ds-cell-sub">{account.displayName}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'weekly',
      label: t('accounts.table.weekly'),
      render: ({ account, pace }) => (
        <UsageCell
          value={pace.weeklyUsed}
          sub={
            !account.isManual
              ? t('accounts.table.weeklySub')
              : account.latest
                ? t('accounts.table.manual')
                : t('accounts.table.notRecorded')
          }
        />
      ),
    },
    {
      key: 'session',
      label: t('accounts.table.session'),
      render: ({ pace }) => (
        <>
          <span className="ds-cell">
            {pace.sessionUsed === null ? '—' : `${Math.round(pace.sessionUsed)}%`}
          </span>
          <span className="ds-cell-sub">
            {pace.sessionUsed === null
              ? t('accounts.table.noSession')
              : t('accounts.table.sessionSub')}
          </span>
        </>
      ),
    },
    {
      key: 'cost',
      label: t('accounts.table.cost'),
      align: 'right',
      render: ({ account }) => (
        <>
          <span className="ds-cell-money">{formatMoney(account.monthlyPriceCents, locale)}</span>
          <span className="ds-cell-sub">
            {account.priceOverridden
              ? t('accounts.table.yourPrice')
              : t('accounts.table.listPrice')}
          </span>
        </>
      ),
    },
    {
      key: 'resets',
      label: t('accounts.table.resets'),
      render: ({ pace }) =>
        pace.weeklyResetsAt ? (
          <>
            <span className="ds-cell">{day.format(new Date(pace.weeklyResetsAt))}</span>
            <span className="ds-cell-sub">{formatResetIn(pace.weeklyResetsAt, now, locale)}</span>
          </>
        ) : (
          <span className="ds-cell-sub">—</span>
        ),
    },
    {
      key: 'status',
      label: t('accounts.table.status'),
      render: ({ status }) => (
        <div className="flex">
          <SubscriptionStatusPill status={status} />
        </div>
      ),
    },
  ];

  return (
    <>
      <SubscriptionsToolbar
        query={query}
        onQuery={onQuery}
        shown={rows.length}
        total={accounts.length}
      />
      <DsGridTable
        columns={columns}
        template={TEMPLATE}
        rows={shown}
        rowKey={(row) => row.account.id}
        onRowClick={(row) =>
          navigate({ to: '/accounts/$provider', params: { provider: row.account.provider } })
        }
        footer={t('accounts.table.range', {
          from: rows.length ? (page - 1) * PAGE_SIZE + 1 : 0,
          to: (page - 1) * PAGE_SIZE + shown.length,
          total: rows.length,
        })}
        page={page}
        pages={pages}
        onPage={(next) => onQuery({ ...query, page: next })}
      />
    </>
  );
}
