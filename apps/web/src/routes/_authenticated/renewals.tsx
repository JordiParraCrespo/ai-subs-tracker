import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { MONTH_PATTERN } from '@/features/accounts/lib/renewals';
import { RenewalsScreen } from '@/features/accounts/screens/renewals';

/** The month shown lives in the URL (`?month=2026-12`), so a month is a link. */
export const Route = createFileRoute('/_authenticated/renewals')({
  validateSearch: (
    search: Record<string, unknown>,
  ): Record<string, unknown> & { month?: string } => {
    const { month, ...rest } = search;
    return typeof month === 'string' && MONTH_PATTERN.test(month) ? { ...rest, month } : rest;
  },
  component: RenewalsPage,
});

function RenewalsPage() {
  const { month } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <RenewalsScreen
      month={month}
      onMonth={(next) => navigate({ search: (prev) => ({ ...prev, month: next }) })}
    />
  );
}
