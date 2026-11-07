import { rankAccounts } from '@flama/shared/subscriptions';
import type { SyncedAccount } from './api-client';
import type { Translate } from './locale';

/**
 * What the tray says, from the last sync's answer: the account to use next
 * (the same ranking the screens use) and its weekly headroom, in the
 * language `t` speaks.
 */

export interface TrayModel {
  /** First menu row, e.g. "Use next: Work Max — 62% left". */
  headline: string;
  /** macOS menu-bar title next to the icon, e.g. "62%"; '' when there is no pick. */
  title: string;
  tooltip: string;
}

export function trayModel(
  accounts: readonly SyncedAccount[] | null,
  now: Date,
  t: Translate,
): TrayModel {
  if (!accounts) {
    return { headline: t('notSynced'), title: '', tooltip: 'ResetOwl' };
  }
  const ranking = rankAccounts(
    accounts.map((a) => ({
      id: a.id,
      status: a.latest?.status ?? null,
      windows: a.latest?.windows ?? [],
      reading:
        a.latest?.source && a.latest.capturedAt
          ? { source: a.latest.source, capturedAt: a.latest.capturedAt }
          : null,
    })),
    now,
  );
  const pick = ranking.pick;
  const account = pick ? accounts.find((a) => a.id === pick.id) : undefined;
  if (!pick || !account || pick.left === null) {
    return { headline: t('noRoom'), title: '', tooltip: t('noRoomTooltip') };
  }
  const left = Math.round(pick.left);
  const values = { name: account.displayName, left };
  return {
    headline: t('useNext', values),
    title: `${left}%`,
    tooltip: t('useNextTooltip', values),
  };
}
