import type { AccountEntity } from '@flama/frontend-consumer';
import {
  type AccountPace,
  currentWindows,
  paceOf,
  rankAccounts,
} from '@flama/shared/subscriptions';

/** One model's own weekly cap (Claude's "Weekly · Fable"), beside the all-models one. */
export interface ModelCap {
  key: string;
  model: string;
  used: number;
  resetsAt: string | null;
}

/**
 * The weekly caps a plan puts on single models, still current at `now`. The
 * model is the provider's own label with its "Weekly · " prefix dropped, so a
 * new capped model shows without a change here.
 */
export function modelCaps(account: AccountEntity, now: Date): ModelCap[] {
  return currentWindows(account, now).flatMap((window) =>
    window.kind === 'weekly_model' && window.utilization !== null
      ? [
          {
            key: window.key,
            model: window.label.replace(/^weekly\s*·\s*/i, '') || window.key,
            used: window.utilization,
            resetsAt: window.resetsAt,
          },
        ]
      : [],
  );
}

export interface ProviderGroup {
  /** Each account, its pace, and the caps it carries on single models. */
  cards: { account: AccountEntity; pace: AccountPace; models: ModelCap[] }[];
  pick: { account: AccountEntity; pace: AccountPace } | null;
  busiest: { account: AccountEntity; pace: AccountPace } | null;
  /** Average weekly use across the group's accounts that report one, 0–100. */
  average: number | null;
  /** An account that runs out alone: moving work off it is the only lever. */
  overloaded: { account: AccountEntity; pace: AccountPace } | null;
}

/** One provider's accounts the way the design's shared-accounts page reads them. */
export function providerGroup(accounts: readonly AccountEntity[], now: Date): ProviderGroup {
  const cards = accounts.map((account) => ({
    account,
    pace: paceOf(account, now),
    models: modelCaps(account, now),
  }));
  const known = cards.filter((card) => card.pace.weeklyUsed !== null);
  const average = known.length
    ? known.reduce((sum, card) => sum + (card.pace.weeklyUsed ?? 0), 0) / known.length
    : null;
  const ranking = rankAccounts(accounts, now);
  const pick = cards.find((card) => card.account.id === ranking.pick?.id) ?? null;
  const busiest =
    [...known].sort((a, b) => (b.pace.weeklyUsed ?? 0) - (a.pace.weeklyUsed ?? 0))[0] ?? null;
  const overloaded = busiest && (busiest.pace.weeklyUsed ?? 0) >= 90 ? busiest : null;
  return { cards, pick, busiest, average, overloaded };
}
