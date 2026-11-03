import type { AccountEntity } from '@flama/frontend-consumer';
import { PageHead } from '@flama/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EditAccountDialog } from '../dialogs/edit-account';
import { RenewalsCalendar } from '../sections/renewals-calendar';
import { RenewalsUpcoming } from '../sections/renewals-upcoming';

/**
 * The design's Renewals page: the month calendar beside the next 30 days.
 * Either side opens a plan's editor, where its renewal day is set, so the
 * screen holds the one dialog both share.
 */
export function RenewalsScreen({
  month,
  onMonth,
}: {
  month?: string;
  onMonth: (month: string | undefined) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<AccountEntity | null>(null);
  return (
    <div className="flex flex-col gap-6">
      <PageHead
        className="mb-0"
        title={t('accounts.renewals.title')}
        sub={t('accounts.renewals.sub')}
      />
      <div className="flex flex-wrap items-stretch gap-4">
        <RenewalsCalendar month={month} onMonth={onMonth} onOpen={setEditing} />
        <RenewalsUpcoming onOpen={setEditing} />
      </div>
      {editing && <EditAccountDialog account={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
