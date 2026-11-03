import { desktopBridge as desktop } from '@flama/frontend-web';
import type { LiveFeedTarget, ShellIntegration } from '@flama/shared/desktop';
import { useEffect, useState } from 'react';

/**
 * The machine-level switches the desktop shell owns: the shell snippet that
 * makes terminals follow the active account, and the opt-in live feed from
 * Claude Code's status line. Reads them from the desktop shell once, then
 * keeps what each action answers.
 */
export function useDesktopSetup() {
  const [shell, setShell] = useState<ShellIntegration>();
  const [targets, setTargets] = useState<LiveFeedTarget[]>([]);

  // The outside system is the desktop shell: read its current setup once.
  useEffect(() => {
    if (!desktop) return;
    let live = true;
    void Promise.all([desktop.shell.integration(), desktop.liveFeed.targets()]).then(
      ([integration, feed]) => {
        if (!live) return;
        setShell(integration);
        setTargets(feed);
      },
    );
    return () => {
      live = false;
    };
  }, []);

  return {
    shell,
    targets,
    installShell: async () => {
      if (desktop) setShell(await desktop.shell.install());
    },
    toggleLiveFeed: async (home: string, on: boolean) => {
      if (!desktop) return;
      setTargets(await (on ? desktop.liveFeed.install(home) : desktop.liveFeed.uninstall(home)));
    },
  };
}
