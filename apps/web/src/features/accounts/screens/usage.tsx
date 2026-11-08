import { PageHead } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import type { UsageQuery } from '../lib/usage-view';
import { FirstRun } from '../sections/first-run';
import { UsageBreakdown } from '../sections/usage-breakdown';
import { UsageSpend } from '../sections/usage-spend';
import { UsageToolbar } from '../sections/usage-toolbar';
import { UsageValue } from '../sections/usage-value';

/**
 * The Usage & tokens page: filters, whether the plans are paying off, the
 * running total, and the grouped table. The filters live in the URL
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
    <FirstRun page="usage" title={t('accounts.usage.title')}>
      <div className="flex flex-col gap-6">
        <PageHead
          className="mb-0"
          title={t('accounts.usage.title')}
          sub={t('accounts.usage.sub', { days: query.days ?? 30 })}
        />
        <UsageToolbar query={query} onQuery={onQuery} />
        <UsageValue query={query} />
        <UsageSpend query={query} />
        <UsageBreakdown query={query} onQuery={onQuery} />
      </div>
    </FirstRun>
  );
}
