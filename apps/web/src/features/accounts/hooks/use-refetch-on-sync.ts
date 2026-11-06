import { useRefreshAccounts } from '@flama/frontend-consumer/react';
import { desktopBridge as desktop } from '@flama/frontend-web';
import type { CollectorStatus } from '@flama/shared/desktop';
import { useEffect } from 'react';

/** When a run reached the API: `idle` is where only a successful sync lands. */
function syncedAt(status: CollectorStatus): string | null {
  return status.phase === 'idle' ? status.lastRunAt : null;
}

/**
 * Refetches the accounts as soon as the desktop collector finishes a newer
 * sync, so a login just added, a tray switch or a periodic run shows without
 * waiting for the list's own refetch. Nothing in a browser, where there is no
 * collector.
 */
export function useRefetchOnSync(): void {
  const refresh = useRefreshAccounts();

  // The outside system is the desktop shell's collector and its status events.
  useEffect(() => {
    if (!desktop) return;
    let live = true;
    let seen: string | null = null;
    // `baseline`: the sync the screens' first fetch already reflects.
    const observe = (status: CollectorStatus, baseline: boolean) => {
      const at = syncedAt(status);
      if (at === null || (seen !== null && at <= seen)) return;
      seen = at;
      if (!baseline) void refresh();
    };
    const unsubscribe = desktop.collector.onStatus((status) => observe(status, false));
    void desktop.collector.status().then((initial) => {
      if (live) observe(initial, true);
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, [refresh]);
}
