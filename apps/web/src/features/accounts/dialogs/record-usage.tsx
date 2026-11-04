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
import { ZAI_USAGE_URL } from '../lib/providers';

const FORM = 'record-usage';

const percent = (value: string) => (value === '' ? null : Number(value));

/** The desktop app opens links in the system browser; a browser tab opens a new one. */
function openUsagePage() {
  if (desktopBridge) void desktopBridge.openExternal(ZAI_USAGE_URL);
  else window.open(ZAI_USAGE_URL, '_blank', 'noopener,noreferrer');
}

/**
 * Records a usage reading on a subscription tracked by hand, copied from the
 * vendor's own usage page (ResetOwl cannot read Z.AI's); owns the save.
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
        description={t('accounts.record.description')}
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
        <p className="ds-t-sub m-0">{t('accounts.record.hint')}</p>
      </DsModalBody>
      <DsModalFooter
        start={
          <DsButton
            size="text"
            iconEnd={<ArrowUpRight className="size-4" />}
            onClick={openUsagePage}
          >
            {t('accounts.record.openUsage')}
          </DsButton>
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
