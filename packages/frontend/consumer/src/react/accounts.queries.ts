'use client';

import {
  type EntityQueryOptions,
  type HookMutationOptions,
  useEntityQuery,
  withCacheOnSuccess,
} from '@flama/frontend-core/react';
import type { UpdateAccountInput } from '@flama/shared/schemas/accounts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccountEntity, UsageSummary } from '../modules/accounts/accounts.entity';
import { useConsumerApp } from './context';

/**
 * Query keys for the signed-in person's coding-agent accounts. No owner id:
 * every endpoint under `/accounts` acts on whoever the credential belongs to.
 */
export const accountsKeys = {
  all: ['accounts'] as const,
  list: () => [...accountsKeys.all, 'list'] as const,
  usage: (days: number) => [...accountsKeys.all, 'usage', days] as const,
};

/** How often the list refreshes on its own: the desktop collector syncs about this often. */
const ACCOUNTS_REFETCH_MS = 60_000;

export function useAccounts(options?: EntityQueryOptions<AccountEntity[]>) {
  const app = useConsumerApp();

  return useEntityQuery({
    queryKey: accountsKeys.list(),
    queryFn: () => app.accounts.list(),
    refetchInterval: ACCOUNTS_REFETCH_MS,
    ...options,
  });
}

/** Token usage is plain numbers, not entities, so it keeps `useQuery`. */
export function useUsageSummary(days: number) {
  const app = useConsumerApp();

  return useQuery<UsageSummary>({
    queryKey: accountsKeys.usage(days),
    queryFn: () => app.accounts.usage(days),
    refetchInterval: ACCOUNTS_REFETCH_MS * 5,
  });
}

export function useUpdateAccount(
  options?: HookMutationOptions<AccountEntity, Error, { id: string; input: UpdateAccountInput }>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAccountInput }) =>
      app.accounts.update(id, input),
    ...withCacheOnSuccess(options, (saved) => {
      queryClient.setQueryData<AccountEntity[]>(accountsKeys.list(), (list) =>
        list?.map((account) => (account.id === saved.id ? saved : account)),
      );
    }),
  });
}

/** Answers with every account: activating one switches the others of its provider off. */
export function useActivateAccount(options?: HookMutationOptions<AccountEntity[], Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => app.accounts.activate(id),
    ...withCacheOnSuccess(options, (accounts) => {
      queryClient.setQueryData(accountsKeys.list(), accounts);
    }),
  });
}

export function useArchiveAccount(options?: HookMutationOptions<void, Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => app.accounts.archive(id),
    ...withCacheOnSuccess(options, () => {
      queryClient.invalidateQueries({ queryKey: accountsKeys.all });
    }),
  });
}
