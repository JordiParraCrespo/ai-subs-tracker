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
import { ArrowUpRight } from '@flama/design-system-web/icons';
import type { AccountEntity } from '@flama/frontend-consumer';
import { useRecordAccountUsage } from '@flama/frontend-consumer/react';
import { desktopBridge, useErrorMessage } from '@flama/frontend-web';
import type { RecordUsageFormValues } from '@flama/shared/schemas/accounts';
import { useTranslation } from 'react-i18next';
import { RecordUsageForm } from '../forms/record-usage-form';
import { PROVIDER_NAMES, usagePageUrl } from '../lib/providers';

const FORM = 'record-usage';

const percent = (value: string) => (value === '' ? null : Number(value));

/** The desktop app opens links in the system browser; a browser tab opens a new one. */
function openPage(url: string) {
  if (desktopBridge) void desktopBridge.openExternal(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Records a usage reading on a subscription tracked by hand, copied from the
 * vendor's own usage page; owns the save. The fallback when the desktop
 * app's unofficial reader is off or failing.
 */
export function RecordUsageDialog({
  account,
  onClose,
}: {
  account: AccountEntity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const name = PROVIDER_NAMES[account.provider];
  const usageUrl = usagePageUrl(account.provider);
  const record = useRecordAccountUsage({
    onSuccess: () => {
      toast.success(t('toasts.usageRecorded'));
      onClose();
    },
  });

  function save(values: RecordUsageFormValues) {
    record.mutate({
      id: account.id,
      input: {
        sessionUtilization: percent(values.session),
        weeklyUtilization: percent(values.weekly),
        // The input is local time; the API takes an instant.
        weeklyResetsAt:
          values.weeklyResetsAt === '' ? null : new Date(values.weeklyResetsAt).toISOString(),
      },
    });
  }

  return (
    <DsModal open onOpenChange={(open) => !open && onClose()}>
      <DsModalHeader
        title={t('accounts.record.title')}
        description={t('accounts.record.description', { name })}
        closeLabel={t('common.close')}
      />
      <DsModalBody>
        {record.error && (
          <Alert variant="destructive">
            <AlertDescription>
              {resolveError(record.error, t('common.error')).message}
            </AlertDescription>
          </Alert>
        )}
        <RecordUsageForm id={FORM} account={account} isPending={record.isPending} onSubmit={save} />
        <p className="ds-t-sub m-0">{t('accounts.record.hint', { name })}</p>
      </DsModalBody>
      <DsModalFooter
        start={
          usageUrl && (
            <DsButton
              size="text"
              iconEnd={<ArrowUpRight className="size-4" />}
              onClick={() => openPage(usageUrl)}
            >
              {t('accounts.record.openUsage', { name })}
            </DsButton>
          )
        }
      >
        <DsButton variant="ghost" size="sm" onClick={onClose}>
          {t('common.cancel')}
        </DsButton>
        <DsButton variant="primary" size="sm" type="submit" form={FORM} disabled={record.isPending}>
          {t('accounts.record.submit')}
        </DsButton>
      </DsModalFooter>
    </DsModal>
  );
}
