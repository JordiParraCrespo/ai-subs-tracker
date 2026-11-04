import { toast } from '@flama/design-system-web';
import { desktopBridge } from '@flama/frontend-web';
import type { LoginProgress } from '@flama/shared/desktop';
import type { LocalProviderId } from '@flama/shared/subscriptions';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const NOTHING_YET: LoginProgress = { link: null, code: null };

/**
 * One add-account sign-in through the desktop app: starts the provider's CLI
 * login, follows what it prints (the link, Codex's code), types a pasted code
 * into it, and stops it when the person goes back or closes the dialog.
 * `onAdded` runs once the CLI has signed the new account in, `onFailed` when
 * it stopped without one (the reason is `failure`).
 */
export function useAddLogin({ onAdded, onFailed }: { onAdded: () => void; onFailed: () => void }) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<LoginProgress>(NOTHING_YET);
  const [running, setRunning] = useState<LocalProviderId | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // Which start a result belongs to: a login stopped by Back resolves later,
  // and must not close the dialog or toast over the next one.
  const generation = useRef(0);
  const active = useRef(false);

  // The desktop app pushes what the CLI printed; listen while the dialog is open.
  useEffect(() => desktopBridge?.accounts.onLoginProgress(setProgress), []);

  // The CLI is a process on the machine: closing the dialog stops it.
  useEffect(
    () => () => {
      if (active.current) void desktopBridge?.accounts.cancelLogin();
    },
    [],
  );

  const start = async (provider: LocalProviderId) => {
    const bridge = desktopBridge;
    if (!bridge) return;
    const mine = ++generation.current;
    active.current = true;
    setProgress(NOTHING_YET);
    setSubmitting(false);
    setFailure(null);
    setRunning(provider);
    const result = await bridge.accounts.addLogin(provider);
    if (mine !== generation.current) return;
    active.current = false;
    setRunning(null);
    setSubmitting(false);
    if (result.ok) {
      toast.success(t('toasts.accountAdded'));
      onAdded();
    } else {
      // Said on the screen the person returns to, where it can be re-read.
      setFailure(result.message ?? t('accounts.add.failed'));
      onFailed();
    }
  };

  const cancel = () => {
    generation.current++;
    if (active.current) void desktopBridge?.accounts.cancelLogin();
    active.current = false;
    setRunning(null);
    setSubmitting(false);
  };

  const submitCode = (code: string) => {
    setSubmitting(true);
    void desktopBridge?.accounts.submitLoginCode(code);
  };

  return { progress, running, submitting, failure, start, cancel, submitCode };
}
