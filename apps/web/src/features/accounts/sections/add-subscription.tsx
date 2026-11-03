import { DsButton } from '@flama/design-system-web';
import { Plus } from '@flama/design-system-web/icons';
import { useAccounts } from '@flama/frontend-consumer/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AddSubscriptionDialog } from '../dialogs/add-subscription';

/**
 * The "Add subscription" button and the modal it opens. It shows in a browser
 * too: the modal says the desktop app is where a tool signs in.
 *
 * Disabled until the account list has loaded: `FirstRun` swaps the page for
 * its empty state when the list comes back empty, which unmounts this button
 * and any dialog it had opened.
 */
export function AddSubscription({ place = 'header' }: { place?: 'header' | 'card' }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: accounts } = useAccounts();

  return (
    <>
      <DsButton
        // A page header's action is the primary button; inside an empty
        // state's card it is the larger, quieter one the design draws there.
        variant={place === 'header' ? 'primary' : 'secondary'}
        size={place === 'header' ? 'sm' : 'md'}
        icon={<Plus className="size-4" strokeWidth={1.5} />}
        disabled={accounts === undefined}
        onClick={() => setOpen(true)}
      >
        {t('accounts.list.add')}
      </DsButton>
      {open && <AddSubscriptionDialog onClose={() => setOpen(false)} />}
    </>
  );
}
