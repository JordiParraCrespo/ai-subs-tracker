import type { AccountEntity } from '@flama/frontend-consumer';
import type { ProviderId } from '@flama/shared/subscriptions';
import { PROVIDER_NAMES } from './providers';

/**
 * The design's People view, for one person with several logins: each
 * identity (the email a provider knows a login by) is a "person", and the
 * plans signed in under it are its tools. An idle seat is a plan that has
 * used almost none of its week, the one thing worth acting on here.
 */

/** Under this share of the week used, a plan counts as idle. */
export const IDLE_BELOW = 5;

export const PEOPLE_SORTS = ['cost', 'name'] as const;
export type PeopleSort = (typeof PEOPLE_SORTS)[number];
export const PEOPLE_STATUSES = ['all', 'idle'] as const;
export type PeopleStatus = (typeof PEOPLE_STATUSES)[number];

export interface PeopleQuery {
  q?: string;
  provider?: ProviderId;
  status?: PeopleStatus;
  sort?: PeopleSort;
  page?: number;
}

export interface Person {
  key: string;
  name: string;
  /** The organization a provider reports for the identity, if any. */
  organization: string | null;
  accounts: AccountEntity[];
  idle: AccountEntity[];
  monthlyCents: number;
}

export function isIdle(account: AccountEntity): boolean {
  const weekly = account.window('weekly');
  return weekly !== undefined && (weekly.utilization ?? 0) < IDLE_BELOW;
}

export function groupPeople(accounts: readonly AccountEntity[]): Person[] {
  const byKey = new Map<string, Person>();
  for (const account of accounts) {
    const key = (account.email ?? account.label ?? account.externalId).toLowerCase();
    const person = byKey.get(key) ?? {
      key,
      name: account.email ?? account.displayName,
      organization: account.organization,
      accounts: [],
      idle: [],
      monthlyCents: 0,
    };
    person.accounts.push(account);
    if (isIdle(account)) person.idle.push(account);
    person.monthlyCents += account.monthlyPriceCents;
    person.organization ??= account.organization;
    byKey.set(key, person);
  }
  return [...byKey.values()];
}

export function filterPeople(people: readonly Person[], query: PeopleQuery): Person[] {
  const q = (query.q ?? '').trim().toLowerCase();
  return people
    .map((person) => {
      const accounts = person.accounts.filter(
        (account) => !query.provider || account.provider === query.provider,
      );
      const idle = person.idle.filter((account) => accounts.includes(account));
      const monthlyCents = accounts.reduce((sum, account) => sum + account.monthlyPriceCents, 0);
      return { ...person, accounts, idle, monthlyCents };
    })
    .filter(
      (person) =>
        person.accounts.length > 0 &&
        (query.status !== 'idle' || person.idle.length > 0) &&
        (!q ||
          [
            person.name,
            person.organization,
            ...person.accounts.map((a) => PROVIDER_NAMES[a.provider]),
          ]
            .join(' ')
            .toLowerCase()
            .includes(q)),
    )
    .sort(
      query.sort === 'name'
        ? (a, b) => a.name.localeCompare(b.name)
        : (a, b) => b.monthlyCents - a.monthlyCents,
    );
}

/** Two letters for an identity's disc: the email's local part, split on its punctuation. */
export function personInitials(name: string): string {
  const local = name.replace(/@.*/, '');
  const parts = local.split(/[\s._+-]+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : local.slice(0, 2);
  return letters.toUpperCase();
}
