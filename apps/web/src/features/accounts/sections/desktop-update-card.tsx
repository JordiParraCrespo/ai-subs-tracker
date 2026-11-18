import { DESKTOP_DOWNLOAD_URL, desktopReleaseNotesUrl } from '@flama/shared/desktop';
import { UpdateCard } from '../components/update-card';
import { useDesktopUpdates } from '../hooks/use-desktop-updates';
import { updateCardView } from '../lib/update-card';

/**
 * The desktop app's update card, in the panel's bottom-left corner. Mounted
 * once by the signed-in shell, after the page, so it stays in view as the
 * page scrolls; renders nothing in a browser or when there is nothing to say.
 */
export function DesktopUpdateCard() {
  const updates = useDesktopUpdates();
  const { state } = updates;
  const view = updateCardView(state);
  if (!state || !view) return null;

  return (
    <div className="pointer-events-none sticky bottom-0 z-30 mt-auto h-0">
      <div className="pointer-events-auto absolute bottom-4 left-0 max-w-full">
        <UpdateCard
          view={view}
          state={state}
          onClose={() => void updates.dismiss()}
          onInstall={updates.install}
          onRetry={() => void updates.check()}
          onDownloadPage={() => updates.openExternal(DESKTOP_DOWNLOAD_URL)}
          onWhatsNew={() => {
            updates.openExternal(desktopReleaseNotesUrl(state.currentVersion));
            void updates.dismiss();
          }}
        />
      </div>
    </div>
  );
}
