import { DsButton, DsModalBody, DsModalFooter, DsModalHeader } from '@flama/design-system-web';
import { ArrowLeft, ArrowUpRight, Check, Copy } from '@flama/design-system-web/icons';
import { useCopy } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { TimeLeft } from './time-left';
import { WaitingCard } from './waiting-card';

/**
 * Claude Code's sign-in step. `link` is the automatic one: opened in any
 * browser on this computer, a private window included (so another account
 * stays signed in), it finishes the sign-in by itself. `codeLink` is the
 * manual one, which ends at claude.com showing a code to paste back; when it
 * is all there is, copying it goes straight to the step that takes the code.
 */
export function ClaudeSignIn({
  link,
  codeLink,
  deadline,
  onBack,
  onOpen,
  onUseCode,
}: {
  link: string | null;
  codeLink: string | null;
  deadline: string | null;
  onBack: () => void;
  onOpen: (link: string) => void;
  onUseCode: () => void;
}) {
  const { t } = useTranslation();
  const { copied, copy } = useCopy();
  const codeOnly = !link && !!codeLink;

  const copyLink = () => {
    if (link) {
      void copy(link);
    } else if (codeLink) {
      void copy(codeLink);
      onUseCode();
    }
  };

  return (
    <>
      <DsModalHeader
        closeLabel={t('common.close')}
        title={t('accounts.add.claude.title')}
        description={t('accounts.add.claude.description')}
      />
      <DsModalBody className="ds-modal__body--flow">
        <WaitingCard
          title={
            link || codeLink ? t('accounts.add.claude.waiting') : t('accounts.add.claude.preparing')
          }
          detail={<TimeLeft deadline={deadline} />}
        />
        <div className="ds-stack-4">
          <span className="ds-label-strong">{t('accounts.add.claude.otherTitle')}</span>
          <span className="ds-t-sub">
            {codeOnly ? t('accounts.add.claude.codeOnlyText') : t('accounts.add.claude.otherText')}
          </span>
        </div>
      </DsModalBody>
      <DsModalFooter
        start={
          <DsButton size="text" icon={<ArrowLeft className="size-4" />} onClick={onBack}>
            {t('accounts.add.back')}
          </DsButton>
        }
      >
        <DsButton variant="ghost" size="sm" disabled={!codeLink} onClick={onUseCode}>
          {t('accounts.add.claude.useCode')}
        </DsButton>
        <DsButton
          size="sm"
          disabled={!link && !codeLink}
          icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          onClick={copyLink}
        >
          {copied ? t('accounts.add.claude.linkCopied') : t('accounts.add.claude.copyLink')}
        </DsButton>
        {link && (
          <DsButton
            variant="primary"
            size="sm"
            iconEnd={<ArrowUpRight className="size-4" />}
            onClick={() => onOpen(link)}
          >
            {t('accounts.add.claude.open')}
          </DsButton>
        )}
      </DsModalFooter>
    </>
  );
}
