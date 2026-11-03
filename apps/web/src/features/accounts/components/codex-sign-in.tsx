import { DsButton, DsModalBody, DsModalFooter, DsModalHeader } from '@flama/design-system-web';
import { ArrowLeft, ArrowUpRight, Check, Copy } from '@flama/design-system-web/icons';
import { useCopy } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { WaitingCard } from './waiting-card';

/**
 * Codex's sign-in step: the one-time code the CLI printed, to enter on
 * OpenAI's device page, and a wait for the approval to land.
 */
export function CodexSignIn({
  code,
  link,
  onBack,
  onOpen,
}: {
  code: string | null;
  link: string | null;
  onBack: () => void;
  onOpen: (link: string) => void;
}) {
  const { t } = useTranslation();
  const { copied, copy } = useCopy();

  return (
    <>
      <DsModalHeader
        title={t('accounts.add.codex.title')}
        description={t('accounts.add.codex.description')}
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
              aria-label={t('accounts.add.codex.copyCode')}
              onClick={() => void copy(code)}
            >
              {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
            </button>
          </div>
        ) : null}
        <WaitingCard
          title={code ? t('accounts.add.codex.waiting') : t('accounts.add.codex.preparing')}
          detail={t('accounts.add.codex.expires')}
        />
      </DsModalBody>
      <DsModalFooter
        start={
          <DsButton size="text" icon={<ArrowLeft className="size-4" />} onClick={onBack}>
            {t('accounts.add.back')}
          </DsButton>
        }
      >
        <DsButton
          variant="primary"
          size="sm"
          disabled={!link}
          iconEnd={<ArrowUpRight className="size-4" />}
          onClick={() => link && onOpen(link)}
        >
          {t('accounts.add.codex.openPage')}
        </DsButton>
      </DsModalFooter>
    </>
  );
}
