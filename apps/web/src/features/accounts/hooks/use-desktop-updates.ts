import { desktopBridge as desktop } from '@flama/frontend-web';
import type { UpdateState } from '@flama/shared/desktop';
import { useEffect, useState } from 'react';

/**
 * The desktop app's own updater, kept current, and what the screens can ask
 * of it. Undefined state in a browser, where there is nothing to update.
 */
export function useDesktopUpdates() {
  const [state, setState] = useState<UpdateState>();

  // The outside system is the desktop shell's updater.
  useEffect(() => {
    const updates = desktop?.updates;
    if (!updates) return;
    let live = true;
    void updates.state().then((initial) => {
      if (live) setState(initial);
    });
    const unsubscribe = updates.onState(setState);
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  const updates = desktop?.updates;
  return {
    state,
    check: async () => {
      if (updates) setState(await updates.check());
    },
    install: () => void updates?.install(),
    dismiss: async () => {
      if (updates) setState(await updates.dismiss());
    },
    setInstallOnQuit: async (on: boolean) => {
      if (updates) setState(await updates.setInstallOnQuit(on));
    },
    openExternal: (url: string) => void desktop?.openExternal(url),
  };
}
