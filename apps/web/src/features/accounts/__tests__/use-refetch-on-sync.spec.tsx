import { accountsKeys } from '@flama/frontend-consumer/react';
import type { CollectorStatus } from '@flama/shared/desktop';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useRefetchOnSync } from '../hooks/use-refetch-on-sync';

const bridge = vi.hoisted(() => {
  let listener: ((status: CollectorStatus) => void) | null = null;
  let initial: CollectorStatus | null = null;
  return {
    setInitial(status: CollectorStatus) {
      initial = status;
    },
    emit(status: CollectorStatus) {
      listener?.(status);
    },
    desktopBridge: {
      collector: {
        status: async () => initial,
        onStatus(fn: (status: CollectorStatus) => void) {
          listener = fn;
          return () => {
            listener = null;
          };
        },
      },
    },
  };
});

vi.mock('@flama/frontend-web', () => ({ desktopBridge: bridge.desktopBridge }));

function status(phase: CollectorStatus['phase'], lastRunAt: string | null): CollectorStatus {
  return { phase, lastRunAt, nextRunAt: null, lastError: null, logins: [], readers: [] };
}

function setup(initial: CollectorStatus) {
  bridge.setInitial(initial);
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  renderHook(() => useRefetchOnSync(), { wrapper });
  return { invalidate };
}

// A login the desktop had just synced stayed off the Subscriptions screen
// until the list's 60 s refetch: a finished sync invalidated nothing.
describe('useRefetchOnSync', () => {
  it('refetches the accounts when the collector reports a newer sync', async () => {
    const { invalidate } = setup(status('idle', '2026-11-06T10:00:00.000Z'));
    await act(async () => undefined);
    expect(invalidate).not.toHaveBeenCalled();

    act(() => bridge.emit(status('idle', '2026-11-06T10:01:00.000Z')));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: accountsKeys.all }));
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('does not refetch for the same sync, a run in progress or a failed one', async () => {
    const { invalidate } = setup(status('idle', '2026-11-06T10:00:00.000Z'));
    await act(async () => undefined);
    act(() => {
      bridge.emit(status('collecting', '2026-11-06T10:00:00.000Z'));
      bridge.emit(status('error', '2026-11-06T10:02:00.000Z'));
      bridge.emit(status('idle', '2026-11-06T10:00:00.000Z'));
    });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('refetches after the first sync of a collector that had not synced yet', async () => {
    const { invalidate } = setup(status('signed_out', null));
    await act(async () => undefined);
    act(() => bridge.emit(status('idle', '2026-11-06T10:00:00.000Z')));
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});
