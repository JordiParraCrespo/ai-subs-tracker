import {
  DsBadge,
  DsButton,
  DsModalBody,
  DsModalFooter,
  DsModalHeader,
  Skeleton,
} from '@flama/design-system-web';
import { LogOut } from '@flama/design-system-web/icons';
import type { UserSessionEntity } from '@flama/frontend-consumer';
import { useMyProfile, useProfileSessions } from '@flama/frontend-consumer/react';
import { useNow } from '@flama/react-hooks';
import { useTranslation } from 'react-i18next';
import { DeviceRow } from '@/features/profile/components/device-row';
import type { SecurityStep } from '@/features/profile/lib/security-steps';

/** How often "2 minutes ago" moves on: the age is worded to the minute. */
const LAST_SEEN_TICK_MS = 60_000;

/**
 * The security dialog's first step: the password, two-factor and every
 * device signed in, each with the step that changes it.
 */
export function SecurityOverview({ onStep }: { onStep: (step: SecurityStep) => void }) {
  const { t } = useTranslation();
  const profile = useMyProfile();
  const sessions = useProfileSessions();
  const now = useNow(LAST_SEEN_TICK_MS);
  const others = (sessions.data ?? []).filter((session) => !session.current);
  const twoFactor = profile.data?.twoFactorEnabled ?? false;
  const hasPassword = profile.data?.hasPassword ?? true;

  return (
    <>
      <DsModalHeader
        title={t('settings.security.dialogTitle')}
        description={t('settings.security.dialogDescription')}
      />
      <DsModalBody className="ds-modal__body--rows">
        <div className="ds-setting-row">
          <div className="ds-setting-row__meta">
            <span className="ds-label-strong">{t('settings.security.password')}</span>
            <span className="ds-t-sub">
              {hasPassword ? t('settings.security.passwordSub') : t('settings.security.noPassword')}
            </span>
          </div>
          {hasPassword && (
            <div className="ds-setting-row__control">
              <DsButton size="xs" onClick={() => onStep({ kind: 'password' })}>
                {t('settings.security.change')}
              </DsButton>
            </div>
          )}
        </div>
        <div className="ds-setting-row">
          <div className="ds-setting-row__meta">
            <span className="ds-label-strong">{t('settings.security.twoFactor')}</span>
            <span className="ds-t-sub">
              {!hasPassword && !twoFactor
                ? t('settings.security.twoFactorNeedsPassword')
                : twoFactor
                  ? t('settings.security.twoFactorOn')
                  : t('settings.security.twoFactorOff')}
            </span>
          </div>
          <div className="ds-setting-row__control">
            <DsBadge tone={twoFactor ? 'info' : 'neutral'}>
              {twoFactor ? t('settings.security.on') : t('settings.security.off')}
            </DsBadge>
            {twoFactor ? (
              <DsButton
                variant="ghost"
                size="xs"
                onClick={() => onStep({ kind: 'two-factor-off' })}
              >
                {t('settings.security.turnOff')}
              </DsButton>
            ) : (
              <DsButton
                variant="primary"
                size="xs"
                disabled={!hasPassword || profile.isPending}
                onClick={() => onStep({ kind: 'two-factor-on' })}
              >
                {t('settings.security.setUp')}
              </DsButton>
            )}
          </div>
        </div>
        <div className="ds-setting-list">
          <span className="ds-label-strong">{t('settings.security.devices')}</span>
          {sessions.isPending && <Skeleton className="my-2.5 h-9 w-full" />}
          {sessions.data?.length === 0 && (
            <span className="ds-t-sub py-2.5">{t('settings.security.noDevices')}</span>
          )}
          {sessions.data?.map((session: UserSessionEntity) => (
            <DeviceRow
              key={session.id}
              session={session}
              now={now}
              onSignOut={() => onStep({ kind: 'sign-out', session })}
            />
          ))}
        </div>
      </DsModalBody>
      <DsModalFooter>
        {others.length > 0 && (
          <DsButton
            size="sm"
            icon={<LogOut className="size-4" />}
            onClick={() => onStep({ kind: 'sign-out-others', count: others.length })}
          >
            {t('settings.security.signOutAll')}
          </DsButton>
        )}
      </DsModalFooter>
    </>
  );
}
