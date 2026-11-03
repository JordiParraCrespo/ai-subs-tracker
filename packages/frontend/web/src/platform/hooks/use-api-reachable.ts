import { useCallback, useEffect, useState } from 'react';

const PING_EVERY_MS = 30_000;

/**
 * Whether the API answers, for the shell's "Can't reach" screen. Synchronises
 * with systems outside React: the browser's online/offline events and page
 * visibility, and the API's health probe. The probe is asked on mount, when
 * the browser comes back online or the page back into view, every 30 seconds
 * while the API is unreachable, and on `retry`. A healthy API is not polled.
 */
export function useApiReachable(healthUrl: string) {
  const [reachable, setReachable] = useState(true);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setReachable(false);
      return;
    }
    setChecking(true);
    try {
      const response = await fetch(healthUrl, { credentials: 'omit', cache: 'no-store' });
      setReachable(response.ok);
    } catch {
      setReachable(false);
    } finally {
      setChecking(false);
    }
  }, [healthUrl]);

  useEffect(() => {
    void check();
    const online = () => void check();
    const offline = () => setReachable(false);
    const visible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [check]);

  useEffect(() => {
    if (reachable) return;
    const timer = window.setInterval(() => void check(), PING_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [reachable, check]);

  return { reachable, checking, retry: check };
}
