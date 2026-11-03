import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from '@flama/design-system-web';
import { Plus } from '@flama/design-system-web/icons';
import { desktopBridge } from '@flama/frontend-web';
import type { ProviderId } from '@flama/shared/subscriptions';
import { type ReactElement, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PROVIDER_NAMES, PROVIDER_ORDER } from '../lib/providers';

/**
 * "Add account": signs a new login into its own folder with the provider's
 * CLI, through the desktop app. In a browser there is no machine to sign in
 * on, so it renders nothing.
 */
export function AddAccountMenu({
  trigger,
}: {
  trigger: (props: { children: React.ReactNode; disabled: boolean }) => ReactElement;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  if (!desktopBridge) return null;
  const bridge = desktopBridge;

  async function add(provider: ProviderId) {
    setBusy(true);
    const result = await bridge.accounts.addLogin(provider);
    setBusy(false);
    if (result.ok) toast.success(t('toasts.accountAdded'));
    else toast.error(result.message ?? t('accounts.desktop.addFailed'));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={trigger({
          disabled: busy,
          children: (
            <>
              <Plus className="size-4" strokeWidth={1.5} />
              {t('accounts.list.add')}
            </>
          ),
        })}
      />
      <DropdownMenuContent align="end">
        {PROVIDER_ORDER.map((provider) => (
          <DropdownMenuItem key={provider} onClick={() => void add(provider)}>
            {PROVIDER_NAMES[provider]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
