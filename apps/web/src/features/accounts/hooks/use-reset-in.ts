import { useTranslation } from 'react-i18next';

/** "in 40 minutes" / "in 5 hours" / "in 3 days" for a reset this many hours away. */
export function useResetIn(): (hours: number) => string {
  const { t } = useTranslation();
  return (hours) => {
    if (hours < 1)
      return t('accounts.tm.inMinutes', { count: Math.max(1, Math.round(hours * 60)) });
    if (hours < 48) return t('accounts.tm.inHours', { count: Math.round(hours) });
    return t('accounts.tm.inDays', { count: Math.round(hours / 24) });
  };
}
