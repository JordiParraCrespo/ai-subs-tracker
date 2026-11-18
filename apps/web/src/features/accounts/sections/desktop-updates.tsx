import { Button, DsSettingsCard, Switch } from '@flama/design-system-web';
import { Download, RefreshCw } from '@flama/design-system-web/icons';
import {
  formatRelativeTime,
  RowControl,
  RowMeta,
  SectionCard,
  SectionRow,
  useLocale,
} from '@flama/frontend-web';
import { useNow } from '@flama/react-hooks';
import {
  DESKTOP_DOWNLOAD_URL,
  DESKTOP_RELEASES_URL,
  desktopReleaseNotesUrl,
} from '@flama/shared/desktop';
import { useTranslation } from 'react-i18next';
import { useDesktopUpdates } from '../hooks/use-desktop-updates';

/**
 * Settings' Updates card: the version running, what the updater is doing,
 * the switch to install on quit and a check on demand. Only in the desktop
 * app; a browser has nothing to update, so the card is not offered there.
 */
export function DesktopUpdates() {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(30_000);
  const updates = useDesktopUpdates();
  const { state } = updates;
  if (!state) return null;

  const unsupported = state.phase === 'unsupported';
  const busy = state.phase === 'checking' || state.phase === 'downloading';
  const checkedAgo = state.checkedAt
    ? formatRelativeTime(new Date(state.checkedAt), locale, new Date(now))
    : null;
  const detail = [
    t('accounts.updates.current', { version: state.currentVersion }),
    state.checkedAt
      ? checkedAgo
        ? t('accounts.updates.checked', { when: checkedAgo })
        : t('accounts.updates.checkedJustNow')
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <DsSettingsCard
      id="updates"
      icon={<Download />}
      title={t('accounts.updates.title')}
      description={t('accounts.updates.description')}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface-card px-5 py-4">
        <div className="min-w-0 text-sm" aria-live="polite">
          <div className="font-medium text-ink-900">
            {t(`accounts.updates.status.${state.phase}`, {
              version: state.version ?? '',
              percent: state.percent ?? 0,
            })}
          </div>
          <div className="text-ink-600 tabular-nums">
            {unsupported ? t('accounts.updates.unsupportedDescription') : detail}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {unsupported ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => updates.openExternal(DESKTOP_DOWNLOAD_URL)}
            >
              {t('accounts.updates.downloadPage')}
            </Button>
          ) : state.phase === 'ready' ? (
            <Button size="sm" onClick={updates.install}>
              {t('accounts.updates.restartNow')}
            </Button>
          ) : (
            <Button size="sm" disabled={busy} onClick={() => void updates.check()}>
              <RefreshCw />
              {t('accounts.updates.check')}
            </Button>
          )}
        </div>
      </div>
      <SectionCard>
        {!unsupported && (
          <SectionRow>
            <RowMeta
              name={t('accounts.updates.installOnQuit')}
              description={t('accounts.updates.installOnQuitDescription')}
            />
            <RowControl>
              <Switch
                checked={state.installOnQuit}
                onCheckedChange={(on) => void updates.setInstallOnQuit(on)}
                aria-label={t('accounts.updates.installOnQuit')}
              />
            </RowControl>
          </SectionRow>
        )}
        <SectionRow>
          <RowMeta name={t('accounts.updates.releaseNotes')} />
          <RowControl>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                updates.openExternal(
                  unsupported ? DESKTOP_RELEASES_URL : desktopReleaseNotesUrl(state.currentVersion),
                )
              }
            >
              {t('accounts.updates.releaseNotes')}
            </Button>
          </RowControl>
        </SectionRow>
      </SectionCard>
    </DsSettingsCard>
  );
}
