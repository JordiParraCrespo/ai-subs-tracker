import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from '@flama/design-system-web';
import type { AccountEntity } from '@flama/frontend-consumer';
import { useUpdateAccount } from '@flama/frontend-consumer/react';
import { useErrorMessage } from '@flama/frontend-web';
import type { EditAccountFormValues } from '@flama/shared/schemas/accounts';
import { useTranslation } from 'react-i18next';
import { EditAccountForm } from '../forms/edit-account-form';

const FORM = 'edit-account';

/** Renames an account and sets the plan, price and billing day it really has; owns the save. */
export function EditAccountDialog({
  account,
  onClose,
}: {
  account: AccountEntity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
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
        planId: values.planId === '' ? null : values.planId,
        monthlyPriceCents: values.price === '' ? null : Math.round(Number(values.price) * 100),
        renewalDay: values.renewalDay === '' ? null : Number(values.renewalDay),
      },
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('accounts.edit.title')}</DialogTitle>
          <DialogDescription>{t('accounts.edit.description')}</DialogDescription>
        </DialogHeader>
        {update.error && (
          <Alert variant="destructive">
            <AlertDescription>
              {resolveError(update.error, t('common.error')).message}
            </AlertDescription>
          </Alert>
        )}
        <EditAccountForm id={FORM} account={account} isPending={update.isPending} onSubmit={save} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={FORM} disabled={update.isPending}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
