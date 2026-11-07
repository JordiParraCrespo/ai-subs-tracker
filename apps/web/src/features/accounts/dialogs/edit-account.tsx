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
import type { AccountEntity } from '@flama/frontend-consumer';
import { useAccounts, useUpdateAccount } from '@flama/frontend-consumer/react';
import { useErrorMessage } from '@flama/frontend-web';
import type { EditAccountFormValues } from '@flama/shared/schemas/accounts';
import { useTranslation } from 'react-i18next';
import { EditAccountForm } from '../forms/edit-account-form';
import { namedPeople } from '../lib/people';

const FORM = 'edit-account';

/** Renames an account, says who uses it, and sets the plan, price and billing day it really has; owns the save. */
export function EditAccountDialog({
  account,
  onClose,
}: {
  account: AccountEntity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const { data: accounts = [] } = useAccounts();
  const update = useUpdateAccount({
    onSuccess: () => {
      toast.success(t('toasts.accountSaved'));
      onClose();
    },
  });

  function save(values: EditAccountFormValues) {
    update.mutate({
      id: account.id,
      input: {
        label: values.label === '' ? null : values.label,
        person: values.person === '' ? null : values.person,
        planId: values.planId === '' ? null : values.planId,
        monthlyPriceCents: values.price === '' ? null : Math.round(Number(values.price) * 100),
        renewalDay: values.renewalDay === '' ? null : Number(values.renewalDay),
      },
    });
  }

  return (
    <DsModal open onOpenChange={(open) => !open && onClose()}>
      <DsModalHeader
        title={t('accounts.edit.title')}
        description={t('accounts.edit.description')}
        closeLabel={t('common.close')}
      />
      <DsModalBody>
        {update.error && (
          <Alert variant="destructive">
            <AlertDescription>
              {resolveError(update.error, t('common.error')).message}
            </AlertDescription>
          </Alert>
        )}
        <EditAccountForm
          id={FORM}
          account={account}
          people={namedPeople(accounts)}
          isPending={update.isPending}
          onSubmit={save}
        />
      </DsModalBody>
      <DsModalFooter>
        <DsButton variant="ghost" size="sm" onClick={onClose}>
          {t('common.cancel')}
        </DsButton>
        <DsButton variant="primary" size="sm" type="submit" form={FORM} disabled={update.isPending}>
          {t('common.save')}
        </DsButton>
      </DsModalFooter>
    </DsModal>
  );
}
