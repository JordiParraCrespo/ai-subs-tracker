import type { AccountEntity } from '@flama/frontend-consumer';
import type { ProviderId } from '@flama/shared/subscriptions';
import { PROVIDER_NAMES } from './providers';

/**
 * The People view. A person is a human; an account is a login a provider
 * knows by an email, and one person often holds several (a personal and a
 * work email). Each account names who uses it (`person`); an account naming
 * nobody is the signed-in person's own. Under each person the accounts are
 * grouped by that email, and each holds its plans (one per provider login).
 * An idle plan is one that has used almost none of its week, the one thing
 * worth acting on here.
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

/** One email (or hand-tracked label) a provider knows a login by, and the plans under it. */
export interface Identity {
  key: string;
  name: string;
  /** The organization a provider reports for the identity, if any. */
  organization: string | null;
  plans: AccountEntity[];
}

export interface Person {
  key: string;
  name: string;
  /** The signed-in person, who holds every account no one else was named on. */
  isOwner: boolean;
  identities: Identity[];
  /** Every plan the person holds, across their accounts. */
  plans: AccountEntity[];
  idle: AccountEntity[];
  monthlyCents: number;
}

const OWNER_KEY = '';

export function isIdle(account: AccountEntity): boolean {
  const weekly = account.window('weekly');
  return weekly !== undefined && (weekly.utilization ?? 0) < IDLE_BELOW;
}

function personKey(account: AccountEntity): string {
  return account.person?.trim().toLowerCase() ?? OWNER_KEY;
}

function identityKey(account: AccountEntity): string {
  return (account.email ?? account.label ?? account.externalId).toLowerCase();
}

function groupIdentities(plans: readonly AccountEntity[]): Identity[] {
  const byKey = new Map<string, Identity>();
  for (const account of plans) {
    const key = identityKey(account);
    const identity = byKey.get(key) ?? {
      key,
      name: account.email ?? account.displayName,
      organization: account.organization,
      plans: [],
    };
    identity.plans.push(account);
    identity.organization ??= account.organization;
    byKey.set(key, identity);
  }
  return [...byKey.values()];
}

function toPerson(
  base: Pick<Person, 'key' | 'name' | 'isOwner'>,
  plans: readonly AccountEntity[],
): Person {
  return {
    ...base,
    identities: groupIdentities(plans),
    plans: [...plans],
    idle: plans.filter(isIdle),
    monthlyCents: plans.reduce((sum, account) => sum + account.monthlyPriceCents, 0),
  };
}

/**
 * The people holding the accounts: the owner (named `ownerName`) and each
 * name given to an account, matched without regard to case or spacing.
 */
export function groupPeople(accounts: readonly AccountEntity[], ownerName: string): Person[] {
  const byKey = new Map<string, { name: string; plans: AccountEntity[] }>();
  for (const account of accounts) {
    const key = personKey(account);
    const entry = byKey.get(key) ?? { name: account.person?.trim() ?? ownerName, plans: [] };
    entry.plans.push(account);
    byKey.set(key, entry);
  }
  return [...byKey.entries()].map(([key, { name, plans }]) =>
    toPerson({ key, name, isOwner: key === OWNER_KEY }, plans),
  );
}

/** The names already given to accounts, once each, for the editor to offer. */
export function namedPeople(accounts: readonly AccountEntity[]): string[] {
  const byKey = new Map<string, string>();
  for (const account of accounts) {
    const name = account.person?.trim();
    if (name && !byKey.has(name.toLowerCase())) byKey.set(name.toLowerCase(), name);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

export function filterPeople(people: readonly Person[], query: PeopleQuery): Person[] {
  const q = (query.q ?? '').trim().toLowerCase();
  return people
    .map((person) =>
      toPerson(
        person,
        person.plans.filter((account) => !query.provider || account.provider === query.provider),
      ),
    )
    .filter(
      (person) =>
        person.plans.length > 0 &&
        (query.status !== 'idle' || person.idle.length > 0) &&
        (!q ||
          [
            person.name,
            ...person.identities.flatMap((identity) => [identity.name, identity.organization]),
            ...person.plans.map((a) => PROVIDER_NAMES[a.provider]),
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

/** Two letters for a disc: a name's first two words, or an email's local part split on its punctuation. */
export function personInitials(name: string): string {
  const local = name.replace(/@.*/, '');
  const parts = local.split(/[\s._+-]+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : local.slice(0, 2);
  return letters.toUpperCase();
}
