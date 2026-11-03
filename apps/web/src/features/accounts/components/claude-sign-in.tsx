import { DsButton, DsModalBody, DsModalFooter, DsModalHeader } from '@flama/design-system-web';
import { ArrowLeft, Check, Copy } from '@flama/design-system-web/icons';
import { useCopy } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { WaitingCard } from './waiting-card';

/**
 * Claude Code's sign-in step: the CLI has opened claude.com, and this waits
 * for it. Its manual link can be copied into a private window (another
 * account stays signed in) or followed to a code to paste instead.
 */
export function ClaudeSignIn({
  link,
  onBack,
  onUseCode,
}: {
  link: string | null;
  onBack: () => void;
  onUseCode: () => void;
}) {
  const { t } = useTranslation();
  const { copied, copy } = useCopy();

  return (
    <>
      <DsModalHeader
        title={t('accounts.add.claude.title')}
        description={t('accounts.add.claude.description')}
      />
      <DsModalBody className="ds-modal__body--flow">
        <WaitingCard
          title={t('accounts.add.claude.waiting')}
          detail={t('accounts.add.claude.expires')}
        />
        <div className="ds-stack-4">
          <span className="ds-label-strong">{t('accounts.add.claude.otherTitle')}</span>
          <span className="ds-t-sub">{t('accounts.add.claude.otherText')}</span>
        </div>
      </DsModalBody>
      <DsModalFooter
        start={
          <DsButton size="text" icon={<ArrowLeft className="size-4" />} onClick={onBack}>
            {t('accounts.add.back')}
          </DsButton>
        }
      >
        <DsButton variant="ghost" size="sm" disabled={!link} onClick={onUseCode}>
          {t('accounts.add.claude.useCode')}
        </DsButton>
        <DsButton
          size="sm"
          disabled={!link}
          icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          onClick={() => link && void copy(link)}
        >
          {copied ? t('accounts.add.claude.linkCopied') : t('accounts.add.claude.copyLink')}
        </DsButton>
      </DsModalFooter>
    </>
  );
}
