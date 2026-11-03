import { DsButton, FieldGroup } from '@flama/design-system-web';
import {
  AuthField,
  AuthFormError,
  PasswordChecklist,
  PasswordInput,
  type PasswordRule,
  useZodResolver,
} from '@flama/frontend-web';
import { type NewPasswordValues, newPasswordSchema } from '@flama/shared/schemas/auth';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/**
 * The token rides in the URL, so only the two password fields are user input
 * (`newPasswordSchema`). Whether they match is not a schema rule: `match` here
 * has the live checklist report it and gate the submit button, and a
 * `refine()` would need a message string, which the shared schemas
 * deliberately never carry.
 */

const RULES: readonly PasswordRule[] = ['length', 'number', 'match'];

/** The design's button names the first rule still unmet, then says what it does. */
function submitLabel(results: Record<PasswordRule, boolean>): string {
  if (!results.length) return 'auth.resetPassword.cta.length';
  if (!results.number) return 'auth.resetPassword.cta.number';
  if (!results.match) return 'auth.resetPassword.cta.match';
  return 'auth.resetPassword.submit';
}

export function ResetPasswordForm({
  isPending,
  error,
  onSubmit,
}: {
  isPending: boolean;
  /** The resolved failure message, if the last attempt failed. */
  error?: string;
  onSubmit: (values: NewPasswordValues) => void;
}) {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<NewPasswordValues>({
    resolver: useZodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-4">
        {error && <AuthFormError>{error}</AuthFormError>}

        <AuthField
          label={t('auth.resetPassword.newPassword')}
          htmlFor="password"
          error={errors.password}
        >
          <PasswordInput
            {...register('password')}
            id="password"
            autoComplete="new-password"
            placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
            aria-invalid={Boolean(errors.password)}
            disabled={isPending}
          />
        </AuthField>

        <AuthField
          label={t('auth.resetPassword.confirmPassword')}
          htmlFor="confirmPassword"
          error={errors.confirmPassword}
        >
          <PasswordInput
            {...register('confirmPassword')}
            id="confirmPassword"
            autoComplete="new-password"
            placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
            aria-invalid={Boolean(errors.confirmPassword)}
            disabled={isPending}
          />
        </AuthField>

        <PasswordChecklist
          control={control}
          name="password"
          confirmName="confirmPassword"
          rules={RULES}
          className="-mt-1.5 mb-1.5"
        >
          {(satisfied, results) => (
            <DsButton
              type="submit"
              variant="primary"
              size="md"
              block
              disabled={isPending || !satisfied}
            >
              {isPending
                ? t('auth.resetPassword.submitting')
                : t(submitLabel(results) as 'auth.resetPassword.submit')}
            </DsButton>
          )}
        </PasswordChecklist>
      </FieldGroup>
    </form>
  );
}
