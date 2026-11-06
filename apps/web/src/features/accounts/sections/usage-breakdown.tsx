import { type DsGridColumn, DsGridTable, DsSegmented } from '@flama/design-system-web';
import { useAccounts, useUsageSummary } from '@flama/frontend-consumer/react';
import { useLocale } from '@flama/frontend-web';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCompact, formatMoney } from '../lib/format';
import { PROVIDER_NAMES } from '../lib/providers';
import {
  filtersOf,
  filterUsage,
  type GroupRow,
  groupUsage,
  modelLabels,
  USAGE_GROUPS,
  type UsageGroup,
  type UsageQuery,
} from '../lib/usage-view';

const PAGE_SIZE = 8;
const TEMPLATE = 'minmax(200px,2fr) 90px 90px 100px 100px minmax(120px,1fr)';

/** The design's "Group by" table: tokens, messages and API value per model, account or provider. */
export function UsageBreakdown({
  query,
  onQuery,
}: {
  query: UsageQuery;
  onQuery: (next: UsageQuery) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const days = query.days ?? 30;
  const usage = useUsageSummary(days);
  const { data: accounts = [] } = useAccounts();
  const group = query.group ?? 'model';
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const labels = usage.data ? modelLabels(usage.data) : new Map<string, string>();
  const filtered = filterUsage(usage.data?.rows ?? [], byId, labels, filtersOf(query));
  const rows = groupUsage(filtered, byId, labels, group);
  const total = rows.reduce((sum, row) => sum + row.cost, 0);
  const top = rows[0]?.cost || 1;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(query.page ?? 1, pages);
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const sub = (row: GroupRow) => {
    if (group === 'model' && row.provider)
      return `${PROVIDER_NAMES[row.provider]} · ${t('accounts.usage.accountCount', { count: row.spans })}`;
    if (group === 'account') return byId.get(row.key)?.displayName ?? '';
    return t('accounts.usage.modelCount', { count: row.spans });
  };

  const columns: DsGridColumn<GroupRow>[] = [
    {
      key: 'name',
      label: t(`accounts.usage.group.${group}`),
      render: (row) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="ds-cell-strong">{row.name}</span>
          <span className="ds-cell-sub">{sub(row)}</span>
        </div>
      ),
    },
    {
      key: 'input',
      label: t('accounts.models.input'),
      align: 'right',
      render: (row) => formatCompact(row.input, locale),
    },
    {
      key: 'output',
      label: t('accounts.models.output'),
      align: 'right',
      render: (row) => (row.output ? formatCompact(row.output, locale) : '—'),
    },
    {
      key: 'messages',
      label: t('accounts.usage.messages'),
      align: 'right',
      render: (row) => formatCompact(row.messages, locale),
    },
    {
      key: 'cost',
      label: t('accounts.models.cost'),
      align: 'right',
      render: (row) => <span className="ds-cell-money">{formatMoney(row.cost, locale)}</span>,
    },
    {
      key: 'share',
      label: t('accounts.models.share'),
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="ds-share">
            <div
              className="ds-share__fill"
              style={{ '--ds-w': `${((row.cost / top) * 100).toFixed(1)}%` } as CSSProperties}
            />
          </div>
          <span className="ds-text-label ds-muted w-9 text-right">
            {total > 0 ? `${Math.round((row.cost / total) * 100)}%` : '—'}
          </span>
        </div>
      ),
    },
  ];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="ds-text-label ds-muted">{t('accounts.usage.groupBy')}</span>
          <DsSegmented<UsageGroup>
            options={USAGE_GROUPS.map((value) => ({
              value,
              label: t(`accounts.usage.group.${value}`),
            }))}
            value={group}
            onChange={(next) => onQuery({ ...query, group: next, page: undefined })}
          />
        </div>
        <span className="ds-text-label ds-muted">
          {t(`accounts.usage.groupCount.${group}`, { count: rows.length })}
        </span>
      </div>
      <DsGridTable
        columns={columns}
        template={TEMPLATE}
        rows={shown}
        rowKey={(row) => row.key}
        footer={
          rows.length
            ? t('accounts.table.range', {
                from: (page - 1) * PAGE_SIZE + 1,
                to: (page - 1) * PAGE_SIZE + shown.length,
                total: rows.length,
              })
            : t('accounts.usage.noResults')
        }
        page={page}
        pages={pages}
        onPage={(next) => onQuery({ ...query, page: next > 1 ? next : undefined })}
      />
      {usage.data && rows.length === 0 && (
        <p className="ds-text-label ds-muted m-0 text-center">{t('accounts.usage.noMatch')}</p>
      )}
    </section>
  );
}
