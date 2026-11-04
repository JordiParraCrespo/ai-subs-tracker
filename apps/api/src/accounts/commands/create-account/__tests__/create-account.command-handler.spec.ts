import { ArgumentInvalidException } from '@flama/backend-ddd';
import { describe, expect, it, vi } from 'vitest';
import type { AccountRepositoryPort } from '../../../database/account.repository.port';
import type { AccountEntity } from '../../../domain/account.entity';
import { CreateAccountCommand } from '../create-account.command';
import { CreateAccountCommandHandler } from '../create-account.command-handler';

function setup() {
  const repo = { insert: vi.fn().mockResolvedValue(undefined) };
  return {
    repo,
    handler: new CreateAccountCommandHandler(repo as unknown as AccountRepositoryPort),
  };
}

const base = {
  userId: 'user-1',
  provider: 'zai' as const,
  label: 'Side project',
  email: null,
  planId: 'zai-lite',
  monthlyPriceCents: null,
  renewalDay: 12,
};

describe('CreateAccountCommandHandler', () => {
  it('adds a Z.AI subscription with the plan and billing day the person gave', async () => {
    const { repo, handler } = setup();

    const id = await handler.execute(new CreateAccountCommand({ input: base }));

    const saved = repo.insert.mock.calls[0][0] as AccountEntity;
    expect(saved.id).toBe(id);
    expect(saved.provider).toBe('zai');
    // A namespace no collector reports, so a sync can never adopt or clash with it.
    expect(saved.externalId).toBe(`manual:${id}`);
    expect(saved.plan?.id).toBe('zai-lite');
    expect(saved.effectivePriceCents).toBe(1800);
    expect(saved.renewalDay).toBe(12);
    expect(saved.isManual).toBe(true);
    expect(saved.lastSyncedAt).toBeNull();
  });

  // Regression: a Pro or Max account saved without a price would count as $0
  // on the overview, since Z.AI publishes no list price for those tiers.
  it('refuses a tier without a published price unless the person gives one', async () => {
    const { repo, handler } = setup();
    await expect(
      handler.execute(new CreateAccountCommand({ input: { ...base, planId: 'zai-pro' } })),
    ).rejects.toBeInstanceOf(ArgumentInvalidException);
    expect(repo.insert).not.toHaveBeenCalled();

    await handler.execute(
      new CreateAccountCommand({ input: { ...base, planId: 'zai-pro', monthlyPriceCents: 7200 } }),
    );
    expect((repo.insert.mock.calls[0][0] as AccountEntity).effectivePriceCents).toBe(7200);
  });

  it('refuses another provider’s plan', async () => {
    const { handler } = setup();
    await expect(
      handler.execute(new CreateAccountCommand({ input: { ...base, planId: 'claude-pro' } })),
    ).rejects.toBeInstanceOf(ArgumentInvalidException);
  });
});

describe('editing a hand-tracked account', () => {
  // Regression: clearing the price of a Z.AI Pro account would leave it at $0,
  // and clearing its plan would leave nothing to say what is tracked.
  it('keeps a plan, and a price where the plan has no published one', async () => {
    const { repo, handler } = setup();
    await handler.execute(
      new CreateAccountCommand({ input: { ...base, planId: 'zai-max', monthlyPriceCents: 16000 } }),
    );
    const account = repo.insert.mock.calls[0][0] as AccountEntity;

    expect(() => account.edit({ monthlyPriceCents: null })).toThrow(ArgumentInvalidException);
    expect(() => account.edit({ planId: null })).toThrow();
    account.edit({ planId: 'zai-lite', monthlyPriceCents: null });
    expect(account.effectivePriceCents).toBe(1800);
  });
});
