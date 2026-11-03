import {
  AppShell,
  ErrorScreen,
  NotFoundScreen,
  OfflineScreen,
  redirectSignedOut,
  type ShellWorkspace,
  useApiReachable,
} from '@flama/frontend-web';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import type { ComponentType, ReactNode } from 'react';
// flama:begin organizations
// flama:end organizations
import { apiBaseUrl } from '@/lib/auth-client';
import { NAV, USER_MENU_LINKS } from '@/lib/nav';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => redirectSignedOut({ context, location }),
  component: AuthenticatedShell,
  // A page that breaks or names nothing renders inside the shell, so the
  // sidebar is still there to leave by.
  errorComponent: () => <ErrorScreen home="/dashboard" />,
  notFoundComponent: () => <NotFoundScreen home="/dashboard" />,
});

/** Stands between a signed-in reader and the shell, and names its workspace. */
type ShellGate = ComponentType<{
  children: (workspace: ShellWorkspace | undefined) => ReactNode;
}>;

/**
 * The gates the shell opens through, outermost first. Each may hold the shell
 * back (with organizations, until the caller has somewhere to work) and may
 * name the workspace it shows; with none, the shell opens straight away.
 */
const GATES: ShellGate[] = [
  // flama:begin organizations
  // flama:end organizations
];

const HEALTH_URL = `${apiBaseUrl}/api/v1/health`;

function AuthenticatedShell() {
  // With the API out of reach every screen would sit on its skeletons; the
  // shell says so instead, and swaps the page back in once it answers.
  const api = useApiReachable(HEALTH_URL);
  const shell = (workspace?: ShellWorkspace) => (
    <AppShell nav={NAV} userMenuLinks={USER_MENU_LINKS} workspace={workspace}>
      {api.reachable ? (
        <Outlet />
      ) : (
        <OfflineScreen onRetry={() => void api.retry()} retrying={api.checking} />
      )}
    </AppShell>
  );
  const open = GATES.reduceRight<(workspace?: ShellWorkspace) => ReactNode>(
    (inner, Gate) => (outer) => <Gate>{(named) => inner(named ?? outer)}</Gate>,
    shell,
  );
  return open();
}
