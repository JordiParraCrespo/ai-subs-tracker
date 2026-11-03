import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * The profile became Settings' first cards; the old URL still lands there,
 * so a bookmark or an email link keeps working.
 */
export const Route = createFileRoute('/_authenticated/profile')({
  beforeLoad: () => {
    throw redirect({ to: '/settings', replace: true });
  },
});
