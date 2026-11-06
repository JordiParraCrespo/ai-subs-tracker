import { AppError } from '@flama/backend-core';
import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { AccountRepositoryPort } from '../../../database/account.repository.port';
import { AccountEntity } from '../../../domain/account.entity';
import { ActivateAccountCommand } from '../activate-account.command';
import { ActivateAccountCommandHandler } from '../activate-account.command-handler';

function make(id: string, provider: 'claude-code' | 'codex', active = false) {
  const entity = AccountEntity.register(id, {
    userId: 'user-1',
    provider,
    externalId: `ext-${id}`,
    email: null,
    organization: null,
    reportedPlan: null,
    location: null,
    reportedRenewal: null,
    at: new Date(),
  });
  if (active) entity.activate(new Date());
  return entity;
}

describe('ActivateAccountCommandHandler', () => {
  it('activates the account and switches off the others of the same provider only', async () => {
    const target = make('a', 'claude-code');
    const previous = make('b', 'claude-code', true);
    const codex = make('c', 'codex', true);
    const repo = {
      findOwned: vi.fn().mockResolvedValue(Some(target)),
      findForUser: vi.fn().mockResolvedValue([target, previous, codex]),
      saveAll: vi.fn().mockResolvedValue(undefined),
    };
    const handler = new ActivateAccountCommandHandler(repo as unknown as AccountRepositoryPort);

    await handler.execute(new ActivateAccountCommand({ userId: 'user-1', accountId: 'a' }));

    expect(target.isActive).toBe(true);
    expect(previous.isActive).toBe(false);
    expect(codex.isActive).toBe(true);
    const saved = repo.saveAll.mock.calls[0][0] as AccountEntity[];
    expect(saved.map((entity) => entity.id).sort()).toEqual(['a', 'b']);
  });

  it('answers not found for an account the caller does not own', async () => {
    const repo = { findOwned: vi.fn().mockResolvedValue(None) };
    const handler = new ActivateAccountCommandHandler(repo as unknown as AccountRepositoryPort);
    await expect(
      handler.execute(new ActivateAccountCommand({ userId: 'user-1', accountId: 'x' })),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('refuses to point terminals at a subscription tracked by hand', async () => {
    const zai = AccountEntity.addManual('z', {
      userId: 'user-1',
      provider: 'zai',
      label: 'GLM',
      email: null,
      planId: 'zai-lite',
      monthlyPriceCents: null,
      renewalDay: null,
    });
    const repo = {
      findOwned: vi.fn().mockResolvedValue(Some(zai)),
      findForUser: vi.fn(),
      saveAll: vi.fn(),
    };
    const handler = new ActivateAccountCommandHandler(repo as unknown as AccountRepositoryPort);
    await expect(
      handler.execute(new ActivateAccountCommand({ userId: 'user-1', accountId: 'z' })),
    ).rejects.toMatchObject({ code: 'ACCOUNT_003' });
    expect(zai.isActive).toBe(false);
    expect(repo.saveAll).not.toHaveBeenCalled();
  });
});
