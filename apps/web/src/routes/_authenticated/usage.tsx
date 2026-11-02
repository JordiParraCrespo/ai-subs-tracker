import { PROVIDER_IDS, type ProviderId } from '@flama/shared/subscriptions';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { USAGE_PERIODS, type UsagePeriod } from '@/features/accounts/lib/periods';
import {
  USAGE_GROUPS,
  USAGE_METRICS,
  type UsageGroup,
  type UsageMetric,
  type UsageQuery,
} from '@/features/accounts/lib/usage-view';
import { UsageScreen } from '@/features/accounts/screens/usage';

const oneOf = <T,>(list: readonly T[], value: unknown): T | undefined =>
  list.includes(value as T) ? (value as T) : undefined;

/**
 * The period, filters, search, view and page live in the URL, so a filtered
 * view is a link. Unknown keys are carried through.
 */
export const Route = createFileRoute('/_authenticated/usage')({
  validateSearch: (search: Record<string, unknown>): Record<string, unknown> & UsageQuery => {
    const { days, provider, account, q, metric, group, page, ...rest } = search;
    const pageNumber = Number(page);
    return {
      ...rest,
      days: oneOf<UsagePeriod>(USAGE_PERIODS, Number(days)),
      provider: oneOf<ProviderId>(PROVIDER_IDS, provider),
      account: typeof account === 'string' && account ? account.slice(0, 64) : undefined,
      q: typeof q === 'string' && q ? q.slice(0, 100) : undefined,
      metric: oneOf<UsageMetric>(USAGE_METRICS, metric),
      group: oneOf<UsageGroup>(USAGE_GROUPS, group),
      page: Number.isInteger(pageNumber) && pageNumber > 1 ? pageNumber : undefined,
    };
  },
  component: UsagePage,
});

function UsagePage() {
  const query = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <UsageScreen
      query={query}
      onQuery={(next) => navigate({ search: (prev) => ({ ...prev, ...next }) })}
    />
  );
}
