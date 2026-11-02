import { createFileRoute } from '@tanstack/react-router';
import { OverviewScreen } from '@/features/accounts/screens/overview';

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: OverviewScreen,
});
