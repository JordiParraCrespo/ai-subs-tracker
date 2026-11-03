/**
 * The figures in the home page's product preview: an illustration of the
 * Overview and Tokenmaxx screens, labelled as an example where it renders.
 * Plan names and prices are the catalog's (`@flama/shared/subscriptions`).
 */
import { findPlan } from '@flama/shared/subscriptions';

/** Value of a month's usage at API prices, in dollars, oldest first. */
export const apiValue = [1520, 1575, 1630, 1710, 1770, 1850, 1940, 2020, 2090, 2180, 2290, 2412];

export function monthLabels(locale: string): string[] {
  return apiValue.map((_, i) =>
    new Date(Date.UTC(2025, 11 + i, 1)).toLocaleDateString(locale, {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }),
  );
}

export function dollars(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

const name = (id: string) => findPlan(id)?.name ?? id;

/** The queue, most headroom per hour before its reset first. */
export const useNext = [
  {
    initials: 'CU',
    color: '#d97757',
    title: `Claude ${name('claude-ultra')} · work`,
    window: 'weekly',
    time: '26h',
    left: 58,
  },
  {
    initials: 'CX',
    color: '#10a37f',
    title: `Codex ${name('codex-pro-100')} · personal`,
    window: 'weekly',
    time: '3d',
    left: 71,
  },
  {
    initials: 'CM',
    color: '#c15f3c',
    title: `Claude ${name('claude-max')} · side project`,
    window: 'session',
    time: '2h',
    left: 12,
  },
  {
    initials: 'CP',
    color: '#0e7a61',
    title: `ChatGPT ${name('codex-plus')} · Codex`,
    window: 'weekly',
    time: '6d',
    left: 94,
  },
  {
    initials: 'CP',
    color: '#b5573a',
    title: `Claude ${name('claude-pro')} · spare`,
    window: 'weekly',
    time: '5d',
    left: 100,
  },
] as const;

/** The four plans above (Ultra + Pro $100 + Max + Plus), per month, in dollars. */
export const plansCost = ['claude-ultra', 'codex-pro-100', 'claude-max', 'codex-plus'].reduce(
  (sum, id) => sum + (findPlan(id)?.monthlyPriceCents ?? 0) / 100,
  0,
);
