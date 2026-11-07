import { AccountEntity } from '@flama/frontend-consumer';
import type { ProviderId } from '@flama/shared/subscriptions';
import { describe, expect, it } from 'vitest';
import { filterPeople, groupPeople, namedPeople } from '../lib/people';

function account(
  id: string,
  provider: ProviderId,
  email: string,
  person: string | null,
  cents: number,
): AccountEntity {
  return new AccountEntity(
    id,
    provider,
    `ext-${id}`,
    email,
    null,
    person,
    email,
    null,
    null,
    null,
    null,
    null,
    false,
    cents,
    false,
    null,
    false,
    null,
    false,
    null,
    new Date('2026-11-01T00:00:00Z'),
    null,
    [],
  );
}

/**
 * The People page counted every login email as a person, so one human with a
 * personal and a work email showed as two. A person is who uses the account;
 * an email is only an account.
 */
describe('groupPeople', () => {
  const accounts = [
    account('1', 'claude-code', 'me@gmail.com', null, 20_000),
    account('2', 'codex', 'me@gmail.com', null, 10_000),
    account('3', 'claude-code', 'me@work.ai', null, 20_000),
    account('4', 'codex', 'ana@work.ai', 'Ana', 2_000),
    account('5', 'claude-code', 'ana@home.com', ' ana ', 2_000),
  ];

  it('puts every account nobody else was named on under the owner, by email', () => {
    const owner = groupPeople(accounts, 'Jordi Parra').find((p) => p.isOwner);
    expect(owner?.name).toBe('Jordi Parra');
    expect(owner?.identities.map((i) => [i.name, i.plans.length])).toEqual([
      ['me@gmail.com', 2],
      ['me@work.ai', 1],
    ]);
    expect(owner?.monthlyCents).toBe(50_000);
  });

  it('matches a named person regardless of case and spacing', () => {
    const people = groupPeople(accounts, 'Jordi Parra');
    expect(people).toHaveLength(2);
    const ana = people.find((p) => !p.isOwner);
    expect(ana?.name).toBe('Ana');
    expect(ana?.identities).toHaveLength(2);
  });

  it('narrows each person to a provider and drops who holds none of it', () => {
    const codex = filterPeople(groupPeople(accounts, 'Jordi Parra'), { provider: 'codex' });
    expect(codex.map((p) => [p.name, p.identities.length, p.monthlyCents])).toEqual([
      ['Jordi Parra', 1, 10_000],
      ['Ana', 1, 2_000],
    ]);
  });

  it('offers each name once for the editor', () => {
    expect(namedPeople(accounts)).toEqual(['Ana']);
  });
});
