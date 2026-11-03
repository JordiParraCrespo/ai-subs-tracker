import { createFileRoute } from '@tanstack/react-router';
import { TokenmaxxScreen } from '@/features/accounts/screens/tokenmaxx';

export const Route = createFileRoute('/_authenticated/tokenmaxx')({
  component: TokenmaxxScreen,
});
