import { Button, toast } from '@flama/design-system-web';
import { Plus, RefreshCw } from '@flama/design-system-web/icons';
import { desktopBridge as desktop, useLocale } from '@flama/frontend-web';
import { useNow } from '@flama/react-hooks';
import type { ProviderId } from '@flama/shared/subscriptions';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDesktopStatus } from '../hooks/use-desktop-status';
import { formatResetIn } from '../lib/format';
import { PROVIDER_NAMES, PROVIDER_ORDER } from '../lib/providers';

/**
 * This computer: what the collector found, when it last synced, and the
 * buttons that act on the machine (refresh, sign another account in). Renders
 * nothing in a browser.
 */
export function DesktopStatus() {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(30_000);
  const status = useDesktopStatus();
  const [adding, setAdding] = useState<ProviderId | null>(null);

  if (!desktop || !status) return null;
  const bridge = desktop;

  async function add(provider: ProviderId) {
    setAdding(provider);
    const result = await bridge.accounts.addLogin(provider);
    setAdding(null);
    if (result.ok) toast.success(t('toasts.accountAdded'));
    else toast.error(result.message ?? t('accounts.desktop.addFailed'));
  }

  const lastRun = status.lastRunAt
    ? formatResetIn(status.lastRunAt, now, locale)
    : t('accounts.desktop.never');

  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface-card px-5 py-4">
      <div className="min-w-0 text-sm">
        <div className="font-medium text-ink-900">
          {t(`accounts.desktop.phase.${status.phase}`, {
            count: status.logins.length,
          })}
        </div>
        <div className="text-ink-600">
          {status.lastError ?? t('accounts.desktop.lastSync', { when: lastRun })}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {PROVIDER_ORDER.map((provider) => (
          <Button
            key={provider}
            variant="outline"
            size="sm"
            disabled={adding !== null}
            onClick={() => void add(provider)}
          >
            <Plus />
            {t('accounts.desktop.add', { provider: PROVIDER_NAMES[provider] })}
          </Button>
        ))}
        <Button
          size="sm"
          disabled={status.phase === 'collecting' || status.phase === 'syncing'}
          onClick={() => void bridge.collector.refresh()}
        >
          <RefreshCw />
          {t('accounts.desktop.refresh')}
        </Button>
      </div>
    </div>
  );
}
