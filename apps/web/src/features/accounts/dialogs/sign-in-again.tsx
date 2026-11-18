import {
  Alert,
  AlertDescription,
  DsButton,
  DsModal,
  DsModalBody,
  DsModalFooter,
  DsModalHeader,
} from '@flama/design-system-web';
import type { AccountEntity } from '@flama/frontend-consumer';
import { desktopBridge } from '@flama/frontend-web';
import type { LocalProviderId } from '@flama/shared/subscriptions';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClaudeSignIn } from '../components/claude-sign-in';
import { DeviceCodeSignIn } from '../components/device-code-sign-in';
import { SignInCodeForm } from '../forms/sign-in-code-form';
import { useAddLogin } from '../hooks/use-add-login';
import { PROVIDER_NAMES } from '../lib/providers';

type Step = { kind: 'confirm' } | { kind: 'sign-in' } | { kind: 'code' };

/**
 * Signs an account found on this computer in again, in the folder it already
 * lives in: for a login read as out of date or signed out that its own CLI
 * did not renew (a Grok Build session nobody opened `grok` to refresh). It
 * runs the provider's CLI login, as adding an account does, and keeps the
 * account, its history and the terminals that use it.
 */
export function SignInAgainDialog({
  account,
  provider,
  onClose,
}: {
  account: AccountEntity;
  provider: LocalProviderId;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>({ kind: 'confirm' });
  const login = useAddLogin({ onAdded: onClose, onFailed: () => setStep({ kind: 'confirm' }) });
  const back = () => {
    login.cancel();
    setStep({ kind: 'confirm' });
  };
  const start = () => {
    setStep({ kind: 'sign-in' });
    void login.start(provider, { externalId: account.externalId });
  };

  return (
    <DsModal open onOpenChange={(open) => !open && onClose()} className="ds-modal--wide">
      {step.kind === 'confirm' && (
        <>
          <DsModalHeader
            closeLabel={t('common.close')}
            title={t('accounts.signInAgain.title', { name: account.displayName })}
            description={t('accounts.signInAgain.description', {
              provider: PROVIDER_NAMES[provider],
            })}
          />
          <DsModalBody className="ds-modal__body--flow">
            {login.failure && (
              <Alert variant="destructive">
                <AlertDescription className="whitespace-pre-line break-words">
                  {login.failure}
                </AlertDescription>
              </Alert>
            )}
            {account.latest?.message && (
              <p className="ds-t-sub m-0" data-testid="reading-message">
                {account.latest.message}
              </p>
            )}
          </DsModalBody>
          <DsModalFooter>
            <DsButton variant="primary" size="sm" onClick={start}>
              {t('accounts.signInAgain.submit')}
            </DsButton>
          </DsModalFooter>
        </>
      )}

      {step.kind === 'sign-in' && provider === 'claude-code' && (
        <ClaudeSignIn
          link={login.progress.link}
          codeLink={login.progress.codeLink}
          deadline={login.progress.deadline}
          onBack={back}
          onOpen={(link) => void desktopBridge?.openExternal(link)}
          onUseCode={() => setStep({ kind: 'code' })}
        />
      )}

      {step.kind === 'sign-in' && (provider === 'codex' || provider === 'grok') && (
        <DeviceCodeSignIn
          provider={provider}
          deviceCode={login.deviceCode}
          code={login.progress.code}
          link={login.progress.link}
          onBack={back}
          onOpen={(link) => void desktopBridge?.openExternal(link)}
          onSwitch={login.switchMode}
        />
      )}

      {step.kind === 'code' && login.progress.codeLink && (
        <SignInCodeForm
          link={login.progress.codeLink}
          submitting={login.submitting}
          onBack={() => setStep({ kind: 'sign-in' })}
          onSubmit={login.submitCode}
        />
      )}
    </DsModal>
  );
}
