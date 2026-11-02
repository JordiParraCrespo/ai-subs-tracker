import { DsButton, DsFilterSelect, DsInput } from '@flama/design-system-web';
import { ArrowDownWideNarrow, CircleDot, Layers, Search, X } from '@flama/design-system-web/icons';
import { useDebouncedCallback } from '@flama/react-hooks';
import { PROVIDER_IDS, type ProviderId } from '@flama/shared/subscriptions';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PROVIDER_NAMES } from '../lib/providers';
import {
  SORTS,
  STATUS_FILTERS,
  type StatusFilter,
  type SubscriptionSort,
  type SubscriptionsQuery,
} from '../lib/subscriptions';

const ICON = { className: 'size-4', strokeWidth: 1.5 } as const;

/**
 * The design's toolbar: search, the status and provider filters, the sort on
 * the right, and the result line with "Clear filters" under it. The search
 * keeps the half-typed word and hands the URL the settled one.
 */
export function SubscriptionsToolbar({
  query,
  onQuery,
  shown,
  total,
}: {
  query: SubscriptionsQuery;
  onQuery: (next: SubscriptionsQuery) => void;
  shown: number;
  total: number;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(query.q ?? '');
  const settle = useDebouncedCallback(
    (q: string) => onQuery({ ...query, q: q || undefined, page: 1 }),
    250,
  );
  const filtered = Boolean(query.q || (query.status && query.status !== 'all') || query.provider);

  return (
    <div className="flex flex-col gap-3">
      <div className="ds-toolbar">
        <DsInput
          size="sm"
          className="w-55 max-w-full"
          icon={<Search {...ICON} />}
          placeholder={t('accounts.toolbar.search')}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            settle(event.target.value);
          }}
        />
        <DsFilterSelect<StatusFilter>
          icon={<CircleDot {...ICON} />}
          options={STATUS_FILTERS.map((value) => ({
            value,
            label: t(`accounts.toolbar.status.${value}`),
          }))}
          value={query.status ?? 'all'}
          onChange={(status) => onQuery({ ...query, status, page: 1 })}
        />
        <DsFilterSelect<ProviderId | 'all'>
          icon={<Layers {...ICON} />}
          options={[
            { value: 'all', label: t('accounts.toolbar.allProviders') },
            ...PROVIDER_IDS.map((value) => ({ value, label: PROVIDER_NAMES[value] })),
          ]}
          value={query.provider ?? 'all'}
          onChange={(provider) =>
            onQuery({ ...query, provider: provider === 'all' ? undefined : provider, page: 1 })
          }
        />
        <div className="flex-1" />
        <DsFilterSelect<SubscriptionSort>
          icon={<ArrowDownWideNarrow {...ICON} />}
          neutral
          align="right"
          options={SORTS.map((value) => ({ value, label: t(`accounts.toolbar.sort.${value}`) }))}
          value={query.sort ?? 'cost'}
          onChange={(sort) => onQuery({ ...query, sort })}
        />
      </div>
      <div className="ds-result">
        <span>{t('accounts.toolbar.result', { shown, total })}</span>
        {filtered && (
          <DsButton
            size="text"
            icon={<X {...ICON} />}
            onClick={() => {
              setDraft('');
              onQuery({ q: undefined, status: undefined, provider: undefined, page: undefined });
            }}
          >
            {t('accounts.toolbar.clear')}
          </DsButton>
        )}
      </div>
    </div>
  );
}
