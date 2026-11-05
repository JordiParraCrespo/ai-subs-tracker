import { DsModalBody, DsModalFooter } from '@flama/design-system-web';
import { PasswordInput, useZodResolver } from '@flama/frontend-web';
import { changeOwnPasswordSchema } from '@flama/shared/schemas/profile';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { BackButton } from '@/features/profile/components/back-button';
import { FormSubmit } from '@/features/profile/components/form-submit';

const FORM = 'change-password';

const changePasswordFormSchema = changeOwnPasswordSchema
  .pick({ currentPassword: true, newPassword: true })
  .extend({ confirmPassword: z.string() })
  .refine((values) => /\d/.test(values.newPassword), { path: ['newPassword'] })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;

/** The first thing the password still needs, in the order the fields read. */
function missing(
  values: Partial<ChangePasswordFormValues>,
): 'current' | 'length' | 'number' | 'match' | null {
  const next = values.newPassword ?? '';
  if (!values.currentPassword) return 'current';
  if (next.length < 8) return 'length';
  if (!/\d/.test(next)) return 'number';
  if (next !== values.confirmPassword) return 'match';
  return null;
}

/** The security dialog's password step: current, new and confirm, under a footer that says what is missing. */
export function ChangePasswordForm({
  isPending,
  onBack,
  onSubmit,
}: {
  isPending: boolean;
  onBack: () => void;
  onSubmit: (values: ChangePasswordFormValues) => void;
}) {
  const { t } = useTranslation();
  const { register, control, handleSubmit } = useForm<ChangePasswordFormValues>({
    resolver: useZodResolver(changePasswordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  return (
    <form id={FORM} className="contents" onSubmit={handleSubmit(onSubmit)} noValidate>
      <DsModalBody>
        <div className="ds-field">
          <label htmlFor={`${FORM}-current`} className="ds-label">
            {t('settings.changePassword.current')}
          </label>
          <PasswordInput
            {...register('currentPassword')}
            id={`${FORM}-current`}
            autoComplete="current-password"
            className="ds-text-field--sm"
          />
        </div>
        <div className="ds-field">
          <label htmlFor={`${FORM}-new`} className="ds-label">
            {t('settings.changePassword.new')}
          </label>
          <PasswordInput
            {...register('newPassword')}
            id={`${FORM}-new`}
            autoComplete="new-password"
            className="ds-text-field--sm"
          />
        </div>
        <div className="ds-field">
          <label htmlFor={`${FORM}-confirm`} className="ds-label">
            {t('settings.changePassword.confirm')}
          </label>
          <PasswordInput
            {...register('confirmPassword')}
            id={`${FORM}-confirm`}
            autoComplete="new-password"
            className="ds-text-field--sm"
          />
        </div>
        <span className="ds-t-sub">{t('settings.changePassword.note')}</span>
      </DsModalBody>
      <DsModalFooter start={<BackButton onClick={onBack} />}>
        <FormSubmit
          control={control}
          form={FORM}
          pending={isPending}
          cta={(values) => {
            const need = missing(values);
            return need
              ? { label: t(`settings.changePassword.cta.${need}`), ready: false }
              : { label: t('settings.changePassword.submit'), ready: true };
          }}
        />
      </DsModalFooter>
    </form>
  );
}
