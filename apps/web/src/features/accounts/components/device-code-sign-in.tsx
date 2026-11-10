import { DsButton, DsModalBody, DsModalFooter, DsModalHeader } from '@flama/design-system-web';
import { ArrowLeft, ArrowUpRight, Check, Copy } from '@flama/design-system-web/icons';
import { useCopy } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { WaitingCard } from './waiting-card';

/**
 * The Codex or Grok Build sign-in step. By default the CLI signs in through
 * the browser on this computer (its callback is on localhost): the page it
 * printed, and a wait for the sign-in to land. For another device, the
 * device-code flow: the code the CLI printed, to enter on the vendor's device
 * page. Either page's link can be copied into a private window, so the
 * account the browser is signed in to now is not the one added again.
 */
export function DeviceCodeSignIn({
  provider,
  deviceCode,
  code,
  link,
  onBack,
  onOpen,
  onSwitch,
}: {
  provider: 'codex' | 'grok';
  /** The device-code flow, for another device; the browser one otherwise. */
  deviceCode: boolean;
  code: string | null;
  link: string | null;
  onBack: () => void;
  onOpen: (link: string) => void;
  /** Restarts the sign-in the other way. */
  onSwitch: () => void;
}) {
  const { t } = useTranslation();
  const text = deviceCode
    ? {
        title: t(`accounts.add.${provider}.title`),
        description: t(`accounts.add.${provider}.description`),
        waiting: t(`accounts.add.${provider}.waiting`),
        expires: t(`accounts.add.${provider}.expires`),
      }
    : {
        title: t(`accounts.add.${provider}.browser.title`),
        description: t(`accounts.add.${provider}.browser.description`),
        waiting: t(`accounts.add.${provider}.browser.waiting`),
        expires: t(`accounts.add.${provider}.browser.expires`),
      };
  const { copied, copy } = useCopy();
  const linkCopy = useCopy();

  return (
    <>
      <DsModalHeader
        closeLabel={t('common.close')}
        title={text.title}
        description={text.description}
      />
      <DsModalBody className="ds-modal__body--flow">
        {deviceCode && code ? (
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
          title={deviceCode && !code ? t(`accounts.add.${provider}.preparing`) : text.waiting}
          detail={text.expires}
        />
        <div className="ds-stack-4">
          <span className="ds-label-strong">{t(`accounts.add.${provider}.otherTitle`)}</span>
          <span className="ds-t-sub">{t(`accounts.add.${provider}.otherText`)}</span>
        </div>
        <div className="ds-stack-4">
          <span className="ds-t-sub">
            {deviceCode ? t('accounts.add.thisComputerText') : t('accounts.add.otherDeviceText')}
          </span>
          <DsButton size="text" onClick={onSwitch} data-testid="sign-in-switch">
            {deviceCode ? t('accounts.add.useBrowser') : t('accounts.add.useCode')}
          </DsButton>
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
