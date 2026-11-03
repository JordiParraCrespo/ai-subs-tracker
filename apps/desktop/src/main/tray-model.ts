import { rankAccounts } from '@flama/shared/subscriptions';
import type { SyncedAccount } from './api-client';

/**
 * What the tray says, from the last sync's answer: the account to use next
 * (the same ranking the screens use) and its weekly headroom.
 */

export interface TrayModel {
  /** First menu row, e.g. "Use next: Work Max — 62% left". */
  headline: string;
  /** macOS menu-bar title next to the icon, e.g. "62%"; '' when there is no pick. */
  title: string;
  tooltip: string;
}

export function trayModel(accounts: readonly SyncedAccount[] | null, now: Date): TrayModel {
  if (!accounts) {
    return { headline: 'Not synced yet', title: '', tooltip: 'ResetOwl' };
  }
  const ranking = rankAccounts(
    accounts.map((a) => ({
      id: a.id,
      status: a.latest?.status ?? null,
      windows: a.latest?.windows ?? [],
    })),
    now,
  );
  const pick = ranking.pick;
  const account = pick ? accounts.find((a) => a.id === pick.id) : undefined;
  if (!pick || !account || pick.left === null) {
    return {
      headline: 'No account has room right now',
      title: '',
      tooltip: 'ResetOwl: no account has room right now',
    };
  }
  const left = Math.round(pick.left);
  return {
    headline: `Use next: ${account.displayName} — ${left}% left`,
    title: `${left}%`,
    tooltip: `ResetOwl: use ${account.displayName} next (${left}% of the week left)`,
  };
}
