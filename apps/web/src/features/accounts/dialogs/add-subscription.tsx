import {
  Alert,
  AlertDescription,
  DsButton,
  DsModal,
  DsModalBody,
  DsModalFooter,
  DsModalHeader,
  toast,
} from '@flama/design-system-web';
import { ArrowLeft } from '@flama/design-system-web/icons';
import { useCreateAccount } from '@flama/frontend-consumer/react';
import { desktopBridge, useErrorMessage } from '@flama/frontend-web';
import type { AddManualAccountFormValues } from '@flama/shared/schemas/accounts';
import {
  isManualProvider,
  type LocalProviderId,
  type ManualProviderId,
  type ProviderId,
} from '@flama/shared/subscriptions';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClaudeSignIn } from '../components/claude-sign-in';
import { DeviceCodeSignIn } from '../components/device-code-sign-in';
import { ProviderPickRow } from '../components/provider-pick-row';
import { AddManualAccountForm } from '../forms/add-manual-account-form';
import { SignInCodeForm } from '../forms/sign-in-code-form';
import { useAddLogin } from '../hooks/use-add-login';
import { PROVIDER_COLORS } from '../lib/marks';
import { PROVIDER_NAMES, PROVIDER_ORDER } from '../lib/providers';

const INITIALS = {
  'claude-code': 'CC',
  codex: 'CX',
  grok: 'GB',
  zai: 'ZA',
  bigmodel: 'BM',
} as const satisfies Record<ProviderId, string>;

const MANUAL_FORM = 'add-manual-account';

type Step =
  | { kind: 'pick' }
  | { kind: 'sign-in'; provider: LocalProviderId }
  | { kind: 'code' }
  | { kind: 'desktop' }
  | { kind: 'manual'; provider: ManualProviderId };

/**
 * The design's Add subscription modal: pick a tool, then follow its CLI's
 * sign-in (Claude in a browser on this computer or by a pasted code, Codex and
 * Grok Build by a one-time code). The
 * sign-in runs on the machine, so in a browser picking one says where to do
 * it instead. A tool with nothing to sign in to on the machine (Z.AI,
 * BigModel) is a short form instead, in the browser too: ResetOwl tracks its
 * plan; reading its usage with a key is a later, opt-in step in the desktop app.
 * Opened from a calendar day, the form starts with that billing day; a login
 * signed in here reports its own day or gets one set afterwards.
 */
export function AddSubscriptionDialog({
  renewalDay,
  onClose,
}: {
  /** Opened from a calendar day: the hand-added plan starts billing on it. */
  renewalDay?: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const login = useAddLogin({ onAdded: onClose, onFailed: () => setStep({ kind: 'pick' }) });
  const back = () => {
    login.cancel();
    setStep({ kind: 'pick' });
  };

  const resolveError = useErrorMessage();
  const create = useCreateAccount({
    onSuccess: () => {
      toast.success(t('toasts.subscriptionAdded'));
      onClose();
    },
  });

  const pick = (provider: ProviderId) => {
    if (isManualProvider(provider)) {
      setStep({ kind: 'manual', provider });
      return;
    }
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
                <AlertDescription className="whitespace-pre-line break-words">
                  {login.failure}
                </AlertDescription>
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
          codeLink={login.progress.codeLink}
          deadline={login.progress.deadline}
          onBack={back}
          onOpen={(link) => void desktopBridge?.openExternal(link)}
          onUseCode={() => setStep({ kind: 'code' })}
        />
      )}

      {step.kind === 'sign-in' && (step.provider === 'codex' || step.provider === 'grok') && (
        <DeviceCodeSignIn
          provider={step.provider}
          code={login.progress.code}
          link={login.progress.link}
          onBack={back}
          onOpen={(link) => void desktopBridge?.openExternal(link)}
        />
      )}

      {step.kind === 'code' && login.progress.codeLink && (
        <SignInCodeForm
          link={login.progress.codeLink}
          submitting={login.submitting}
          onBack={() => setStep({ kind: 'sign-in', provider: 'claude-code' })}
          onSubmit={login.submitCode}
        />
      )}

      {step.kind === 'manual' && (
        <>
          <DsModalHeader
            closeLabel={t('common.close')}
            title={t('accounts.add.manual.title', { name: PROVIDER_NAMES[step.provider] })}
            description={t('accounts.add.manual.description', {
              name: PROVIDER_NAMES[step.provider],
            })}
          />
          <DsModalBody>
            {create.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {resolveError(create.error, t('common.error')).message}
                </AlertDescription>
              </Alert>
            )}
            <AddManualAccountForm
              id={MANUAL_FORM}
              provider={step.provider}
              renewalDay={renewalDay}
              isPending={create.isPending}
              onSubmit={(values) => create.mutate(toCreateInput(step.provider, values))}
            />
            <p className="ds-t-sub m-0">
              {t('accounts.add.manual.noKey', { name: PROVIDER_NAMES[step.provider] })}
            </p>
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
          >
            <DsButton
              variant="primary"
              size="sm"
              type="submit"
              form={MANUAL_FORM}
              disabled={create.isPending}
            >
              {t('accounts.add.manual.submit')}
            </DsButton>
          </DsModalFooter>
        </>
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

/** The form as typed, onto the API's input: empty means not set, prices in cents. */
function toCreateInput(provider: ManualProviderId, values: AddManualAccountFormValues) {
  return {
    provider,
    label: values.label,
    email: values.email === '' ? null : values.email,
    planId: values.planId,
    monthlyPriceCents: values.price === '' ? null : Math.round(Number(values.price) * 100),
    renewalDay: values.renewalDay === '' ? null : Number(values.renewalDay),
  };
}
