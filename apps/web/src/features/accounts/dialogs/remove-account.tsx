import type { AccountEntity } from '@flama/frontend-consumer';
import { useArchiveAccount } from '@flama/frontend-consumer/react';
import { ConfirmDialog, desktopBridge } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * Asks before ResetOwl stops tracking an account, and owns the removal. In the
 * desktop app it also forgets any usage reader key kept for the account.
 */
export function RemoveAccountDialog({
  account,
  onClose,
}: {
  account: AccountEntity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const archive = useArchiveAccount({
    onSuccess: () => {
      if (account.hasUnofficialReader) void desktopBridge?.usageReaders.disconnect(account.id);
      onClose();
    },
  });

  return (
    <ConfirmDialog
      title={t('accounts.remove.title', { name: account.displayName })}
      description={t('accounts.remove.description')}
      confirmLabel={t('accounts.remove.confirm')}
      pending={archive.isPending}
      error={archive.error}
      onClose={onClose}
      onConfirm={() => archive.mutate(account.id)}
    />
  );
}
