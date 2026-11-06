import { useRefetchOnSync } from '../hooks/use-refetch-on-sync';

/**
 * Keeps every accounts screen in step with the desktop collector's syncs.
 * Mounted once by the signed-in shell; draws nothing.
 */
export function DesktopSync() {
  useRefetchOnSync();
  return null;
}
