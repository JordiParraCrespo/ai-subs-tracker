/**
 * Number formatting for the accounts screens. `Intl` formatters are built
 * once per locale and kept: constructing one per render is the cost
 * `frontend-ui.md` warns about.
 */
const money = new Map<string, Intl.NumberFormat>();
const moneyExact = new Map<string, Intl.NumberFormat>();
const compact = new Map<string, Intl.NumberFormat>();
const relative = new Map<string, Intl.RelativeTimeFormat>();

function cached<T>(map: Map<string, T>, locale: string, make: () => T): T {
  let value = map.get(locale);
  if (!value) {
    value = make();
    map.set(locale, value);
  }
  return value;
}

/** US cents as dollars; whole dollars unless there are cents to show. */
export function formatMoney(cents: number, locale: string): string {
  const exact = Math.round(cents) % 100 !== 0 && Math.abs(cents) < 10_000;
  const format = exact
    ? cached(moneyExact, locale, () =>
        Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }),
      )
    : cached(money, locale, () =>
        Intl.NumberFormat(locale, {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }),
      );
  return format.format(cents / 100);
}

/** 203M, 1.26M, 980k. */
export function formatCompact(value: number, locale: string): string {
  return cached(compact, locale, () =>
    Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }),
  ).format(value);
}

export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)}%`;
}

/** "in 9 hr", "3 days ago" — or null when there is no time to name. */
export function formatResetIn(at: string | null, now: number, locale: string): string | null {
  if (!at) return null;
  const hours = (new Date(at).getTime() - now) / 3_600_000;
  const size = Math.abs(hours);
  const format = cached(
    relative,
    locale,
    () => new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' }),
  );
  if (size < 1) return format.format(Math.round(hours * 60), 'minute');
  if (size < 48) return format.format(Math.round(hours), 'hour');
  return format.format(Math.round(hours / 24), 'day');
}
