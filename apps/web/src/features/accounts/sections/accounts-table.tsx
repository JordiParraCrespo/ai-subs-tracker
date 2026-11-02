import { DropdownMenuItem, Switch } from '@flama/design-system-web';
import type { AccountEntity } from '@flama/frontend-consumer';
import { useAccounts } from '@flama/frontend-consumer/react';
import {
  DataTable,
  type DataTableColumn,
  paginateRows,
  useLocale,
  useTableQuery,
} from '@flama/frontend-web';
import { useNow } from '@flama/react-hooks';
import { PROVIDER_IDS, type ProviderId, paceOf } from '@flama/shared/subscriptions';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountIdentity } from '../components/account-identity';
import { PaceBadge } from '../components/pace-badge';
import { UsageBar } from '../components/usage-bar';
import { EditAccountDialog } from '../dialogs/edit-account';
import { RemoveAccountDialog } from '../dialogs/remove-account';
import { useSwitchAccount } from '../hooks/use-switch-account';
import { formatMoney, formatPercent, formatResetIn } from '../lib/format';
import { PROVIDER_NAMES } from '../lib/providers';

const PAGE_SIZE = 20;

type Dialog = { kind: 'edit' | 'remove'; account: AccountEntity } | null;

/**
 * Every tracked account with its windows, cost and whether terminals use it.
 * The dialogs stay here: a dialog opened from a row menu cannot own its open
 * state, because the menu unmounts when it closes.
 */
export function AccountsTable() {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(60_000);
  const accounts = useAccounts();
  const switcher = useSwitchAccount();
  const query = useTableQuery<string, ProviderId>({ filters: PROVIDER_IDS });
  const [dialog, setDialog] = useState<Dialog>(null);

  const all = accounts.data ?? [];
  const filtered = query.filters.length
    ? all.filter((account) => query.filters.includes(account.provider))
    : all;
  const { rows, pagination } = paginateRows(filtered, PAGE_SIZE, query);

  const windowCell = (account: AccountEntity, kind: 'session' | 'weekly') => {
    const window = account.window(kind);
    if (!window) return <span className="text-sm text-ink-400">—</span>;
    return (
      <div className="flex min-w-32 flex-col gap-1">
        <UsageBar value={window.utilization} label={window.label} />
        <span className="text-xs text-ink-600">
          {formatPercent(window.utilization)} · {formatResetIn(window.resetsAt, now, locale)}
        </span>
      </div>
    );
  };

  const columns: DataTableColumn<AccountEntity>[] = [
    {
      key: 'account',
      label: t('accounts.table.account'),
      render: (account) => <AccountIdentity account={account} />,
    },
    { key: 'session', label: t('accounts.table.session'), render: (a) => windowCell(a, 'session') },
    { key: 'weekly', label: t('accounts.table.weekly'), render: (a) => windowCell(a, 'weekly') },
    {
      key: 'cost',
      label: t('accounts.table.cost'),
      align: 'right',
      render: (account) => formatMoney(account.monthlyPriceCents, locale),
    },
    {
      key: 'status',
      label: t('accounts.table.status'),
      render: (account) => <PaceBadge status={paceOf(account, new Date(now)).status} />,
    },
    {
      key: 'active',
      label: t('accounts.table.inUse'),
      render: (account) => (
        <Switch
          checked={account.isActive}
          disabled={account.isActive || switcher.isPending}
          onCheckedChange={() => switcher.switchTo(account)}
          aria-label={t('accounts.table.useAccount', { name: account.displayName })}
        />
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        getKey={(account) => account.id}
        pagination={pagination}
        selectable={false}
        isLoading={accounts.isLoading}
        isFetching={accounts.isFetching}
        emptyLabel={t('accounts.table.empty')}
        facets={[
          {
            label: t('accounts.table.provider'),
            options: PROVIDER_IDS.map((id) => ({ value: id, label: PROVIDER_NAMES[id] })),
            value: query.filters,
            onChange: query.setFilters,
          },
        ]}
        rowActions={(account) => (
          <>
            <DropdownMenuItem onClick={() => setDialog({ kind: 'edit', account })}>
              {t('accounts.table.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDialog({ kind: 'remove', account })}
            >
              {t('accounts.table.remove')}
            </DropdownMenuItem>
          </>
        )}
      />
      {dialog?.kind === 'edit' && (
        <EditAccountDialog account={dialog.account} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'remove' && (
        <RemoveAccountDialog account={dialog.account} onClose={() => setDialog(null)} />
      )}
    </>
  );
}
