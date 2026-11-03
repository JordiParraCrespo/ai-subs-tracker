import { useTranslation } from 'react-i18next';
import type { PeopleQuery } from '../lib/people';
import { FirstRun } from '../sections/first-run';
import { PeopleHead } from '../sections/people-head';
import { PeopleTable } from '../sections/people-table';

/** The design's People page: the identities holding the plans, and what each costs. */
export function PeopleScreen({
  query,
  onQuery,
}: {
  query: PeopleQuery;
  onQuery: (next: PeopleQuery) => void;
}) {
  const { t } = useTranslation();
  return (
    <FirstRun page="people" title={t('accounts.people.title')}>
      <div className="flex flex-col gap-6">
        <PeopleHead />
        <PeopleTable query={query} onQuery={onQuery} />
      </div>
    </FirstRun>
  );
}
