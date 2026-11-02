import { useUsageSummary } from '@flama/frontend-consumer/react';
import {
  DataTable,
  type DataTableColumn,
  GroupHeading,
  paginateRows,
  useLocale,
  useTableQuery,
} from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { UsageBar } from '../components/usage-bar';
import { formatCompact, formatMoney } from '../lib/format';

type ModelRow = {
  model: string;
  label: string | null;
  input: number;
  output: number;
  cacheRead: number;
  messages: number;
  apiCostCents: number;
};

/** Tokens per model over the period, and each model's share of the API-equivalent cost. */
export function ModelUsage({ days }: { days: number }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const usage = useUsageSummary(days);
  const query = useTableQuery({ prefix: 'models' });
  const all = usage.data?.byModel ?? [];
  const total = usage.data?.totals.apiCostCents ?? 0;
  const { rows, pagination } = paginateRows<ModelRow>(all, 20, query);

  const columns: DataTableColumn<ModelRow>[] = [
    {
      key: 'model',
      label: t('accounts.models.model'),
      render: (row) => (
        <div>
          <div className="text-sm font-medium text-ink-900">{row.label ?? row.model}</div>
          <div className="text-xs text-ink-600">{row.model}</div>
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
      render: (row) => formatCompact(row.output, locale),
    },
    {
      key: 'cache',
      label: t('accounts.models.cacheRead'),
      align: 'right',
      render: (row) => formatCompact(row.cacheRead, locale),
    },
    {
      key: 'cost',
      label: t('accounts.models.cost'),
      align: 'right',
      render: (row) => formatMoney(row.apiCostCents, locale),
    },
    {
      key: 'share',
      label: t('accounts.models.share'),
      render: (row) => (
        <UsageBar
          value={total > 0 ? (row.apiCostCents / total) * 100 : 0}
          label={t('accounts.models.share')}
        />
      ),
    },
  ];

  return (
    <section>
      <GroupHeading>{t('accounts.models.title')}</GroupHeading>
      <DataTable
        columns={columns}
        rows={rows}
        getKey={(row) => row.model}
        pagination={pagination}
        selectable={false}
        isLoading={usage.isLoading}
        emptyLabel={t('accounts.models.empty')}
      />
    </section>
  );
}
