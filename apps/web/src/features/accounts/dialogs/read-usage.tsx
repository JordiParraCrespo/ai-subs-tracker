import {
  Alert,
  AlertDescription,
  AlertTitle,
  DsButton,
  DsModal,
  DsModalBody,
  DsModalFooter,
  DsModalHeader,
  toast,
} from '@flama/design-system-web';
import { ArrowUpRight } from '@flama/design-system-web/icons';
import type { AccountEntity } from '@flama/frontend-consumer';
import { desktopBridge, useLocale } from '@flama/frontend-web';
import { useNow } from '@flama/react-hooks';
import type { ManualProviderId } from '@flama/shared/subscriptions';
import { unofficialUsageReader } from '@flama/shared/subscriptions';
import { useTranslation } from 'react-i18next';
import { UsageReaderKeyForm } from '../forms/usage-reader-key-form';
import { useUsageReader } from '../hooks/use-usage-reader';
import { formatResetIn } from '../lib/format';
import { PROVIDER_NAMES } from '../lib/providers';

const FORM = 'usage-reader-key';

/**
 * Turns the desktop app's unofficial usage reader on or off for a
 * hand-tracked GLM Coding Plan, and says plainly what that means: the
 * endpoint is not documented, the key stays on this computer and goes only to
 * the vendor, and recording by hand is what is left when it stops working.
 * In a browser there is no reader, only where to find it.
 */
export function ReadUsageDialog({
  account,
  provider,
  onClose,
}: {
  account: AccountEntity;
  provider: ManualProviderId;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(60_000);
  const name = PROVIDER_NAMES[provider];
  const site = unofficialUsageReader(provider);
  const reader = useUsageReader(account.id, provider);
  const state = reader.state;

  const turnOn = (apiKey: string) =>
    reader.connect.mutate(apiKey, {
      onSuccess: () => {
        toast.success(t('toasts.usageReaderOn', { name }));
        onClose();
      },
    });
  const turnOff = () =>
    reader.disconnect.mutate(undefined, {
      onSuccess: () => {
        toast.success(t('toasts.usageReaderOff'));
        onClose();
      },
    });

  return (
    <DsModal open onOpenChange={(open) => !open && onClose()}>
      <DsModalHeader
        title={t('accounts.reader.title', { name })}
        description={t('accounts.reader.description', { name })}
        closeLabel={t('common.close')}
      />
      <DsModalBody>
        <Alert variant="paused">
          <AlertTitle>{t('accounts.reader.unofficialTitle')}</AlertTitle>
          <AlertDescription>{t('accounts.reader.unofficialText', { name })}</AlertDescription>
        </Alert>
        {!reader.available && <p className="ds-t-sub m-0">{t('accounts.reader.desktopOnly')}</p>}
        {state?.status === 'ok' && (
          <p className="ds-t-sub m-0">
            {t('accounts.reader.on', {
              ago: formatResetIn(state.lastReadAt, now, locale) ?? t('accounts.reader.notYet'),
            })}
          </p>
        )}
        {state && state.status !== 'ok' && state.status !== null && (
          <Alert variant="destructive">
            <AlertDescription>
              {state.message ?? t('accounts.reader.failed', { name })}
            </AlertDescription>
          </Alert>
        )}
        {reader.connect.error && (
          <Alert variant="destructive">
            <AlertDescription>{reader.connect.error.message}</AlertDescription>
          </Alert>
        )}
        {reader.available && (
          <UsageReaderKeyForm
            id={FORM}
            name={name}
            isPending={reader.connect.isPending}
            onSubmit={(values) => turnOn(values.apiKey)}
          />
        )}
        {reader.available && (
          <p className="ds-t-sub m-0">{t('accounts.reader.keyStays', { name })}</p>
        )}
      </DsModalBody>
      <DsModalFooter
        start={
          state ? (
            <DsButton size="text" onClick={turnOff} disabled={reader.disconnect.isPending}>
              {t('accounts.reader.turnOff')}
            </DsButton>
          ) : (
            site &&
            reader.available && (
              <DsButton
                size="text"
                iconEnd={<ArrowUpRight className="size-4" />}
                onClick={() => void desktopBridge?.openExternal(site.keysUrl)}
              >
                {t('accounts.reader.getKey', { name })}
              </DsButton>
            )
          )
        }
      >
        <DsButton variant="ghost" size="sm" onClick={onClose}>
          {t('common.cancel')}
        </DsButton>
        {reader.available && (
          <DsButton
            variant="primary"
            size="sm"
            type="submit"
            form={FORM}
            disabled={reader.connect.isPending}
          >
            {state ? t('accounts.reader.replace') : t('accounts.reader.turnOn')}
          </DsButton>
        )}
      </DsModalFooter>
    </DsModal>
  );
}
