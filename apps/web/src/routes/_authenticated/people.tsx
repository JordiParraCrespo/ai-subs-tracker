import { PROVIDER_IDS, type ProviderId } from '@flama/shared/subscriptions';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  PEOPLE_SORTS,
  PEOPLE_STATUSES,
  type PeopleQuery,
  type PeopleSort,
  type PeopleStatus,
} from '@/features/accounts/lib/people';
import { PeopleScreen } from '@/features/accounts/screens/people';

const oneOf = <T extends string>(list: readonly T[], value: unknown): T | undefined =>
  list.includes(value as T) ? (value as T) : undefined;

/** The toolbar's search, filters, sort and page live in the URL, so a filtered list is a link. */
export const Route = createFileRoute('/_authenticated/people')({
  validateSearch: (search: Record<string, unknown>): Record<string, unknown> & PeopleQuery => {
    const { q, provider, status, sort, page, ...rest } = search;
    const pageNumber = Number(page);
    return {
      ...rest,
      q: typeof q === 'string' && q ? q.slice(0, 100) : undefined,
      provider: oneOf<ProviderId>(PROVIDER_IDS, provider),
      status: oneOf<PeopleStatus>(PEOPLE_STATUSES, status),
      sort: oneOf<PeopleSort>(PEOPLE_SORTS, sort),
      page: Number.isInteger(pageNumber) && pageNumber > 1 ? pageNumber : undefined,
    };
  },
  component: PeoplePage,
});

function PeoplePage() {
  const query = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <PeopleScreen
      query={query}
      onQuery={(next) => navigate({ search: (prev) => ({ ...prev, ...next }) })}
    />
  );
}
