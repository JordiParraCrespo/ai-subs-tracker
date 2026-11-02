import { PageHead } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { AccountsTable } from '../sections/accounts-table';
import { DesktopStatus } from '../sections/desktop-status';

/** Every tracked account, its windows and cost, and which one terminals use. */
export function AccountsScreen() {
  const { t } = useTranslation();

  return (
    <>
      <PageHead title={t('accounts.list.title')} sub={t('accounts.list.sub')} />
      <DesktopStatus />
      <AccountsTable />
    </>
  );
}
