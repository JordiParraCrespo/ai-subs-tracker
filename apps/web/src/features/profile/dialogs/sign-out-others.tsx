import { DsButton, DsModalFooter, DsModalHeader, toast } from '@flama/design-system-web';
import { useRevokeOtherProfileSessions } from '@flama/frontend-consumer/react';
import { useErrorMessage } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';

/** Asks before signing every other device out, and owns the revoke. */
export function SignOutOthersStep({ count, onBack }: { count: number; onBack: () => void }) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const revoke = useRevokeOtherProfileSessions({
    onSuccess: onBack,
    onError: (error) => toast.error(resolveError(error).message),
  });

  return (
    <>
      <DsModalHeader
        title={t('settings.signOutOthers.title')}
        description={t('settings.signOutOthers.description')}
      />
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
