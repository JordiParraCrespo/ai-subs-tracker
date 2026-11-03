import { DsAvatar, DsButton, type DsGridColumn, DsGridTable } from '@flama/design-system-web';
import { ChevronDown, ChevronUp } from '@flama/design-system-web/icons';
import type { AccountEntity } from '@flama/frontend-consumer';
import { useAccounts } from '@flama/frontend-consumer/react';
import { useLocale } from '@flama/frontend-web';
import { useNow } from '@flama/react-hooks';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EditAccountDialog } from '../dialogs/edit-account';
import { formatMoney, formatPercent, formatResetIn } from '../lib/format';
import { accountMark, accountTitle } from '../lib/marks';
import {
  filterPeople,
  groupPeople,
  isIdle,
  type PeopleQuery,
  type Person,
  personInitials,
} from '../lib/people';
import { PeopleToolbar } from './people-toolbar';

const PAGE_SIZE = 8;
const TEMPLATE = 'minmax(220px,2fr) minmax(200px,1.6fr) 110px 130px 32px';

/**
 * The design's People table over the person's identities: who holds which
 * plans, how many sat idle this week, and what they cost. A row opens to its
 * plans, each with its week and an Edit for the plan's name, price and day.
 */
export function PeopleTable({
  query,
  onQuery,
}: {
  query: PeopleQuery;
  onQuery: (next: PeopleQuery) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(60_000);
  const { data: accounts = [], isLoading } = useAccounts();
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<AccountEntity | null>(null);
  const everyone = groupPeople(accounts);
  const rows = filterPeople(everyone, query);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(query.page ?? 1, pages);
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const detail = (account: AccountEntity) => {
    const weekly = account.window('weekly');
    if (!weekly) return t('accounts.people.noReading');
    const used = t('accounts.people.weekUsed', { used: formatPercent(weekly.utilization) });
    const reset = formatResetIn(weekly.resetsAt, now, locale);
    return reset ? `${used} · ${t('accounts.people.resets', { when: reset })}` : used;
  };

  const columns: DsGridColumn<Person>[] = [
    {
      key: 'person',
      label: t('accounts.people.person'),
      render: (person) => (
        <div className="flex min-w-0 items-center gap-3">
          <DsAvatar initials={personInitials(person.name)} color="#404040" size={32} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="ds-cell-strong">{person.name}</span>
            <span className="ds-cell-sub">
              {person.organization ??
                t('accounts.people.planCount', { count: person.accounts.length })}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'tools',
      label: t('accounts.people.tools'),
      render: (person) => (
        <div className="flex min-w-0 flex-row items-center gap-2">
          <div className="ds-stack">
            {person.accounts.map((account) => {
              const mark = accountMark(account);
              return (
                <span key={account.id} title={accountTitle(account)}>
                  <DsAvatar initials={mark.initials} color={mark.color} size={24} />
                </span>
              );
            })}
          </div>
          <span className="ds-cell-sub">
            {t('accounts.people.planCount', { count: person.accounts.length })}
          </span>
        </div>
      ),
    },
    {
      key: 'idle',
      label: t('accounts.people.idle'),
      render: (person) =>
        person.idle.length ? (
          <span className="ds-text-label ds-review">{person.idle.length}</span>
        ) : (
          <span className="ds-text-label ds-subtle">—</span>
        ),
    },
    {
      key: 'cost',
      label: t('accounts.people.cost'),
      align: 'right',
      render: (person) => (
        <span className="ds-cell-money">{formatMoney(person.monthlyCents, locale)}</span>
      ),
    },
    {
      key: 'open',
      label: '',
      render: (person) =>
        open === person.key ? (
          <ChevronUp className="ds-subtle size-4" strokeWidth={1.5} />
        ) : (
          <ChevronDown className="ds-subtle size-4" strokeWidth={1.5} />
        ),
    },
  ];

  return (
    <>
      <PeopleToolbar query={query} onQuery={onQuery} shown={rows.length} total={everyone.length} />
      <DsGridTable
        columns={columns}
        template={TEMPLATE}
        rows={shown}
        rowKey={(person) => person.key}
        minWidth={720}
        onRowClick={(person) => setOpen((current) => (current === person.key ? null : person.key))}
        expanded={(person) =>
          open === person.key
            ? person.accounts.map((account) => {
                const mark = accountMark(account);
                return (
                  <div key={account.id} className="ds-gtable__expand-row">
                    <DsAvatar initials={mark.initials} color={mark.color} size={32} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="ds-label-strong">{accountTitle(account)}</span>
                      <span className="ds-cell-sub">{detail(account)}</span>
                    </div>
                    {isIdle(account) && (
                      <span className="ds-text-label ds-review">
                        {t('accounts.people.idleTag')}
                      </span>
                    )}
                    <DsButton size="xs" onClick={() => setEditing(account)}>
                      {t('accounts.table.edit')}
                    </DsButton>
                    <span className="ds-cell-money w-24 text-right">
                      {formatMoney(account.monthlyPriceCents, locale)}
                    </span>
                  </div>
                );
              })
            : null
        }
        footer={
          rows.length
            ? t('accounts.table.range', {
                from: (page - 1) * PAGE_SIZE + 1,
                to: (page - 1) * PAGE_SIZE + shown.length,
                total: rows.length,
              })
            : t('accounts.usage.noResults')
        }
        page={page}
        pages={pages}
        onPage={(next) => onQuery({ ...query, page: next > 1 ? next : undefined })}
      />
      {!isLoading && rows.length === 0 && (
        <p className="ds-text-label ds-muted m-0 text-center">{t('accounts.people.noMatch')}</p>
      )}
      {editing && <EditAccountDialog account={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
