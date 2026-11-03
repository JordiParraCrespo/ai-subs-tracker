import { DsModalFooter } from '@flama/design-system-web';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { BackButton } from '@/features/profile/components/back-button';
import { FormSubmit } from '@/features/profile/components/form-submit';

const FORM = 'totp-code';

interface TotpCodeValues {
  code: string;
}

const digits = (code = '') => code.replace(/\s/g, '');

/**
 * The first code from the authenticator app, which is what turns two-factor
 * on. `children` is what sits above the field: the QR code and the key.
 */
export function TotpCodeForm({
  isPending,
  onBack,
  onSubmit,
  children,
}: {
  isPending: boolean;
  onBack: () => void;
  onSubmit: (code: string) => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { register, control, handleSubmit } = useForm<TotpCodeValues>({
    defaultValues: { code: '' },
  });

  return (
    <form
      id={FORM}
      className="contents"
      onSubmit={handleSubmit(({ code }) => /^\d{6}$/.test(digits(code)) && onSubmit(digits(code)))}
      noValidate
    >
      <div className="ds-modal__body ds-modal__body--loose ds-scroll">
        {children}
        <label className="ds-field">
          <span className="ds-label">{t('settings.twoFactorSetup.code')}</span>
          <input
            {...register('code')}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className="ds-text-field ds-text-field--sm"
          />
        </label>
      </div>
      <DsModalFooter start={<BackButton onClick={onBack} />}>
        <FormSubmit
          control={control}
          form={FORM}
          pending={isPending}
          cta={(values) =>
            /^\d{6}$/.test(digits(values.code))
              ? { label: t('settings.twoFactorSetup.verify'), ready: true }
              : { label: t('settings.twoFactorSetup.codeEmpty'), ready: false }
          }
        />
      </DsModalFooter>
    </form>
  );
}
