import { DsButton, DsFilterSelect, DsInput } from '@flama/design-system-web';
import { ArrowDownWideNarrow, CircleDot, Layers, Search, X } from '@flama/design-system-web/icons';
import { useDebouncedCallback } from '@flama/react-hooks';
import { PROVIDER_IDS, type ProviderId } from '@flama/shared/subscriptions';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PEOPLE_SORTS,
  PEOPLE_STATUSES,
  type PeopleQuery,
  type PeopleSort,
  type PeopleStatus,
} from '../lib/people';
import { PROVIDER_NAMES } from '../lib/providers';

const ICON = { className: 'size-4', strokeWidth: 1.5 } as const;

/**
 * The design's people toolbar: search, the provider and idle filters, the
 * sort on the right, and the "Showing N of M" line under it. The search keeps
 * the half-typed word and hands the URL the settled one.
 */
export function PeopleToolbar({
  query,
  onQuery,
  shown,
  total,
}: {
  query: PeopleQuery;
  onQuery: (next: PeopleQuery) => void;
  shown: number;
  total: number;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(query.q ?? '');
  const settle = useDebouncedCallback(
    (q: string) => onQuery({ ...query, q: q || undefined, page: undefined }),
    250,
  );
  const filtered = Boolean(query.q || query.provider || (query.status && query.status !== 'all'));

  return (
    <div className="flex flex-col gap-3">
      <div className="ds-toolbar">
        <DsInput
          size="sm"
          className="w-55 max-w-full"
          icon={<Search {...ICON} />}
          placeholder={t('accounts.people.search')}
          aria-label={t('accounts.people.search')}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            settle(event.target.value);
          }}
        />
        <DsFilterSelect<ProviderId | 'all'>
          icon={<Layers {...ICON} />}
          options={[
            { value: 'all', label: t('accounts.toolbar.allProviders') },
            ...PROVIDER_IDS.map((value) => ({ value, label: PROVIDER_NAMES[value] })),
          ]}
          value={query.provider ?? 'all'}
          onChange={(provider) =>
            onQuery({
              ...query,
              provider: provider === 'all' ? undefined : provider,
              page: undefined,
            })
          }
        />
        <DsFilterSelect<PeopleStatus>
          icon={<CircleDot {...ICON} />}
          options={PEOPLE_STATUSES.map((value) => ({
            value,
            label: t(`accounts.people.status.${value}`),
          }))}
          value={query.status ?? 'all'}
          onChange={(status) => onQuery({ ...query, status, page: undefined })}
        />
        <div className="flex-1" />
        <DsFilterSelect<PeopleSort>
          icon={<ArrowDownWideNarrow {...ICON} />}
          neutral
          align="right"
          options={PEOPLE_SORTS.map((value) => ({
            value,
            label: t(`accounts.people.sort.${value}`),
          }))}
          value={query.sort ?? 'cost'}
          onChange={(sort) => onQuery({ ...query, sort })}
        />
      </div>
      <div className="ds-result">
        <span>{t('accounts.people.result', { shown, total })}</span>
        {filtered && (
          <DsButton
            size="text"
            icon={<X {...ICON} />}
            onClick={() => {
              setDraft('');
              onQuery({ sort: query.sort });
            }}
          >
            {t('accounts.people.clear')}
          </DsButton>
        )}
      </div>
    </div>
  );
}
