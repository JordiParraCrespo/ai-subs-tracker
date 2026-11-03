import {
  Alert,
  AlertDescription,
  DsButton,
  DsModal,
  DsModalBody,
  DsModalFooter,
  DsModalHeader,
} from '@flama/design-system-web';
import { useErrorMessage } from '@flama/frontend-core/react';
import { useTranslation } from 'react-i18next';

/**
 * The workspace's "are you sure?", drawn as the design's confirm modal: the
 * question, what it means, Cancel and the deed, for an action that cannot be
 * undone.
 *
 * At the top of `components/` rather than inside `team/`, where it was written:
 * the inbox's bulk delete is the second feature to need it, and layout
 * vocabulary shared by two features does not live inside one of them.
 *
 * The failure stays *in* the dialog as an `Alert` rather than becoming a toast,
 * because the reader has to act on it and the dialog is where they still are.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  /** Names the deed — "Delete" — where the generic "Confirm" would not. */
  confirmLabel?: string;
  pending: boolean;
  error: Error | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  return (
    <DsModal open onOpenChange={(open) => !open && onClose()}>
      <DsModalHeader title={title} description={description} closeLabel={t('common.close')} />
      {error ? (
        <DsModalBody>
          <Alert variant="destructive">
            <AlertDescription>{resolveError(error, t('common.error')).message}</AlertDescription>
          </Alert>
        </DsModalBody>
      ) : (
        <div className="h-2" />
      )}
      <DsModalFooter>
        <DsButton variant="ghost" size="sm" onClick={onClose}>
          {t('common.cancel')}
        </DsButton>
        <DsButton variant="primary" size="sm" disabled={pending} onClick={onConfirm}>
          {confirmLabel ?? t('common.confirm')}
        </DsButton>
      </DsModalFooter>
    </DsModal>
  );
}
