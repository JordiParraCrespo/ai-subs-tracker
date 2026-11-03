import { DsButton, DsModalFooter, DsModalHeader } from '@flama/design-system-web';
import type { UserSessionEntity } from '@flama/frontend-consumer';
import { useRevokeProfileSession } from '@flama/frontend-consumer/react';
import { useErrorMessage } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { StepError } from '@/features/profile/components/step-error';

/** Asks before signing one device out, and owns the revoke. */
export function SignOutDeviceStep({
  session,
  onBack,
}: {
  session: UserSessionEntity;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const device = session.deviceLabel ?? t('settings.security.unknownDevice');
  const revoke = useRevokeProfileSession({
    onSuccess: onBack,
  });

  return (
    <>
      <DsModalHeader
        closeLabel={t('common.close')}
        title={t('settings.signOutOne.title', { device })}
        description={t('settings.signOutOne.description')}
      />
      <StepError message={revoke.error ? resolveError(revoke.error).message : null} />
      <div className="h-2" />
      <DsModalFooter>
        <DsButton variant="ghost" size="sm" onClick={onBack}>
          {t('settings.security.cancel')}
        </DsButton>
        <DsButton
          variant="primary"
          size="sm"
          disabled={revoke.isPending}
          onClick={() => revoke.mutate(session.id)}
        >
          {t('settings.signOutOne.cta')}
        </DsButton>
      </DsModalFooter>
    </>
  );
}
