import { DsButton, DsModalFooter, DsModalHeader } from '@flama/design-system-web';
import { useRevokeOtherProfileSessions } from '@flama/frontend-consumer/react';
import { useErrorMessage } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { StepError } from '@/features/profile/components/step-error';

/** Asks before signing every other device out, and owns the revoke. */
export function SignOutOthersStep({ count, onBack }: { count: number; onBack: () => void }) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const revoke = useRevokeOtherProfileSessions({
    onSuccess: onBack,
  });

  return (
    <>
      <DsModalHeader
        title={t('settings.signOutOthers.title')}
        description={t('settings.signOutOthers.description')}
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
          onClick={() => revoke.mutate()}
        >
          {t('settings.signOutOthers.cta', { count })}
        </DsButton>
      </DsModalFooter>
    </>
  );
}
