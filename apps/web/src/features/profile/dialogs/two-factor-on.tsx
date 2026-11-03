import {
  DsButton,
  DsCheckbox,
  DsModalBody,
  DsModalFooter,
  DsModalHeader,
  toast,
} from '@flama/design-system-web';
import { Check, Copy, Download } from '@flama/design-system-web/icons';
import { useConfirmTwoFactor, useEnableTwoFactor } from '@flama/frontend-consumer/react';
import { useCopy, useErrorMessage } from '@flama/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StepError } from '@/features/profile/components/step-error';
import { TotpQrCode } from '@/features/profile/components/totp-qr-code';
import { ConfirmPasswordForm } from '@/features/profile/forms/confirm-password-form';
import { TotpCodeForm } from '@/features/profile/forms/totp-code-form';
import { downloadText } from '@/features/profile/lib/download';
import { groupSecret, totpSecretOf } from '@/features/profile/lib/totp';

/**
 * Sets up an authenticator app in the design's three steps, which follow from
 * the two mutations it owns: the password starts an enrolment, the first code
 * from the app confirms it (that is what turns two-factor on), and then the
 * backup codes are shown this once. Leaving before the code changes nothing.
 */
export function TwoFactorOnStep({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const keyCopy = useCopy();
  const codesCopy = useCopy();
  const [saved, setSaved] = useState(false);
  const enable = useEnableTwoFactor();
  const confirm = useConfirmTwoFactor({
    onSuccess: () => toast.success(t('toasts.twoFactorEnabled')),
  });

  const enrolment = enable.data;
  const step = !enrolment ? 1 : !confirm.isSuccess ? 2 : 3;
  const eyebrow = t('settings.security.step', { step });
  const failed = step === 1 ? enable.error : confirm.error;
  const error = failed ? (
    <StepError message={resolveError(failed, t('common.error')).message} />
  ) : null;

  if (step === 1 || !enrolment) {
    return (
      <>
        <DsModalHeader
          closeLabel={t('common.close')}
          eyebrow={eyebrow}
          title={t('settings.twoFactorSetup.passwordTitle')}
          description={t('settings.twoFactorSetup.passwordDescription')}
        />
        {error}
        <ConfirmPasswordForm
          label={t('settings.twoFactorSetup.password')}
          emptyLabel={t('settings.twoFactorSetup.passwordEmpty')}
          submit={t('settings.twoFactorSetup.continue')}
          isPending={enable.isPending}
          onBack={onBack}
          onSubmit={(password) => enable.mutate(password)}
        />
      </>
    );
  }

  if (step === 2) {
    const secret = groupSecret(totpSecretOf(enrolment.totpURI));
    return (
      <>
        <DsModalHeader
          closeLabel={t('common.close')}
          eyebrow={eyebrow}
          title={t('settings.twoFactorSetup.scanTitle')}
          description={t('settings.twoFactorSetup.scanDescription')}
        />
        {error}
        <TotpCodeForm
          isPending={confirm.isPending}
          onBack={() => enable.reset()}
          onSubmit={(code) => confirm.mutate(code)}
        >
          <div className="flex items-center gap-5">
            <TotpQrCode
              value={enrolment.totpURI}
              label={t('settings.twoFactorSetup.qrLabel')}
              className="size-34 flex-none rounded-2xl"
            />
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="ds-label-strong">{t('settings.twoFactorSetup.cantScan')}</span>
              <span className="ds-t-sub">{t('settings.twoFactorSetup.enterKey')}</span>
              <code className="ds-mono-key">{secret}</code>
              <div>
                <DsButton
                  size="text"
                  icon={keyCopy.copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  onClick={() => keyCopy.copy(secret.replaceAll(' ', ''))}
                >
                  {keyCopy.copied
                    ? t('settings.twoFactorSetup.copied')
                    : t('settings.twoFactorSetup.copy')}
                </DsButton>
              </div>
            </div>
          </div>
        </TotpCodeForm>
      </>
    );
  }

  const codes = enrolment.backupCodes;
  return (
    <>
      <DsModalHeader
        closeLabel={t('common.close')}
        eyebrow={eyebrow}
        title={t('settings.twoFactorSetup.codesTitle')}
        description={t('settings.twoFactorSetup.codesDescription')}
      />
      <DsModalBody>
        <ul className="ds-code-grid" aria-label={t('settings.twoFactorSetup.codesLabel')}>
          {codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <div className="flex gap-2">
          <DsButton
            size="xs"
            icon={<Download className="size-4" />}
            onClick={() => downloadText('resetowl-backup-codes.txt', codes.join('\n'))}
          >
            {t('settings.twoFactorSetup.download')}
          </DsButton>
          <DsButton
            size="xs"
            icon={codesCopy.copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            onClick={() => codesCopy.copy(codes.join('\n'))}
          >
            {codesCopy.copied
              ? t('settings.twoFactorSetup.copied')
              : t('settings.twoFactorSetup.copy')}
          </DsButton>
        </div>
        <DsCheckbox checked={saved} onCheckedChange={setSaved}>
          {t('settings.twoFactorSetup.saved')}
        </DsCheckbox>
      </DsModalBody>
      <DsModalFooter>
        <DsButton variant="primary" size="sm" disabled={!saved} onClick={onBack}>
          {saved ? t('settings.twoFactorSetup.done') : t('settings.twoFactorSetup.savedEmpty')}
        </DsButton>
      </DsModalFooter>
    </>
  );
}
