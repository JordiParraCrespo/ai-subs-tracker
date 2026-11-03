import type { AccountEntity } from '@flama/frontend-consumer';
import { useActivateAccount } from '@flama/frontend-consumer/react';
import { desktopBridge as desktop } from '@flama/frontend-web';

/**
 * Makes an account the one terminals use for its provider: the API records
 * it (so every machine agrees), then this machine's desktop shell points its
 * shell integration at that login.
 */
export function useSwitchAccount() {
  const activate = useActivateAccount();

  return {
    isPending: activate.isPending,
    error: activate.error,
    switchTo: (account: AccountEntity) =>
      activate.mutate(account.id, {
        onSuccess: () => {
          void desktop?.accounts.activate(account.provider, account.externalId);
        },
      }),
  };
}
