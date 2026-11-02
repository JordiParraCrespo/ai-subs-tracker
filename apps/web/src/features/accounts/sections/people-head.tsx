import { useAccounts } from '@flama/frontend-consumer/react';
import { PageHead, useLocale } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../lib/format';
import { groupPeople } from '../lib/people';

/** "3 people · $440/mo": how many identities hold the plans, and what they cost together. */
export function PeopleHead() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { data: accounts = [] } = useAccounts();
  const people = groupPeople(accounts);
  const total = people.reduce((sum, person) => sum + person.monthlyCents, 0);
  return (
    <PageHead
      className="mb-0"
      title={t('accounts.people.title')}
      sub={t('accounts.people.sub', { count: people.length, cost: formatMoney(total, locale) })}
    />
  );
}
