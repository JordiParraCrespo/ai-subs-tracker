import { accountsKeys } from '@flama/frontend-consumer/react';
import { desktopBridge } from '@flama/frontend-web';
import type { UsageReaderState } from '@flama/shared/desktop';
import type { ManualProviderId } from '@flama/shared/subscriptions';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDesktopStatus } from './use-desktop-status';

/**
 * One account's opt-in unofficial usage reader, through the desktop app (the
 * outside system: it keeps the key and calls the vendor). `state` is what the
 * collector last reported for it; undefined when it is off, and always in a
 * browser, where there is no bridge and so no reader.
 */
export function useUsageReader(accountId: string, provider: ManualProviderId) {
  const status = useDesktopStatus();
  const queryClient = useQueryClient();
  const state: UsageReaderState | undefined = status?.readers.find(
    (reader) => reader.accountId === accountId,
  );
  const refresh = () => queryClient.invalidateQueries({ queryKey: accountsKeys.all });

  const connect = useMutation({
    mutationFn: async (apiKey: string) => {
      if (!desktopBridge) throw new Error('No desktop app');
      const result = await desktopBridge.usageReaders.connect(accountId, provider, apiKey);
      // The vendor or ResetOwl said no: its words, shown on the form.
      if (!result.ok) throw new Error(result.message ?? 'The key did not work');
      return result;
    },
    onSuccess: refresh,
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      await desktopBridge?.usageReaders.disconnect(accountId);
    },
  });

  return { available: Boolean(desktopBridge), state, connect, disconnect };
}
