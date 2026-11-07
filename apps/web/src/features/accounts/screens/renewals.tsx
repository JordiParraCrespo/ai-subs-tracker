import type { AccountEntity } from '@flama/frontend-consumer';
import { PageHead } from '@flama/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EditAccountDialog } from '../dialogs/edit-account';
import { RenewalDayDialog } from '../dialogs/renewal-day';
import { FirstRun } from '../sections/first-run';
import { RenewalsCalendar } from '../sections/renewals-calendar';
import { RenewalsUpcoming } from '../sections/renewals-upcoming';

/**
 * The design's Renewals page: the month calendar beside the next 30 days.
 * Either side opens a plan's editor, where its renewal day is set, so the
 * screen holds the one dialog both share; a day clicked on the calendar opens
 * the dialog that puts a plan on it or adds one.
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
  const [day, setDay] = useState<Date | null>(null);
  return (
    <FirstRun page="renewals" title={t('accounts.renewals.title')}>
      <div className="flex flex-col gap-6">
        <PageHead
          className="mb-0"
          title={t('accounts.renewals.title')}
          sub={t('accounts.renewals.sub')}
        />
        <div className="flex flex-wrap items-stretch gap-4">
          <RenewalsCalendar month={month} onMonth={onMonth} onOpen={setEditing} onDay={setDay} />
          <RenewalsUpcoming onOpen={setEditing} />
        </div>
        {editing && <EditAccountDialog account={editing} onClose={() => setEditing(null)} />}
        {day && <RenewalDayDialog date={day} onClose={() => setDay(null)} />}
      </div>
    </FirstRun>
  );
}
