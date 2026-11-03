import { Button } from '@flama/design-system-web';
import { RefreshCw } from '@flama/design-system-web/icons';
import { desktopBridge as desktop, useLocale } from '@flama/frontend-web';
import { useNow } from '@flama/react-hooks';
import { useTranslation } from 'react-i18next';
import { useDesktopStatus } from '../hooks/use-desktop-status';
import { formatResetIn } from '../lib/format';

/**
 * This computer: what the collector found, when it last synced, and the
 * button that reads the machine again (accounts are added from Add
 * subscription). Renders
 * nothing in a browser.
 */
export function DesktopStatus() {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(30_000);
  const status = useDesktopStatus();

  if (!desktop || !status) return null;
  const bridge = desktop;

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
