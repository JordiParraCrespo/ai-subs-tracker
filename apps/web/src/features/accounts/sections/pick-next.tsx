import { Alert, AlertDescription, Button, Skeleton } from '@flama/design-system-web';
import { Flame } from '@flama/design-system-web/icons';
import { useAccounts } from '@flama/frontend-consumer/react';
import { useErrorMessage, useLocale } from '@flama/frontend-web';
import { useNow } from '@flama/react-hooks';
import { rankAccounts } from '@flama/shared/subscriptions';
import { useTranslation } from 'react-i18next';
import { AccountIdentity } from '../components/account-identity';
import { Stat } from '../components/stat';
import { useSwitchAccount } from '../hooks/use-switch-account';
import { formatPercent, formatResetIn } from '../lib/format';

/**
 * The one account to use next — the headroom you lose soonest if you don't —
 * and the button that points your terminals at it.
 */
export function PickNext() {
  const { t } = useTranslation();
  const locale = useLocale();
  const resolveError = useErrorMessage();
  const now = useNow(60_000);
  const accounts = useAccounts();
  const switcher = useSwitchAccount();

  if (!accounts.data) return <Skeleton className="mb-8 h-44 w-full" />;
  const ranking = rankAccounts(accounts.data, new Date(now));
  const pick = ranking.pick && accounts.data.find((account) => account.id === ranking.pick?.id);
  const usable = ranking.queue.filter((pace) => pace.usable);
  const expiring = ranking.queue.filter(
    (pace) => pace.usable && pace.hoursToReset !== null && pace.hoursToReset <= 24,
  );
  const atLimit = ranking.queue.filter((pace) => pace.status === 'limit').length;

  return (
    <section className="mb-8 grid gap-4 lg:grid-cols-[3fr_2fr]">
      <div className="rounded-2xl border border-border-subtle bg-status-active-bg p-6 text-ink-900">
        <div className="flex items-center gap-2 text-xs font-medium tracking-widest text-status-active uppercase">
          <Flame className="size-4" />
          {t('accounts.tokenmaxx.useNext')}
        </div>
        {pick && ranking.pick ? (
          <>
            <div className="mt-4 rounded-xl bg-surface-card p-3">
              <AccountIdentity account={pick} />
            </div>
            <p className="mt-4 text-base">
              {t('accounts.tokenmaxx.pickLine', {
                left: formatPercent(ranking.pick.left),
                reset: formatResetIn(ranking.pick.weeklyResetsAt, now, locale) ?? '—',
              })}
            </p>
            <p className="mt-1 text-sm text-ink-600">
              {t(`accounts.tokenmaxx.reason.${ranking.reason ?? 'most_headroom'}`)}
            </p>
            <Button
              className="mt-5"
              disabled={pick.isActive || switcher.isPending}
              onClick={() => switcher.switchTo(pick)}
            >
              {pick.isActive ? t('accounts.tokenmaxx.inUse') : t('accounts.tokenmaxx.useThis')}
            </Button>
          </>
        ) : (
          <p className="mt-4 text-base">{t('accounts.tokenmaxx.nothingUsable')}</p>
        )}
        {switcher.error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>
              {resolveError(switcher.error, t('common.error')).message}
            </AlertDescription>
          </Alert>
        )}
      </div>
      <div className="grid grid-cols-2 content-start gap-6 rounded-2xl border border-border-subtle bg-surface-card p-6">
        <Stat label={t('accounts.tokenmaxx.usable')} value={usable.length} />
        <Stat label={t('accounts.tokenmaxx.atLimit')} value={atLimit} />
        <Stat
          label={t('accounts.tokenmaxx.expiringSoon')}
          value={formatPercent(expiring.reduce((sum, pace) => sum + (pace.left ?? 0), 0))}
          hint={t('accounts.tokenmaxx.expiringHint')}
        />
        <Stat
          label={t('accounts.tokenmaxx.averageUsed')}
          value={formatPercent(
            usable.length
              ? usable.reduce((sum, pace) => sum + (pace.weeklyUsed ?? 0), 0) / usable.length
              : null,
          )}
        />
      </div>
    </section>
  );
}
