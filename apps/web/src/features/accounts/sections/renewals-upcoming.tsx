import { DsButton } from '@flama/design-system-web';
import type { AccountEntity } from '@flama/frontend-consumer';
import { useAccounts } from '@flama/frontend-consumer/react';
import { dateFormatter, useLocale } from '@flama/frontend-web';
import { useNow } from '@flama/react-hooks';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../lib/format';
import { accountTitle } from '../lib/marks';
import { PROVIDER_NAMES } from '../lib/providers';
import { unscheduled, upcomingRenewals } from '../lib/renewals';

/**
 * The design's "Next 30 days": each plan's next charge in date order, and
 * under it the paid plans with no renewal day yet, each a click away from
 * setting one.
 */
export function RenewalsUpcoming({ onOpen }: { onOpen: (account: AccountEntity) => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = new Date(useNow(3_600_000));
  const { data: accounts = [] } = useAccounts();
  const upcoming = upcomingRenewals(accounts, now);
  const missing = unscheduled(accounts);
  const due = upcoming.reduce((sum, entry) => sum + entry.account.monthlyPriceCents, 0);
  const mon = dateFormatter(locale, { month: 'short' });
  const checked = dateFormatter(locale, { day: 'numeric', month: 'short' });
  // A day the login reports is the provider's word, not the person's: say so.
  const source = (account: AccountEntity) => {
    if (account.renewalDayOverridden || account.renewalDay === null) return null;
    const provider = PROVIDER_NAMES[account.provider];
    if (!account.renewalCheckedAt) {
      return { line: t('accounts.renewals.reportedDay', { provider }), hint: undefined };
    }
    const date = checked.format(account.renewalCheckedAt);
    return {
      line: t('accounts.renewals.reportedDayChecked', { provider, date }),
      hint: t('accounts.renewals.reportedDayHint', { provider, date }),
    };
  };

  return (
    <section className="ds-card flex min-h-105 min-w-0 flex-[1_1_300px] flex-col overflow-hidden">
      <div className="flex min-h-18 flex-none flex-col justify-center gap-0.5 border-b border-border-default px-6">
        <h2 className="ds-body-strong m-0">{t('accounts.renewals.next30')}</h2>
        <span className="ds-cell-sub">
          {t('accounts.renewals.due', { value: formatMoney(due, locale), count: upcoming.length })}
        </span>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto">
        {upcoming.map(({ account, date }) => {
          const from = source(account);
          return (
            <button
              key={account.id}
              type="button"
              className="ds-row ds-row--card"
              onClick={() => onOpen(account)}
            >
              <span className="ds-date-stack">
                <span className="ds-date-stack__mon">{mon.format(date)}</span>
                <span className="ds-date-stack__day">{date.getDate()}</span>
              </span>
              <span className="ds-row__txt">
                <span className="ds-cell-strong">{accountTitle(account)}</span>
                <span className="ds-cell-sub">{account.displayName}</span>
                {from && (
                  <span className="ds-cell-sub" title={from.hint}>
                    {from.line}
                  </span>
                )}
              </span>
              <span className="ds-cell-money">
                {formatMoney(account.monthlyPriceCents, locale)}
              </span>
            </button>
          );
        })}
        {upcoming.length === 0 && missing.length === 0 && (
          <p className="ds-text-label ds-muted m-0 px-6 py-5">{t('accounts.renewals.none')}</p>
        )}
        {missing.length > 0 && (
          <div className="flex flex-col border-t border-border-default">
            <div className="flex flex-col gap-0.5 px-6 pt-5 pb-2">
              <span className="ds-label-strong">{t('accounts.renewals.missingTitle')}</span>
              <span className="ds-text-label ds-muted text-pretty">
                {t('accounts.renewals.missingSub')}
              </span>
            </div>
            {missing.map((account) => (
              <div key={account.id} className="flex items-center gap-3 px-6 py-3">
                <span className="ds-row__txt">
                  <span className="ds-cell-strong">{accountTitle(account)}</span>
                  <span className="ds-cell-sub">{account.displayName}</span>
                </span>
                <DsButton size="xs" onClick={() => onOpen(account)}>
                  {t('accounts.renewals.setDay')}
                </DsButton>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
