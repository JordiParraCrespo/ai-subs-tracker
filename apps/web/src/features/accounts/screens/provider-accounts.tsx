import { DsButton } from '@flama/design-system-web';
import { ArrowLeft } from '@flama/design-system-web/icons';
import { PageHead } from '@flama/frontend-web';
import { isManualProvider, type ProviderId } from '@flama/shared/subscriptions';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { PROVIDER_NAMES } from '../lib/providers';
import { ProviderAccounts } from '../sections/provider-accounts';

/** One provider's accounts, as the design's shared-accounts page. */
export function ProviderAccountsScreen({ provider }: { provider: ProviderId }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-6">
      <div className="-mb-4">
        <DsButton
          size="text"
          icon={<ArrowLeft className="size-4" strokeWidth={1.5} />}
          onClick={() => navigate({ to: '/accounts' })}
        >
          {t('accounts.list.title')}
        </DsButton>
      </div>
      <PageHead
        className="mb-0"
        title={t('accounts.group.title', { provider: PROVIDER_NAMES[provider] })}
        sub={t(isManualProvider(provider) ? 'accounts.group.subManual' : 'accounts.group.sub')}
      />
      <ProviderAccounts provider={provider} />
    </div>
  );
}
