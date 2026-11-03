import { PageHead } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import type { UsageQuery } from '../lib/usage-view';
import { UsageBreakdown } from '../sections/usage-breakdown';
import { UsageSpend } from '../sections/usage-spend';
import { UsageToolbar } from '../sections/usage-toolbar';
import { UsageValue } from '../sections/usage-value';

/**
 * The design's Usage & tokens page: filters, the spend card, what the plans
 * returned at API prices, and the grouped table. The filters live in the URL
 * and every section reads them, so the screen holds only the query.
 */
export function UsageScreen({
  query,
  onQuery,
}: {
  query: UsageQuery;
  onQuery: (next: UsageQuery) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <PageHead
        className="mb-0"
        title={t('accounts.usage.title')}
        sub={t('accounts.usage.sub', { days: query.days ?? 30 })}
      />
      <UsageToolbar query={query} onQuery={onQuery} />
      <UsageSpend query={query} />
      <UsageValue query={query} />
      <UsageBreakdown query={query} onQuery={onQuery} />
    </div>
  );
}
