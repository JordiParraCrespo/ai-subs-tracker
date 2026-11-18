import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useApiReachable } from './use-api-reachable';

/**
 * What the shell's "Can't reach" screen hangs on. The regression it guards: a
 * rate-limited health probe (429) was read as "offline", so reloading a few
 * pages quickly hid the whole console behind the offline screen.
 */

afterEach(() => vi.unstubAllGlobals());

function answering(status: number) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })));
}

describe('useApiReachable', () => {
  it('counts a rate-limited answer as reachable, since the API answered', async () => {
    answering(429);
    const { result } = renderHook(() => useApiReachable('/api/v1/health'));
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(result.current.reachable).toBe(true);
  });

  it('counts a gateway error as unreachable', async () => {
    answering(502);
    const { result } = renderHook(() => useApiReachable('/api/v1/health'));
    await waitFor(() => expect(result.current.reachable).toBe(false));
  });

  it('counts a failed request as unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const { result } = renderHook(() => useApiReachable('/api/v1/health'));
    await waitFor(() => expect(result.current.reachable).toBe(false));
  });
});
