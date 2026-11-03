import {
  Alert,
  AlertDescription,
  DsButton,
  DsModal,
  DsModalBody,
  DsModalFooter,
  DsModalHeader,
} from '@flama/design-system-web';
import { ArrowLeft } from '@flama/design-system-web/icons';
import { desktopBridge } from '@flama/frontend-web';
import type { ProviderId } from '@flama/shared/subscriptions';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClaudeSignIn } from '../components/claude-sign-in';
import { CodexSignIn } from '../components/codex-sign-in';
import { ProviderPickRow } from '../components/provider-pick-row';
import { SignInCodeForm } from '../forms/sign-in-code-form';
import { useAddLogin } from '../hooks/use-add-login';
import { PROVIDER_COLORS } from '../lib/marks';
import { PROVIDER_NAMES, PROVIDER_ORDER } from '../lib/providers';

const INITIALS = { 'claude-code': 'CC', codex: 'CX' } as const satisfies Record<ProviderId, string>;

type Step =
  | { kind: 'pick' }
  | { kind: 'sign-in'; provider: ProviderId }
  | { kind: 'code' }
  | { kind: 'desktop' };

/**
 * The design's Add subscription modal, for the two tools that sign in:
 * pick one, then follow its CLI's sign-in (Claude in the browser or by code,
 * Codex by a one-time code). The sign-in runs on the machine, so in a browser
 * picking a tool says where to do it instead.
 */
export function AddSubscriptionDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const login = useAddLogin({ onAdded: onClose, onFailed: () => setStep({ kind: 'pick' }) });
  const back = () => {
    login.cancel();
    setStep({ kind: 'pick' });
  };

  const pick = (provider: ProviderId) => {
    if (!desktopBridge) {
      setStep({ kind: 'desktop' });
      return;
    }
    setStep({ kind: 'sign-in', provider });
    void login.start(provider);
  };

  return (
    <DsModal open onOpenChange={(open) => !open && onClose()} className="ds-modal--wide">
      {step.kind === 'pick' && (
        <>
          <DsModalHeader
            closeLabel={t('common.close')}
            title={t('accounts.add.title')}
            description={t('accounts.add.description')}
          />
          <DsModalBody className="ds-modal__body--list">
            {login.failure && (
              <Alert variant="destructive">
                <AlertDescription>{login.failure}</AlertDescription>
              </Alert>
            )}
            {PROVIDER_ORDER.map((provider) => (
              <ProviderPickRow
                key={provider}
                name={PROVIDER_NAMES[provider]}
                how={t(`accounts.add.how.${provider}`)}
                initials={INITIALS[provider]}
                color={PROVIDER_COLORS[provider]}
                onPick={() => pick(provider)}
              />
            ))}
          </DsModalBody>
        </>
      )}

      {step.kind === 'sign-in' && step.provider === 'claude-code' && (
        <ClaudeSignIn
          link={login.progress.link}
          onBack={back}
          onUseCode={() => setStep({ kind: 'code' })}
        />
      )}

      {step.kind === 'sign-in' && step.provider === 'codex' && (
        <CodexSignIn
          code={login.progress.code}
          link={login.progress.link}
          onBack={back}
          onOpen={(link) => void desktopBridge?.openExternal(link)}
        />
      )}

      {step.kind === 'code' && login.progress.link && (
        <SignInCodeForm
          link={login.progress.link}
          submitting={login.submitting}
          onBack={() => setStep({ kind: 'sign-in', provider: 'claude-code' })}
          onSubmit={login.submitCode}
        />
      )}

      {step.kind === 'desktop' && (
        <>
          <DsModalHeader
            closeLabel={t('common.close')}
            title={t('accounts.add.desktop.title')}
            description={t('accounts.add.desktop.description')}
          />
          <DsModalBody className="ds-modal__body--flow">
            <p className="ds-t-sub m-0">{t('accounts.add.desktop.text')}</p>
          </DsModalBody>
          <DsModalFooter
            start={
              <DsButton
                size="text"
                icon={<ArrowLeft className="size-4" />}
                onClick={() => setStep({ kind: 'pick' })}
              >
                {t('accounts.add.back')}
              </DsButton>
            }
          />
        </>
      )}
    </DsModal>
  );
}
