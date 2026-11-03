import { DsModalBody, DsModalFooter } from '@flama/design-system-web';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { BackButton } from '@/features/profile/components/back-button';
import { FormSubmit } from '@/features/profile/components/form-submit';

const FORM = 'confirm-password';

interface ConfirmPasswordValues {
  password: string;
}

/**
 * One password field, for a step that has to know it is you: starting
 * two-factor, or turning it off. `submit` labels the button once it is typed.
 */
export function ConfirmPasswordForm({
  label,
  emptyLabel,
  submit,
  isPending,
  onBack,
  onSubmit,
}: {
  label: string;
  emptyLabel: string;
  submit: string;
  isPending: boolean;
  onBack: () => void;
  onSubmit: (password: string) => void;
}) {
  const { t } = useTranslation();
  const { register, control, handleSubmit } = useForm<ConfirmPasswordValues>({
    defaultValues: { password: '' },
  });

  return (
    <form
      id={FORM}
      className="contents"
      onSubmit={handleSubmit(({ password }) => password && onSubmit(password))}
      noValidate
    >
      <DsModalBody>
        <label className="ds-field">
          <span className="ds-label">{label}</span>
          <input
            {...register('password')}
            type="password"
            autoComplete="current-password"
            placeholder={t('settings.twoFactorSetup.passwordPlaceholder')}
            className="ds-text-field ds-text-field--sm"
          />
        </label>
      </DsModalBody>
      <DsModalFooter start={<BackButton onClick={onBack} />}>
        <FormSubmit
          control={control}
          form={FORM}
          pending={isPending}
          cta={(values) =>
            values.password ? { label: submit, ready: true } : { label: emptyLabel, ready: false }
          }
        />
      </DsModalFooter>
    </form>
  );
}
