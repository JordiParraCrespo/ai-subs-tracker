import { DsButton, DsFilterSelect, DsInput, DsSegmented } from '@flama/design-system-web';
import { Building2, CalendarDays, Folder, Search, X } from '@flama/design-system-web/icons';
import { useAccounts } from '@flama/frontend-consumer/react';
import { useDebouncedCallback } from '@flama/react-hooks';
import { PROVIDER_IDS, type ProviderId } from '@flama/shared/subscriptions';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { accountTitle } from '../lib/marks';
import { USAGE_PERIODS, type UsagePeriod } from '../lib/periods';
import { PROVIDER_NAMES } from '../lib/providers';
import { USAGE_METRICS, type UsageMetric, type UsageQuery } from '../lib/usage-view';

const ICON = { className: 'size-4', strokeWidth: 1.5 } as const;

/**
 * The design's usage toolbar: provider and account filters, the period, a
 * search over models and accounts, Clear, and Spend / Tokens on the right.
 * The search keeps the half-typed word and hands the URL the settled one.
 */
export function UsageToolbar({
  query,
  onQuery,
}: {
  query: UsageQuery;
  onQuery: (next: UsageQuery) => void;
}) {
  const { t } = useTranslation();
  const { data: accounts = [] } = useAccounts();
  const [draft, setDraft] = useState(query.q ?? '');
  const settle = useDebouncedCallback(
    (q: string) => onQuery({ ...query, q: q || undefined, page: undefined }),
    250,
  );
  const filtered = Boolean(query.provider || query.account || query.q);
  const shownAccounts = accounts.filter((a) => !query.provider || a.provider === query.provider);

  return (
    <div className="ds-toolbar">
      <DsFilterSelect<ProviderId | 'all'>
        icon={<Building2 {...ICON} />}
        options={[
          { value: 'all', label: t('accounts.toolbar.allProviders') },
          ...PROVIDER_IDS.map((value) => ({ value, label: PROVIDER_NAMES[value] })),
        ]}
        value={query.provider ?? 'all'}
        onChange={(provider) =>
          onQuery({
            ...query,
            provider: provider === 'all' ? undefined : provider,
            account: undefined,
            page: undefined,
          })
        }
      />
      <DsFilterSelect<string>
        icon={<Folder {...ICON} />}
        options={[
          { value: '', label: t('accounts.usage.allAccounts') },
          ...shownAccounts.map((account) => ({
            value: account.id,
            label: `${accountTitle(account)} · ${account.displayName}`,
          })),
        ]}
        value={query.account ?? ''}
        onChange={(account) =>
          onQuery({ ...query, account: account || undefined, page: undefined })
        }
      />
      <DsFilterSelect<string>
        icon={<CalendarDays {...ICON} />}
        neutral
        options={USAGE_PERIODS.map((days) => ({
          value: String(days),
          label: t('accounts.usage.period', { days }),
        }))}
        value={String(query.days ?? 30)}
        onChange={(days) =>
          onQuery({ ...query, days: Number(days) as UsagePeriod, page: undefined })
        }
      />
      <DsInput
        size="sm"
        className="w-50 max-w-full"
        icon={<Search {...ICON} />}
        placeholder={t('accounts.usage.search')}
        aria-label={t('accounts.usage.search')}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          settle(event.target.value);
        }}
      />
      {filtered && (
        <DsButton
          size="text"
          icon={<X {...ICON} />}
          onClick={() => {
            setDraft('');
            onQuery({ days: query.days, metric: query.metric, group: query.group });
          }}
        >
          {t('accounts.usage.clear')}
        </DsButton>
      )}
      <div className="flex-1" />
      <DsSegmented<UsageMetric>
        options={USAGE_METRICS.map((value) => ({
          value,
          label: t(`accounts.usage.metric.${value}`),
        }))}
        value={query.metric ?? 'spend'}
        onChange={(metric) => onQuery({ ...query, metric })}
      />
    </div>
  );
}
