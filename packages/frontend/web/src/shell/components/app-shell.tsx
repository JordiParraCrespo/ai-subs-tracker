import { type ReactNode, useState } from 'react';
import { useApplyUserSettings } from '../../i18n';
import { type ShellConfig, ShellProvider } from '../hooks/use-shell';
import { AppSidebar } from './app-sidebar';
import { CommandPalette } from './command-palette';
import { MobileBar } from './mobile-bar';

/**
 * The authenticated frame from the design (`designs/_ds`, `.ds-frame`): the
 * sidebar on the dark frame, and the page in a rounded panel inset 12px from
 * it, the only part that scrolls. The page's own header (title, subtitle,
 * action) is the first thing inside the panel; there is no chrome bar.
 *
 * Below `lg` the sidebar is a sheet opened from a slim bar, so a narrow
 * browser window still gets every destination.
 */
export function AppShell({ children, ...config }: ShellConfig & { children: ReactNode }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // The saved theme and language become this device's defaults — once, and
  // only where the device has not chosen for itself.
  useApplyUserSettings();

  return (
    <ShellProvider value={config}>
      <div className="flex h-svh min-h-0 overflow-hidden bg-frame">
        <AppSidebar
          collapsed={collapsed}
          onCollapse={() => setCollapsed((value) => !value)}
          onSearch={() => setCommandOpen(true)}
          className="hidden lg:flex"
        />
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Close"
              className="absolute inset-0 bg-scrim"
              onClick={() => setDrawerOpen(false)}
            />
            <AppSidebar
              collapsed={false}
              onCollapse={() => setDrawerOpen(false)}
              onSearch={() => {
                setDrawerOpen(false);
                setCommandOpen(true);
              }}
              onNavigate={() => setDrawerOpen(false)}
              className="relative flex h-full"
            />
          </div>
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <MobileBar onMenu={() => setDrawerOpen(true)} />
          <main className="m-3 mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-panel outline-1 -outline-offset-1 outline-panel-outline lg:mt-3 lg:ml-0">
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
              <div className="mx-auto flex w-full max-w-7xl flex-col px-4 pt-7 pb-14 sm:px-6 lg:px-[clamp(32px,4vw,64px)]">
                {children}
              </div>
            </div>
          </main>
        </div>
        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      </div>
    </ShellProvider>
  );
}
