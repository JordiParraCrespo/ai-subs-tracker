'use client';

import {
  type EntityQueryOptions,
  type HookMutationOptions,
  useEntityQuery,
  withCacheOnSuccess,
} from '@flama/frontend-core/react';
import type {
  CreateAccountInput,
  RecordUsageInput,
  UpdateAccountInput,
} from '@flama/shared/schemas/accounts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
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

/**
 * Refetches the list, the overview and the usage at once: for a change made
 * somewhere else, like a desktop sync, that answered these screens nothing.
 */
export function useRefreshAccounts() {
  const queryClient = useQueryClient();
  // Stable, so a caller can subscribe with it from an effect.
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: accountsKeys.all }),
    [queryClient],
  );
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

/** Adds a subscription tracked by hand; the list gains it at once. */
export function useCreateAccount(
  options?: HookMutationOptions<AccountEntity, Error, CreateAccountInput>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAccountInput) => app.accounts.create(input),
    ...withCacheOnSuccess(options, (created) => {
      queryClient.setQueryData<AccountEntity[]>(accountsKeys.list(), (list) =>
        list ? [...list, created] : [created],
      );
    }),
  });
}

/** Records a usage reading on a hand-tracked subscription; answers with the account. */
export function useRecordAccountUsage(
  options?: HookMutationOptions<AccountEntity, Error, { id: string; input: RecordUsageInput }>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RecordUsageInput }) =>
      app.accounts.recordUsage(id, input),
    ...withCacheOnSuccess(options, (saved) => {
      queryClient.setQueryData<AccountEntity[]>(accountsKeys.list(), (list) =>
        list?.map((account) => (account.id === saved.id ? saved : account)),
      );
    }),
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
