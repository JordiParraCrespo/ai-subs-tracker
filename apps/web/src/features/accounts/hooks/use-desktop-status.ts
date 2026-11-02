import { desktopBridge as desktop } from '@flama/frontend-web';
import type { CollectorStatus } from '@flama/shared/desktop';
import { useEffect, useState } from 'react';

/**
 * The desktop collector's state, kept current. Subscribes to the desktop
 * shell's status events; undefined in a browser, where there is no collector.
 */
export function useDesktopStatus(): CollectorStatus | undefined {
  const [status, setStatus] = useState<CollectorStatus>();

  // The outside system is the desktop shell's collector.
  useEffect(() => {
    if (!desktop) return;
    let live = true;
    desktop.collector.status().then((initial) => {
      if (live) setStatus(initial);
    });
    const unsubscribe = desktop.collector.onStatus(setStatus);
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  return status;
}
