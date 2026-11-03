import { DsBadge, DsButton } from '@flama/design-system-web';
import { Monitor, Smartphone } from '@flama/design-system-web/icons';
import type { UserSessionEntity } from '@flama/frontend-consumer';
import { formatRelativeTime, useLocale } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * One signed-in device in the security dialog. `now` comes from the list's
 * one clock, so the age moves without a timer per row.
 */
export function DeviceRow({
  session,
  now,
  onSignOut,
}: {
  session: UserSessionEntity;
  now: number;
  onSignOut: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const Icon = session.deviceKind === 'mobile' ? Smartphone : Monitor;
  const lastSeen =
    formatRelativeTime(session.lastSeenAt, locale, new Date(now)) ??
    t('settings.security.activeNow');

  return (
    <div className="ds-device-row" data-testid="device-row">
      <span className="ds-disc">
        <Icon />
      </span>
      <div className="ds-device-row__meta">
        <span className="ds-label-strong">
          {session.deviceLabel ?? t('settings.security.unknownDevice')}
        </span>
        <span className="ds-t-sub">
          {session.ipAddress ?? t('settings.security.unknownLocation')} · {lastSeen}
        </span>
      </div>
      {session.current ? (
        <DsBadge tone="info">{t('settings.security.thisDevice')}</DsBadge>
      ) : (
        <DsButton variant="ghost" size="xs" onClick={onSignOut}>
          {t('settings.security.signOut')}
        </DsButton>
      )}
    </div>
  );
}
