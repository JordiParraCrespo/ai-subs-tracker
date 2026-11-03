import { DsButton, DsModalBody, DsModalFooter, DsModalHeader } from '@flama/design-system-web';
import { ArrowLeft, Check, Copy } from '@flama/design-system-web/icons';
import { useCopy } from '@flama/frontend-web';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

interface SignInCodeValues {
  code: string;
}

/**
 * Claude Code's sign-in by code, for a browser on another device: the link to
 * open there, and the code claude.com shows afterwards, which goes to the CLI.
 */
export function SignInCodeForm({
  link,
  submitting,
  onBack,
  onSubmit,
}: {
  link: string;
  submitting: boolean;
  onBack: () => void;
  onSubmit: (code: string) => void;
}) {
  const { t } = useTranslation();
  const { copied, copy } = useCopy();
  const { register, control, handleSubmit } = useForm<SignInCodeValues>({
    defaultValues: { code: '' },
  });
  // The one field is the whole form: the button reads it to say what it needs.
  const code = useWatch({ control, name: 'code' }).trim();
  const ready = code.length >= 8;

  return (
    <form
      className="contents"
      onSubmit={handleSubmit((values) => ready && onSubmit(values.code.trim()))}
      noValidate
    >
      <DsModalHeader
        closeLabel={t('common.close')}
        title={t('accounts.add.code.title')}
        description={t('accounts.add.code.description')}
      />
      <DsModalBody className="ds-modal__body--flow">
        <div className="ds-stack-8">
          <span className="ds-label-strong">{t('accounts.add.code.open')}</span>
          <div className="ds-link-field">
            <span className="ds-link-field__value">{link}</span>
            <DsButton
              size="xs"
              icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              onClick={() => void copy(link)}
            >
              {copied ? t('accounts.add.code.copied') : t('accounts.add.code.copy')}
            </DsButton>
          </div>
        </div>
        <label className="ds-field">
          <span className="ds-label">{t('accounts.add.code.paste')}</span>
          <input
            {...register('code')}
            autoComplete="off"
            spellCheck={false}
            placeholder={t('accounts.add.code.placeholder')}
            className="ds-text-field ds-text-field--sm"
          />
        </label>
      </DsModalBody>
      <DsModalFooter
        start={
          <DsButton size="text" icon={<ArrowLeft className="size-4" />} onClick={onBack}>
            {t('accounts.add.back')}
          </DsButton>
        }
      >
        <DsButton variant="primary" size="sm" type="submit" disabled={!ready || submitting}>
          {submitting
            ? t('accounts.add.code.checking')
            : ready
              ? t('accounts.add.code.submit')
              : t('accounts.add.code.empty')}
        </DsButton>
      </DsModalFooter>
    </form>
  );
}
