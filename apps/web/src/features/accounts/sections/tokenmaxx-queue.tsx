import { Switch } from '@flama/design-system-web';
import type { AccountEntity } from '@flama/frontend-consumer';
import { useAccounts } from '@flama/frontend-consumer/react';
import {
  DataTable,
  type DataTableColumn,
  GroupHeading,
  paginateRows,
  useLocale,
  useTableQuery,
} from '@flama/frontend-web';
import { useNow } from '@flama/react-hooks';
import { type AccountPace, rankAccounts } from '@flama/shared/subscriptions';
import { useTranslation } from 'react-i18next';
import { AccountIdentity } from '../components/account-identity';
import { PaceBadge } from '../components/pace-badge';
import { UsageBar } from '../components/usage-bar';
import { useSwitchAccount } from '../hooks/use-switch-account';
import { formatPercent, formatResetIn } from '../lib/format';

interface QueueRow {
  rank: number;
  account: AccountEntity;
  pace: AccountPace;
}

/** Every account in the order to use them, with how far each is from an even pace. */
export function TokenmaxxQueue() {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(60_000);
  const accounts = useAccounts();
  const switcher = useSwitchAccount();
  const query = useTableQuery({ prefix: 'queue' });

  const byId = new Map((accounts.data ?? []).map((account) => [account.id, account]));
  const queue: QueueRow[] = rankAccounts(accounts.data ?? [], new Date(now)).queue.flatMap(
    (pace, index) => {
      const account = byId.get(pace.id);
      return account ? [{ rank: index + 1, account, pace }] : [];
    },
  );
  const { rows, pagination } = paginateRows(queue, 20, query);

  const columns: DataTableColumn<QueueRow>[] = [
    { key: 'rank', label: '#', width: 48, render: (row) => row.rank },
    {
      key: 'account',
      label: t('accounts.table.account'),
      render: (row) => <AccountIdentity account={row.account} />,
    },
    {
      key: 'usage',
      label: t('accounts.queue.usage'),
      render: (row) => (
        <UsageBar
          value={row.pace.weeklyUsed}
          marker={row.pace.onPaceMark}
          label={t('accounts.queue.usage')}
        />
      ),
    },
    {
      key: 'left',
      label: t('accounts.queue.left'),
      align: 'right',
      render: (row) => formatPercent(row.pace.left),
    },
    {
      key: 'resets',
      label: t('accounts.queue.resets'),
      render: (row) => formatResetIn(row.pace.weeklyResetsAt, now, locale) ?? '—',
    },
    {
      key: 'pace',
      label: t('accounts.queue.neededPace'),
      align: 'right',
      render: (row) =>
        row.pace.neededPerDay === null
          ? '—'
          : t('accounts.queue.perDay', { value: Math.round(row.pace.neededPerDay) }),
    },
    {
      key: 'status',
      label: t('accounts.table.status'),
      render: (row) => <PaceBadge status={row.pace.status} />,
    },
    {
      key: 'active',
      label: t('accounts.table.inUse'),
      render: (row) => (
        <Switch
          checked={row.account.isActive}
          disabled={row.account.isActive || switcher.isPending}
          onCheckedChange={() => switcher.switchTo(row.account)}
          aria-label={t('accounts.table.useAccount', { name: row.account.displayName })}
        />
      ),
    },
  ];

  return (
    <section>
      <GroupHeading description={t('accounts.queue.description')}>
        {t('accounts.queue.title')}
      </GroupHeading>
      <DataTable
        columns={columns}
        rows={rows}
        getKey={(row) => row.account.id}
        pagination={pagination}
        selectable={false}
        isLoading={accounts.isLoading}
        emptyLabel={t('accounts.table.empty')}
      />
    </section>
  );
}
