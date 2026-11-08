import { DsButton, DsModalBody, DsModalFooter, DsModalHeader } from '@flama/design-system-web';
import { ArrowLeft, ArrowUpRight, Check, Copy } from '@flama/design-system-web/icons';
import { useCopy } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { WaitingCard } from './waiting-card';

/**
 * A device-code sign-in step (Codex, Grok Build): the code the CLI printed, to
 * enter on the vendor's device page, and a wait for the approval to land. The
 * page's link can be copied into a private window, so the account the browser
 * is signed in to now is not the one added again.
 */
export function DeviceCodeSignIn({
  provider,
  code,
  link,
  onBack,
  onOpen,
}: {
  provider: 'codex' | 'grok';
  code: string | null;
  link: string | null;
  onBack: () => void;
  onOpen: (link: string) => void;
}) {
  const { t } = useTranslation();
  const { copied, copy } = useCopy();
  const linkCopy = useCopy();

  return (
    <>
      <DsModalHeader
        closeLabel={t('common.close')}
        title={t(`accounts.add.${provider}.title`)}
        description={t(`accounts.add.${provider}.description`)}
      />
      <DsModalBody className="ds-modal__body--flow">
        {code ? (
          <div className="ds-device-code">
            <span className="ds-device-code__value" data-testid="device-code">
              {code}
            </span>
            <button
              type="button"
              className="ds-icon-btn ds-icon-btn--ghost"
              aria-label={t(`accounts.add.${provider}.copyCode`)}
              onClick={() => void copy(code)}
            >
              {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
            </button>
          </div>
        ) : null}
        <WaitingCard
          title={
            code ? t(`accounts.add.${provider}.waiting`) : t(`accounts.add.${provider}.preparing`)
          }
          detail={t(`accounts.add.${provider}.expires`)}
        />
        <div className="ds-stack-4">
          <span className="ds-label-strong">{t(`accounts.add.${provider}.otherTitle`)}</span>
          <span className="ds-t-sub">{t(`accounts.add.${provider}.otherText`)}</span>
        </div>
      </DsModalBody>
      <DsModalFooter
        start={
          <DsButton size="text" icon={<ArrowLeft className="size-4" />} onClick={onBack}>
            {t('accounts.add.back')}
          </DsButton>
        }
      >
        <DsButton
          size="sm"
          disabled={!link}
          icon={linkCopy.copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          onClick={() => link && void linkCopy.copy(link)}
        >
          {linkCopy.copied
            ? t(`accounts.add.${provider}.linkCopied`)
            : t(`accounts.add.${provider}.copyLink`)}
        </DsButton>
        <DsButton
          variant="primary"
          size="sm"
          disabled={!link}
          iconEnd={<ArrowUpRight className="size-4" />}
          onClick={() => link && onOpen(link)}
        >
          {t(`accounts.add.${provider}.openPage`)}
        </DsButton>
      </DsModalFooter>
    </>
  );
}
