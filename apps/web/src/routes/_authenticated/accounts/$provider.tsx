import { PROVIDER_IDS, type ProviderId } from '@flama/shared/subscriptions';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { ProviderAccountsScreen } from '@/features/accounts/screens/provider-accounts';

export const Route = createFileRoute('/_authenticated/accounts/$provider')({
  beforeLoad: ({ params }) => {
    if (!PROVIDER_IDS.includes(params.provider as ProviderId)) throw notFound();
  },
  component: ProviderAccountsPage,
});

function ProviderAccountsPage() {
  const { provider } = Route.useParams();
  return <ProviderAccountsScreen provider={provider as ProviderId} />;
}
