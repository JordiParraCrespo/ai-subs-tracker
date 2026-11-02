import { createFileRoute } from '@tanstack/react-router';
import { AccountsScreen } from '@/features/accounts/screens/accounts';

export const Route = createFileRoute('/_authenticated/accounts')({
  component: AccountsScreen,
});
