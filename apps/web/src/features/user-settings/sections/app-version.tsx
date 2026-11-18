import { desktopBridge as desktop } from '@flama/frontend-web';

/**
 * The version of ResetOwl, at the foot of Settings, in the desktop app only
 * (a product name and a number, so not translated).
 */
export function AppVersion() {
  if (!desktop) return null;
  return (
    <p data-testid="app-version" className="mt-2 text-center font-mono text-xs text-ink-400">
      ResetOwl {desktop.version}
    </p>
  );
}
