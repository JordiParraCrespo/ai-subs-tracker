import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  DEFAULT_USAGE_PERIOD,
  USAGE_PERIODS,
  type UsagePeriod,
} from '@/features/accounts/lib/periods';
import { UsageScreen } from '@/features/accounts/screens/usage';

/**
 * The period lives in the URL, so a link to "last 7 days" is a link. Unknown
 * keys are carried through: what `validateSearch` returns becomes the search,
 * and the tables on this page write their own pages into it.
 */
export const Route = createFileRoute('/_authenticated/usage')({
  validateSearch: (
    search: Record<string, unknown>,
  ): Record<string, unknown> & { days?: UsagePeriod } => {
    const { days: requested, ...rest } = search;
    const days = Number(requested) as UsagePeriod;
    return USAGE_PERIODS.includes(days) ? { ...rest, days } : rest;
  },
  component: UsagePage,
});

function UsagePage() {
  const { days = DEFAULT_USAGE_PERIOD } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <UsageScreen
      days={days}
      onDaysChange={(next) => navigate({ search: (prev) => ({ ...prev, days: next }) })}
    />
  );
}
