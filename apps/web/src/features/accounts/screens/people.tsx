import type { PeopleQuery } from '../lib/people';
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
  return (
    <div className="flex flex-col gap-6">
      <PeopleHead />
      <PeopleTable query={query} onQuery={onQuery} />
    </div>
  );
}
