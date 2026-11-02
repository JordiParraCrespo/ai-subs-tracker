import { PROVIDER_IDS, type ProviderId } from '@flama/shared/subscriptions';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  SORTS,
  STATUS_FILTERS,
  type StatusFilter,
  type SubscriptionSort,
  type SubscriptionsQuery,
} from '@/features/accounts/lib/subscriptions';
import { AccountsScreen } from '@/features/accounts/screens/accounts';

const oneOf = <T extends string>(list: readonly T[], value: unknown): T | undefined =>
  list.includes(value as T) ? (value as T) : undefined;

/** The toolbar's search, filters, sort and page live in the URL, so a filtered list is a link. */
export const Route = createFileRoute('/_authenticated/accounts/')({
  validateSearch: (
    search: Record<string, unknown>,
  ): Record<string, unknown> & SubscriptionsQuery => {
    const { q, status, provider, sort, page, ...rest } = search;
    const pageNumber = Number(page);
    return {
      ...rest,
      q: typeof q === 'string' && q ? q.slice(0, 100) : undefined,
      status: oneOf<StatusFilter>(STATUS_FILTERS, status),
      provider: oneOf<ProviderId>(PROVIDER_IDS, provider),
      sort: oneOf<SubscriptionSort>(SORTS, sort),
      page: Number.isInteger(pageNumber) && pageNumber > 1 ? pageNumber : undefined,
    };
  },
  component: AccountsPage,
});

function AccountsPage() {
  const query = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <AccountsScreen
      query={query}
      onQuery={(next) => navigate({ search: (prev) => ({ ...prev, ...next }) })}
    />
  );
}
