import type { AccountEntity } from '@flama/frontend-consumer';
import { useActivateAccount } from '@flama/frontend-consumer/react';
import { desktopBridge as desktop } from '@flama/frontend-web';
import { isManualProvider } from '@flama/shared/subscriptions';

/**
 * Makes an account the one terminals use for its provider: the API records
 * it (so every machine agrees), then this machine's desktop shell points its
 * shell integration at that login. A hand-tracked subscription (Z.AI) has
 * no login to point at, so it is never switched to.
 */
export function useSwitchAccount() {
  const activate = useActivateAccount();

  return {
    isPending: activate.isPending,
    error: activate.error,
    switchTo: (account: AccountEntity) => {
      const provider = account.provider;
      if (isManualProvider(provider)) return;
      activate.mutate(account.id, {
        onSuccess: () => {
          void desktop?.accounts.activate(provider, account.externalId);
        },
      });
    },
  };
}
