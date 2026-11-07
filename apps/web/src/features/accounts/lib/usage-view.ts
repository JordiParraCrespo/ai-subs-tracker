import type { AccountEntity, UsageSummary } from '@flama/frontend-consumer';
import type { ProviderId } from '@flama/shared/subscriptions';
import { accountTitle } from './marks';
import { PROVIDER_NAMES } from './providers';

/**
 * The usage screen's arithmetic, kept apart from the markup: which rows the
 * filters keep, the key figures, the day-by-day series, what each plan
 * returned at API prices, and the grouped table.
 */

export type UsageRow = UsageSummary['rows'][number];
export type UsageGroup = 'model' | 'account' | 'provider';
export type UsageMetric = 'spend' | 'tokens';

export interface UsageFilters {
  provider: ProviderId | 'all';
  accountId: string;
  q: string;
}

const DAY_MS = 86_400_000;
/** A month as the plans bill it, for pro-rating a monthly price over the period. */
const MONTH_DAYS = 30.44;

export const tokensOf = (row: Pick<UsageRow, 'input' | 'output' | 'cacheWrite' | 'cacheRead'>) =>
  row.input + row.output + row.cacheWrite + row.cacheRead;

export function modelLabels(summary: UsageSummary): Map<string, string> {
  return new Map(summary.byModel.map((m) => [m.model, m.label ?? m.model]));
}

export function filterUsage(
  rows: readonly UsageRow[],
  accounts: ReadonlyMap<string, AccountEntity>,
  labels: ReadonlyMap<string, string>,
  filters: UsageFilters,
): UsageRow[] {
  const q = filters.q.trim().toLowerCase();
  return rows.filter((row) => {
    const account = accounts.get(row.accountId);
    if (!account) return false;
    if (filters.provider !== 'all' && account.provider !== filters.provider) return false;
    if (filters.accountId && row.accountId !== filters.accountId) return false;
    if (!q) return true;
    return matches(q, [row.model, labels.get(row.model), ...accountWords(account)]);
  });
}

const accountWords = (account: AccountEntity) => [
  accountTitle(account),
  account.displayName,
  PROVIDER_NAMES[account.provider],
];

const matches = (q: string, words: readonly (string | null | undefined)[]) =>
  words.join(' ').toLowerCase().includes(q);

/**
 * The accounts the "Group by account" table lists, whether or not they used
 * anything: the ones the filters keep, and with a search, the ones it names.
 */
export function listedAccounts(
  accounts: readonly AccountEntity[],
  filters: UsageFilters,
): AccountEntity[] {
  const q = filters.q.trim().toLowerCase();
  return filterAccounts(accounts, filters).filter(
    (account) => !q || matches(q, accountWords(account)),
  );
}

/** The accounts the filters keep, whether or not they used anything. */
export function filterAccounts(
  accounts: readonly AccountEntity[],
  filters: Pick<UsageFilters, 'provider' | 'accountId'>,
): AccountEntity[] {
  return accounts.filter(
    (account) =>
      (filters.provider === 'all' || account.provider === filters.provider) &&
      (!filters.accountId || account.id === filters.accountId),
  );
}

export const paidCents = (accounts: readonly AccountEntity[], days: number) =>
  accounts.reduce((sum, account) => sum + (account.monthlyPriceCents * days) / MONTH_DAYS, 0);

/** One value per day from `since` to today, zero where nothing was used. */
export function dailySeries(
  rows: readonly UsageRow[],
  since: string,
  days: number,
  metric: UsageMetric,
): { day: string; value: number }[] {
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const value = metric === 'spend' ? row.apiCostCents : tokensOf(row);
    byDay.set(row.day, (byDay.get(row.day) ?? 0) + value);
  }
  const start = Date.parse(`${since}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(start + i * DAY_MS).toISOString().slice(0, 10);
    return { day, value: byDay.get(day) ?? 0 };
  });
}

/** The running total of the daily values: what the period has added up to so far. */
export function cumulative(values: readonly number[]): number[] {
  let sum = 0;
  return values.map((value) => {
    sum += value;
    return sum;
  });
}

export interface ValueRow {
  account: AccountEntity;
  paid: number;
  api: number;
  ratio: number | null;
}

/** Per account, what its plan cost for the period against the same usage at API prices. */
export function valueRows(
  accounts: readonly AccountEntity[],
  rows: readonly UsageRow[],
  days: number,
): ValueRow[] {
  const api = new Map<string, number>();
  for (const row of rows) api.set(row.accountId, (api.get(row.accountId) ?? 0) + row.apiCostCents);
  return accounts
    .map((account) => {
      const paid = (account.monthlyPriceCents * days) / MONTH_DAYS;
      const value = api.get(account.id) ?? 0;
      return { account, paid, api: value, ratio: paid > 0 ? value / paid : null };
    })
    .sort((a, b) => b.api - a.api);
}

export interface GroupRow {
  key: string;
  name: string;
  /** How many of the other dimension the group spans: projects for a model, models otherwise. */
  provider: ProviderId | null;
  spans: number;
  input: number;
  output: number;
  messages: number;
  cost: number;
}

export function groupUsage(
  rows: readonly UsageRow[],
  accounts: ReadonlyMap<string, AccountEntity>,
  labels: ReadonlyMap<string, string>,
  group: UsageGroup,
  /** Grouping by account: accounts listed at zero when they used nothing. */
  listed: readonly AccountEntity[] = [],
): GroupRow[] {
  const groups = new Map<string, GroupRow & { set: Set<string> }>();
  if (group === 'account') {
    for (const account of listed) {
      groups.set(account.id, {
        key: account.id,
        name: accountTitle(account),
        provider: null,
        spans: 0,
        input: 0,
        output: 0,
        messages: 0,
        cost: 0,
        set: new Set<string>(),
      });
    }
  }
  for (const row of rows) {
    const account = accounts.get(row.accountId);
    if (!account) continue;
    const key =
      group === 'model' ? row.model : group === 'account' ? row.accountId : account.provider;
    const name =
      group === 'model'
        ? (labels.get(row.model) ?? row.model)
        : group === 'account'
          ? accountTitle(account)
          : PROVIDER_NAMES[account.provider];
    const bucket = groups.get(key) ?? {
      key,
      name,
      provider: group === 'account' ? null : account.provider,
      spans: 0,
      input: 0,
      output: 0,
      messages: 0,
      cost: 0,
      set: new Set<string>(),
    };
    bucket.input += row.input + row.cacheWrite + row.cacheRead;
    bucket.output += row.output;
    bucket.messages += row.messages;
    bucket.cost += row.apiCostCents;
    bucket.set.add(group === 'model' ? row.accountId : row.model);
    groups.set(key, bucket);
  }
  return [...groups.values()]
    .map(({ set, ...rest }) => ({ ...rest, spans: set.size }))
    .sort((a, b) => b.cost - a.cost || b.input + b.output - (a.input + a.output));
}

export const USAGE_GROUPS: readonly UsageGroup[] = ['model', 'account', 'provider'];
export const USAGE_METRICS: readonly UsageMetric[] = ['spend', 'tokens'];

/** What the usage screen keeps in the URL. Absent keys are the defaults. */
export interface UsageQuery {
  days?: 7 | 30 | 90;
  provider?: ProviderId;
  account?: string;
  q?: string;
  metric?: UsageMetric;
  group?: UsageGroup;
  page?: number;
}

export const filtersOf = (query: UsageQuery): UsageFilters => ({
  provider: query.provider ?? 'all',
  accountId: query.account ?? '',
  q: query.q ?? '',
});
