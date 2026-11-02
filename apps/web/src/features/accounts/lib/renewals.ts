import type { AccountEntity } from '@flama/frontend-consumer';

/**
 * When each plan bills, from the day of the month its owner set (providers
 * do not report it). A day the month does not have (the 31st in April) bills
 * on the month's last day, as card billing does.
 */

const DAY_MS = 86_400_000;

const daysIn = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

/** The date in this month that a plan billing on `day` renews. */
export function renewalIn(year: number, month: number, day: number): Date {
  return new Date(year, month, Math.min(day, daysIn(year, month)));
}

/** The first renewal on or after `from` (a local midnight). */
export function nextRenewal(day: number, from: Date): Date {
  const thisMonth = renewalIn(from.getFullYear(), from.getMonth(), day);
  return thisMonth >= startOfDay(from)
    ? thisMonth
    : renewalIn(from.getFullYear(), from.getMonth() + 1, day);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export interface CalendarCell {
  date: Date;
  inMonth: boolean;
  accounts: AccountEntity[];
}

/** The month as whole weeks, Monday first, each day with the plans that renew on it. */
export function monthGrid(
  year: number,
  month: number,
  accounts: readonly AccountEntity[],
): CalendarCell[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const count = Math.ceil((lead + daysIn(year, month)) / 7) * 7;
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(year, month, 1 - lead + i);
    const inMonth = date.getMonth() === month;
    return {
      date,
      inMonth,
      accounts: inMonth
        ? accounts.filter(
            (account) =>
              account.renewalDay !== null &&
              sameDay(renewalIn(year, month, account.renewalDay), date),
          )
        : [],
    };
  });
}

export interface Upcoming {
  account: AccountEntity;
  date: Date;
}

/** Every plan with a renewal day, by its next renewal, over the coming `days`. */
export function upcomingRenewals(
  accounts: readonly AccountEntity[],
  now: Date,
  days = 30,
): Upcoming[] {
  const until = startOfDay(now).getTime() + days * DAY_MS;
  return accounts
    .flatMap((account) =>
      account.renewalDay === null ? [] : [{ account, date: nextRenewal(account.renewalDay, now) }],
    )
    .filter((entry) => entry.date.getTime() <= until)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Paid plans whose renewal day nobody has set: off the calendar until someone does. */
export const unscheduled = (accounts: readonly AccountEntity[]) =>
  accounts.filter((account) => account.renewalDay === null && account.monthlyPriceCents > 0);

/** `2026-11` ↔ year and month, for the URL. */
export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
export function parseMonth(value: string | undefined, now: Date): { year: number; month: number } {
  if (value && MONTH_PATTERN.test(value)) {
    const [year, month] = value.split('-').map(Number);
    return { year, month: month - 1 };
  }
  return { year: now.getFullYear(), month: now.getMonth() };
}
export const monthKey = (year: number, month: number) => {
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};
