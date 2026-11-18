import { desktopBridge as desktop } from '@flama/frontend-web';
import type { DesktopVersions } from '@flama/shared/desktop';
import { useEffect, useState } from 'react';

/**
 * The versions the desktop shell reports: its own, its runtime's, the OS's
 * and each vendor CLI's. Undefined in a browser and until the shell answers.
 */
export function useDesktopVersions() {
  const [versions, setVersions] = useState<DesktopVersions>();

  // The outside system is the desktop shell, which runs each CLI's --version once per visit.
  useEffect(() => {
    if (!desktop) return;
    let live = true;
    void desktop
      .versions()
      .then((answer) => {
        if (live) setVersions(answer);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  return versions;
}
