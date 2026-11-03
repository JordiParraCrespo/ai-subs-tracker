import { Checkbox, DsButton, FieldGroup, Input, Label } from '@flama/design-system-web';
import { ArrowLeft } from '@flama/design-system-web/icons';
import type { TwoFactorMethod, VerifyTwoFactorParams } from '@flama/frontend-core';
import { type TwoFactorChallengeDto, twoFactorChallengeSchema } from '@flama/shared/schemas/auth';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useZodResolver } from '../../forms';
import { AuthField, AuthFormError, authInputClass } from '../components/auth-primitives';
import { TwoFactorSubmit } from '../components/two-factor-submit';

/**
 * The second step of a password sign-in on an account with two-factor on: a
 * code from the authenticator app, or a backup code when the app is out of
 * reach. Both web apps' login screens show it when `useLogin` rejects with
 * `isTwoFactorRequired`, and hand the values to `useVerifyTwoFactor`.
 */
export function TwoFactorChallengeForm({
  method,
  onMethodChange,
  isPending,
  error,
  onSubmit,
  onCancel,
}: {
  /** The authenticator app's code, or a backup code; the section shows the heading for it. */
  method: TwoFactorMethod;
  onMethodChange: (method: TwoFactorMethod) => void;
  isPending: boolean;
  /** The resolved failure message, if the last attempt failed. */
  error?: string;
  onSubmit: (values: VerifyTwoFactorParams) => void;
  /** Back to the password step, e.g. to sign in as somebody else. */
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    control,
    handleSubmit,
    resetField,
    formState: { errors },
  } = useForm<TwoFactorChallengeDto>({
    resolver: useZodResolver(twoFactorChallengeSchema),
    defaultValues: { code: '', trustDevice: false },
  });

  const switchMethod = () => {
    onMethodChange(method === 'totp' ? 'backup-code' : 'totp');
    resetField('code');
  };

  return (
    <form onSubmit={handleSubmit((values) => onSubmit({ ...values, method }))} noValidate>
      <FieldGroup className="gap-4">
        {error && <AuthFormError>{error}</AuthFormError>}

        {method === 'totp' ? (
          <AuthField label={t('auth.twoFactor.code')} htmlFor="two-factor-code" error={errors.code}>
            <Input
              {...register('code')}
              id="two-factor-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              aria-invalid={Boolean(errors.code)}
              disabled={isPending}
              className={authInputClass}
            />
          </AuthField>
        ) : (
          <AuthField
            label={t('auth.twoFactor.backupCode')}
            htmlFor="two-factor-backup-code"
            error={errors.code}
          >
            <Input
              {...register('code')}
              id="two-factor-backup-code"
              autoComplete="off"
              spellCheck={false}
              placeholder="xxxxx-xxxxx"
              aria-invalid={Boolean(errors.code)}
              disabled={isPending}
              className={authInputClass}
            />
          </AuthField>
        )}

        <Controller
          control={control}
          name="trustDevice"
          render={({ field }) => (
            <div className="flex items-center gap-2.5">
              <Checkbox
                id="two-factor-trust-device"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                disabled={isPending}
              />
              <Label htmlFor="two-factor-trust-device" className="font-normal">
                {t('auth.twoFactor.trustDevice')}
              </Label>
            </div>
          )}
        />

        <TwoFactorSubmit control={control} method={method} isPending={isPending} />

        <div className="flex items-center justify-between gap-3">
          <DsButton size="text" onClick={switchMethod} disabled={isPending}>
            {method === 'totp' ? t('auth.twoFactor.useBackupCode') : t('auth.twoFactor.useApp')}
          </DsButton>
          <DsButton
            size="text"
            icon={<ArrowLeft className="size-4" />}
            onClick={onCancel}
            disabled={isPending}
          >
            {t('auth.twoFactor.back')}
          </DsButton>
        </div>
      </FieldGroup>
    </form>
  );
}
