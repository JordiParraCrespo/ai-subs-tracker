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
import { Plus } from '@flama/design-system-web/icons';
import { useAccounts, useUpdateAccount } from '@flama/frontend-consumer/react';
import { dateFormatter, useErrorMessage, useLocale } from '@flama/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { accountTitle } from '../lib/marks';
import { unscheduled } from '../lib/renewals';
import { AddSubscriptionDialog } from './add-subscription';

/**
 * A calendar day, clicked: put a paid plan that has no renewal day yet on it,
 * or add a new subscription that bills on it. With no plan waiting for a day,
 * it is the Add subscription modal straight away.
 */
export function RenewalDayDialog({ date, onClose }: { date: Date; onClose: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const resolveError = useErrorMessage();
  const { data, isError } = useAccounts();
  const accounts = data ?? [];
  // Decided once, when the list is first there: a sync that brings in a plan
  // with no day must not swap a sign-in or a half-filled form for the picker.
  // Not before it loads, or a day clicked as the page opens finds no plan
  // waiting and is Add subscription for good. A list that failed to load has
  // no plan to offer, so the day is Add subscription rather than nothing.
  const [adding, setAdding] = useState<boolean | null>(() =>
    data ? unscheduled(data).length === 0 : null,
  );
  if (adding === null && (data || isError)) {
    setAdding(data ? unscheduled(data).length === 0 : true);
  }
  const update = useUpdateAccount({
    onSuccess: () => {
      toast.success(t('toasts.accountSaved'));
      onClose();
    },
  });
  const day = date.getDate();
  const missing = unscheduled(accounts);

  if (adding === null) return null;
  if (adding) {
    return <AddSubscriptionDialog renewalDay={day} onClose={onClose} />;
  }

  const title = dateFormatter(locale, { day: 'numeric', month: 'long' }).format(date);

  return (
    <DsModal open onOpenChange={(open) => !open && onClose()}>
      <DsModalHeader
        closeLabel={t('common.close')}
        title={t('accounts.renewals.day.title', { date: title })}
        description={t('accounts.renewals.day.description')}
      />
      <DsModalBody className="ds-modal__body--list">
        {update.error && (
          <Alert variant="destructive">
            <AlertDescription>
              {resolveError(update.error, t('common.error')).message}
            </AlertDescription>
          </Alert>
        )}
        <span className="ds-label-strong">{t('accounts.renewals.missingTitle')}</span>
        {missing.map((account) => (
          <div key={account.id} className="flex items-center gap-3 py-1">
            <span className="ds-row__txt">
              <span className="ds-cell-strong">{accountTitle(account)}</span>
              <span className="ds-cell-sub">{account.displayName}</span>
            </span>
            <DsButton
              size="xs"
              disabled={update.isPending}
              onClick={() => update.mutate({ id: account.id, input: { renewalDay: day } })}
            >
              {t('accounts.renewals.day.put')}
            </DsButton>
          </div>
        ))}
      </DsModalBody>
      <DsModalFooter>
        <DsButton
          variant="primary"
          size="sm"
          icon={<Plus className="size-4" strokeWidth={1.5} />}
          disabled={update.isPending}
          onClick={() => setAdding(true)}
        >
          {t('accounts.renewals.day.add')}
        </DsButton>
      </DsModalFooter>
    </DsModal>
  );
}
