import { useTranslation } from 'react-i18next';
import type { SubscriptionsQuery } from '../lib/subscriptions';
import { FirstRun } from '../sections/first-run';
import { SubscriptionsHead } from '../sections/subscriptions-head';
import { SubscriptionsTable } from '../sections/subscriptions-table';

/** The design's Subscriptions page, over the person's accounts. */
export function AccountsScreen({
  query,
  onQuery,
}: {
  query: SubscriptionsQuery;
  onQuery: (next: SubscriptionsQuery) => void;
}) {
  const { t } = useTranslation();
  return (
    <FirstRun page="subscriptions" title={t('accounts.list.title')}>
      <div className="flex flex-col gap-6">
        <SubscriptionsHead />
        <SubscriptionsTable query={query} onQuery={onQuery} />
      </div>
    </FirstRun>
  );
}
