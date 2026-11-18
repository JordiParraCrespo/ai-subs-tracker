import { Button, Progress } from '@flama/design-system-web';
import { X } from '@flama/design-system-web/icons';
import { BrandGlyph } from '@flama/frontend-web';
import type { UpdateState } from '@flama/shared/desktop';
import { useTranslation } from 'react-i18next';
import type { UpdateCardView } from '../lib/update-card';

/**
 * The floating card in the bottom corner of the desktop app: a downloaded
 * version to restart into, a download the person asked for, one that failed,
 * or, after a restart, the version just installed. Props only; the section
 * above owns the updater.
 */
export function UpdateCard({
  view,
  state,
  onClose,
  onInstall,
  onRetry,
  onDownloadPage,
  onWhatsNew,
}: {
  view: UpdateCardView;
  state: UpdateState;
  onClose(): void;
  onInstall(): void;
  onRetry(): void;
  onDownloadPage(): void;
  onWhatsNew(): void;
}) {
  const { t } = useTranslation();
  const version = state.version ?? '';

  const copy = {
    ready: {
      title: t('accounts.updates.readyTitle', { version }),
      sub: t('accounts.updates.versionChange', { from: state.currentVersion, to: version }),
      body: t('accounts.updates.readyBody'),
    },
    downloading: {
      title: t('accounts.updates.downloadingTitle', { version }),
      sub: `${state.percent ?? 0}%`,
      body: t('accounts.updates.downloadingBody'),
    },
    failed: {
      title: t('accounts.updates.failedTitle', { version }),
      sub: t('accounts.updates.current', { version: state.currentVersion }),
      body: t('accounts.updates.failedBody'),
    },
    updated: {
      title: t('accounts.updates.updatedTitle', { version: state.currentVersion }),
      sub: t('accounts.updates.versionChange', {
        from: state.updatedFrom ?? '',
        to: state.currentVersion,
      }),
      body: t('accounts.updates.updatedBody', { from: state.updatedFrom ?? '' }),
    },
  }[view];

  return (
    <section
      aria-live="polite"
      aria-label={copy.title}
      className="flex w-80 max-w-full flex-col gap-3 rounded-2xl border border-border-default bg-card p-4 shadow-popover"
    >
      <div className="flex items-start gap-3">
        <BrandGlyph size={32} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-ink-900">{copy.title}</h2>
          <p className="font-mono text-xs text-ink-600 tabular-nums">{copy.sub}</p>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          aria-label={t('accounts.updates.close')}
        >
          <X />
        </Button>
      </div>
      <p className="text-sm text-ink-600">{copy.body}</p>
      {view === 'downloading' && <Progress value={state.percent ?? 0} aria-label={copy.title} />}
      {view === 'ready' && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('accounts.updates.onQuit')}
          </Button>
          <Button size="sm" onClick={onInstall}>
            {t('accounts.updates.restartNow')}
          </Button>
        </div>
      )}
      {view === 'failed' && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onDownloadPage}>
            {t('accounts.updates.downloadPage')}
          </Button>
          <Button size="sm" onClick={onRetry}>
            {t('accounts.updates.tryAgain')}
          </Button>
        </div>
      )}
      {view === 'updated' && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onWhatsNew}>
            {t('accounts.updates.whatsNew')}
          </Button>
        </div>
      )}
    </section>
  );
}
