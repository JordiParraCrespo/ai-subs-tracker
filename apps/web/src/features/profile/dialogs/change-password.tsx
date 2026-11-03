import { DsModalHeader, toast } from '@flama/design-system-web';
import { useChangeOwnPassword } from '@flama/frontend-consumer/react';
import { useErrorMessage } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { ChangePasswordForm } from '@/features/profile/forms/change-password-form';

/**
 * The security dialog's password step. It owns the change, which signs every
 * other device out: the usual reason to change a password is that someone
 * else may know the old one.
 */
export function ChangePasswordStep({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const change = useChangeOwnPassword({
    onSuccess: () => {
      toast.success(t('toasts.passwordChanged'));
      onBack();
    },
    onError: (error) => toast.error(resolveError(error).message),
  });

  return (
    <>
      <DsModalHeader
        title={t('settings.changePassword.title')}
        description={t('settings.changePassword.description')}
      />
      <ChangePasswordForm
        isPending={change.isPending}
        onBack={onBack}
        onSubmit={({ currentPassword, newPassword }) =>
          change.mutate({ currentPassword, newPassword, revokeOtherSessions: true })
        }
      />
    </>
  );
}
