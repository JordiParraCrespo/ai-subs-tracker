import { useAccounts } from '@flama/frontend-consumer/react';
import { PageHead, useLocale } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { useOwnerName } from '../hooks/use-owner-name';
import { formatMoney } from '../lib/format';
import { groupPeople } from '../lib/people';

/** "2 people · 3 accounts · $500/mo": who holds the plans, on how many logins, and what they cost. */
export function PeopleHead() {
  const { t } = useTranslation();
  const locale = useLocale();
  const owner = useOwnerName();
  const { data: accounts = [] } = useAccounts();
  const people = groupPeople(accounts, owner);
  const identities = people.reduce((sum, person) => sum + person.identities.length, 0);
  const total = people.reduce((sum, person) => sum + person.monthlyCents, 0);
  return (
    <PageHead
      className="mb-0"
      title={t('accounts.people.title')}
      sub={[
        t('accounts.people.peopleCount', { count: people.length }),
        t('accounts.people.accountCount', { count: identities }),
        t('accounts.people.perMonth', { cost: formatMoney(total, locale) }),
      ].join(' · ')}
    />
  );
}
