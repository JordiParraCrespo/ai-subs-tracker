import { DsModalHeader, toast } from '@flama/design-system-web';
import { useDisableTwoFactor } from '@flama/frontend-consumer/react';
import { useErrorMessage } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { StepError } from '@/features/profile/components/step-error';
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
  });

  return (
    <>
      <DsModalHeader
        title={t('settings.twoFactorOff.title')}
        description={t('settings.twoFactorOff.description')}
      />
      <StepError
        message={disable.error ? resolveError(disable.error, t('common.error')).message : null}
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
