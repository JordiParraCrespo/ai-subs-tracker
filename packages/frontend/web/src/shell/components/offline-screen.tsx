import { DsButton, DsStateCard } from '@flama/design-system-web';
import { RotateCw, WifiOff } from '@flama/design-system-web/icons';
import { useTranslation } from 'react-i18next';

const ICON = { className: 'size-4', strokeWidth: 1.5 } as const;

/** The design's "Can't reach ResetOwl": shown in place of the page while the API cannot be reached. */
export function OfflineScreen({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const { t } = useTranslation();
  return (
    <DsStateCard
      variant="status"
      icon={<WifiOff strokeWidth={1.5} />}
      eyebrow={t('pages.status.offline.eyebrow')}
      title={t('pages.status.offline.title', { app: t('common.appName') })}
      text={t('pages.status.offline.text')}
      actions={
        <DsButton
          variant="primary"
          size="sm"
          icon={<RotateCw {...ICON} />}
          disabled={retrying}
          onClick={onRetry}
        >
          {t('pages.status.offline.retry')}
        </DsButton>
      }
    />
  );
}
