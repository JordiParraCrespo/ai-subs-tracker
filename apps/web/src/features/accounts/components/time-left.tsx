import { useNow } from '@flama/react-hooks';
import { useTranslation } from 'react-i18next';

const TICK_MS = 15_000;

/**
 * How long a sign-in has before ResetOwl stops the CLI, in whole minutes. A
 * leaf of its own, so the tick re-renders only this line.
 */
export function TimeLeft({ deadline }: { deadline: string | null }) {
  const { t } = useTranslation();
  const now = useNow(TICK_MS);
  if (!deadline) return t('accounts.add.claude.expires');
  const minutes = Math.max(0, Math.ceil((Date.parse(deadline) - now) / 60_000));
  return t('accounts.add.claude.timeLeft', { count: minutes });
}
