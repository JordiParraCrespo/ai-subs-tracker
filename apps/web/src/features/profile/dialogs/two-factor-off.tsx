import { DsModalHeader, toast } from '@flama/design-system-web';
import { useDisableTwoFactor } from '@flama/frontend-consumer/react';
import { useErrorMessage } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { ConfirmPasswordForm } from '@/features/profile/forms/confirm-password-form';

/** Turns two-factor off behind the password, and owns that mutation. */
export function TwoFactorOffStep({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const disable = useDisableTwoFactor({
    onSuccess: () => {
      toast.success(t('toasts.twoFactorDisabled'));
      onBack();
    },
    onError: (error) => toast.error(resolveError(error, t('common.error')).message),
  });

  return (
    <>
      <DsModalHeader
        title={t('settings.twoFactorOff.title')}
        description={t('settings.twoFactorOff.description')}
      />
      <ConfirmPasswordForm
        label={t('settings.twoFactorOff.password')}
        emptyLabel={t('settings.twoFactorSetup.passwordEmpty')}
        submit={t('settings.twoFactorOff.cta')}
        isPending={disable.isPending}
        onBack={onBack}
        onSubmit={(password) => disable.mutate(password)}
      />
    </>
  );
}
