import type { SubscriptionsQuery } from '../lib/subscriptions';
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
  return (
    <div className="flex flex-col gap-6">
      <SubscriptionsHead />
      <SubscriptionsTable query={query} onQuery={onQuery} />
    </div>
  );
}
