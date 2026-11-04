import {
  DsAvatar,
  DsButton,
  DsFilterSelect,
  type DsGridColumn,
  DsGridTable,
} from '@flama/design-system-web';
import { CircleDot, Flame, Layers } from '@flama/design-system-web/icons';
import { useAccounts } from '@flama/frontend-consumer/react';
import { useNow } from '@flama/react-hooks';
import { PROVIDER_IDS, type ProviderId } from '@flama/shared/subscriptions';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useResetIn } from '../hooks/use-reset-in';
import { useSwitchAccount } from '../hooks/use-switch-account';
import { PROVIDER_NAMES } from '../lib/providers';
import { type TokenmaxxRow, type TokenmaxxStatus, tokenmaxxRows } from '../lib/tokenmaxx-model';

const ICON = { className: 'size-4', strokeWidth: 1.5 } as const;
const TEMPLATE = '40px minmax(200px,1.6fr) minmax(180px,1.4fr) 80px 100px 100px 120px 76px';
const STATUSES: TokenmaxxStatus[] = ['expiring', 'under', 'track', 'hot', 'limit'];

/** The design's queue: every account in the order to use it, against an even pace. */
export function TokenmaxxQueue() {
  const { t } = useTranslation();
  const now = useNow(60_000);
  const { data: accounts = [] } = useAccounts();
  const switcher = useSwitchAccount();
  const [provider, setProvider] = useState<ProviderId | 'all'>('all');
  const [status, setStatus] = useState<TokenmaxxStatus | 'all'>('all');
  const all = tokenmaxxRows(accounts, new Date(now));
  const rows = all.filter(
    (row) =>
      (provider === 'all' || row.account.provider === provider) &&
      (status === 'all' || row.status === status),
  );

  const hours = useResetIn();

  const columns: DsGridColumn<TokenmaxxRow>[] = [
    {
      key: 'rank',
      label: '#',
      render: (row) => <span className="ds-label-strong ds-muted">{all.indexOf(row) + 1}</span>,
    },
    {
      key: 'account',
      label: t('accounts.table.account'),
      render: (row) => (
        <div className="flex min-w-0 flex-row items-center gap-3">
          <DsAvatar initials={row.initials} color={row.color} size={32} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="ds-cell-strong">{row.name}</span>
            <span className="ds-cell-sub">{row.account.displayName}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'usage',
      label: t('accounts.tm.usageWindow'),
      render: (row) => (
        <div className="flex flex-row items-center gap-2.5">
          <div className="ds-meter flex-1">
            <div
              className="ds-meter__fill ds-meter__fill--accent"
              data-hot={row.status === 'limit' ? '' : undefined}
              // oxlint-disable-next-line no-inline-styles -- the fill is the reading
              style={{ width: `${row.used.toFixed(1)}%` }}
            />
            <div
              className="ds-meter__mark ds-meter__mark--pace"
              // oxlint-disable-next-line no-inline-styles -- the even-pace mark is data
              style={{ left: `${Math.min(100, row.expected).toFixed(1)}%` }}
            />
          </div>
          <span className="ds-text-label w-9 text-right">{Math.round(row.used)}%</span>
        </div>
      ),
    },
    {
      key: 'left',
      label: t('accounts.tm.left'),
      align: 'right',
      render: (row) => <span className="ds-label-strong">{Math.round(row.left)}%</span>,
    },
    {
      key: 'resets',
      label: t('accounts.table.resets'),
      render: (row) => (
        <>
          <span className="ds-cell">{hours(row.hours)}</span>
          <span className="ds-cell-sub">{t('accounts.tm.weeklyLimit')}</span>
        </>
      ),
    },
    {
      key: 'need',
      label: t('accounts.tm.neededPace'),
      align: 'right',
      render: (row) => (
        <span className={row.need > 2 ? 'ds-text-label ds-review' : 'ds-text-label ds-secondary'}>
          {row.status === 'limit' ? '—' : t('accounts.tm.perHour', { value: row.need.toFixed(1) })}
        </span>
      ),
    },
    {
      key: 'status',
      label: t('accounts.table.status'),
      render: (row) => (
        <div className="flex">
          <span className="ds-tm-status" data-status={row.status}>
            {t(`accounts.tm.status.${row.status}`)}
          </span>
        </div>
      ),
    },
    {
      key: 'use',
      label: '',
      render: (row) => (
        <div className="flex flex-row justify-end">
          {row.account.isManual ? null : row.account.isActive ? (
            <span className="ds-in-use">
              <Flame className="size-3.5" strokeWidth={1.5} />
              {t('accounts.tm.inUse')}
            </span>
          ) : row.status !== 'limit' ? (
            <DsButton
              size="xs"
              disabled={switcher.isPending}
              onClick={() => switcher.switchTo(row.account)}
            >
              {t('accounts.group.use')}
            </DsButton>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="ds-toolbar">
        <h2 className="ds-card-header__title mr-2">{t('accounts.tm.queue')}</h2>
        <DsFilterSelect<ProviderId | 'all'>
          icon={<Layers {...ICON} />}
          options={[
            { value: 'all', label: t('accounts.tm.allTools') },
            ...PROVIDER_IDS.map((value) => ({ value, label: PROVIDER_NAMES[value] })),
          ]}
          value={provider}
          onChange={setProvider}
        />
        <DsFilterSelect<TokenmaxxStatus | 'all'>
          icon={<CircleDot {...ICON} />}
          options={[
            { value: 'all', label: t('accounts.toolbar.status.all') },
            ...STATUSES.map((value) => ({ value, label: t(`accounts.tm.status.${value}`) })),
          ]}
          value={status}
          onChange={setStatus}
        />
        <div className="flex-1" />
        <div className="ds-text-label ds-muted flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="ds-legend-used" />
            {t('accounts.tm.used')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="ds-legend-pace" />
            {t('accounts.tm.paceMark')}
          </span>
        </div>
      </div>
      <DsGridTable
        columns={columns}
        template={TEMPLATE}
        rows={rows}
        rowKey={(row) => row.account.id}
        minWidth={940}
      />
    </div>
  );
}
