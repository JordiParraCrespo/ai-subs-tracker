import { DsButton } from '@flama/design-system-web';
import { ChevronLeft, ChevronRight } from '@flama/design-system-web/icons';
import type { AccountEntity } from '@flama/frontend-consumer';
import { useAccounts } from '@flama/frontend-consumer/react';
import { dateFormatter, useLocale } from '@flama/frontend-web';
import { useNow } from '@flama/react-hooks';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../lib/format';
import { accountTitle } from '../lib/marks';
import { PROVIDER_NAMES } from '../lib/providers';
import { monthGrid, monthKey, parseMonth, sameDay } from '../lib/renewals';

const ICON = { className: 'size-4', strokeWidth: 1.5 } as const;

/**
 * The design's month calendar: each plan on the day it bills, the month's
 * total, and Previous / Today / Next. The month lives in the URL.
 */
export function RenewalsCalendar({
  month: requested,
  onMonth,
  onOpen,
}: {
  month?: string;
  onMonth: (month: string | undefined) => void;
  onOpen: (account: AccountEntity) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = new Date(useNow(3_600_000));
  const { data: accounts = [] } = useAccounts();
  const { year, month } = parseMonth(requested, now);
  const cells = monthGrid(year, month, accounts);
  const total = cells.reduce(
    (sum, cell) => sum + cell.accounts.reduce((s, account) => s + account.monthlyPriceCents, 0),
    0,
  );
  const title = dateFormatter(locale, { month: 'long', year: 'numeric' }).format(
    new Date(year, month, 1),
  );
  const weekday = dateFormatter(locale, { weekday: 'short' });
  // 2024-01-01 was a Monday: seven days from it name the columns in this locale.
  const weekdays = Array.from({ length: 7 }, (_, i) => weekday.format(new Date(2024, 0, 1 + i)));

  return (
    <section className="ds-card min-w-0 flex-[3_1_640px] overflow-hidden">
      <div className="ds-card-head">
        <div className="flex flex-col gap-0.5">
          <h2 className="ds-body-strong m-0">{title}</h2>
          <span className="ds-cell-sub">
            {t('accounts.renewals.monthTotal', { value: formatMoney(total, locale) })}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <DsButton
            variant="ghost"
            size="sm"
            aria-label={t('accounts.renewals.previous')}
            icon={<ChevronLeft {...ICON} />}
            onClick={() => onMonth(monthKey(year, month - 1))}
          />
          <DsButton variant="ghost" size="sm" onClick={() => onMonth(undefined)}>
            {t('accounts.renewals.today')}
          </DsButton>
          <DsButton
            variant="ghost"
            size="sm"
            aria-label={t('accounts.renewals.next')}
            icon={<ChevronRight {...ICON} />}
            onClick={() => onMonth(monthKey(year, month + 1))}
          />
        </div>
      </div>
      <div className="ds-cal-head" aria-hidden>
        {weekdays.map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>
      <div className="ds-cal">
        {cells.map((cell) => (
          <div
            key={cell.date.toISOString()}
            className="ds-cal__cell"
            data-out={cell.inMonth ? undefined : ''}
          >
            {cell.inMonth &&
              (sameDay(cell.date, now) ? (
                <span className="ds-cal__today">{cell.date.getDate()}</span>
              ) : (
                <span className="ds-cal__day">{cell.date.getDate()}</span>
              ))}
            {cell.accounts.map((account) => (
              <button
                key={account.id}
                type="button"
                className="ds-cal__event"
                title={`${accountTitle(account)} · ${account.displayName}`}
                onClick={() => onOpen(account)}
              >
                <span className="ds-cal__event-name">
                  {account.planName ?? PROVIDER_NAMES[account.provider]}
                </span>
                <span className="ds-cal__event-amount">
                  {formatMoney(account.monthlyPriceCents, locale)}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
