import { DsButton, DsCard, DsCardHeader, DsCardRow } from '@flama/design-system-web';
import { useAccounts } from '@flama/frontend-consumer/react';
import { dateFormatter, useLocale } from '@flama/frontend-web';
import { useNow } from '@flama/react-hooks';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { formatPercent, formatResetIn } from '../lib/format';
import { upcomingResets } from '../lib/insights';
import { accountTitle } from '../lib/marks';

/** The design's "Next up" card: each account's next weekly reset as a date block. */
export function UpcomingResets() {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(60_000);
  const navigate = useNavigate();
  const { data: accounts = [] } = useAccounts();
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const resets = upcomingResets(accounts, new Date(now)).slice(0, 4);
  const month = dateFormatter(locale, { month: 'short' });

  return (
    <DsCard>
      <DsCardHeader
        title={t('accounts.resets.title')}
        action={
          <DsButton size="text" onClick={() => navigate({ to: '/tokenmaxx' })}>
            {t('accounts.resets.viewAll')}
          </DsButton>
        }
      />
      {resets.map((pace) => {
        const account = byId.get(pace.id);
        if (!account || !pace.weeklyResetsAt) return null;
        const at = new Date(pace.weeklyResetsAt);
        return (
          <DsCardRow
            key={pace.id}
            leading={
              <div className="flex w-8 flex-none flex-col items-center">
                <span className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-ink-400 uppercase">
                  {month.format(at)}
                </span>
                <span className="text-base leading-5 font-semibold">{at.getDate()}</span>
              </div>
            }
            title={accountTitle(account)}
            subtitle={t('accounts.resets.when', {
              when: formatResetIn(pace.weeklyResetsAt, now, locale),
            })}
            value={formatPercent(pace.left)}
            subvalue={t('accounts.resets.leftLabel')}
          />
        );
      })}
      {resets.length === 0 && (
        <p className="border-t border-border-default px-6 py-4 text-sm text-ink-600">
          {t('accounts.resets.empty')}
        </p>
      )}
    </DsCard>
  );
}
