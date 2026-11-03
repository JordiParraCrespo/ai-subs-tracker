import type { LocalLogin } from '@flama/shared/desktop';
import type { SyncAccount, SyncAccountsInput } from '@flama/shared/schemas/accounts';
import {
  type CodingAgentProvider,
  type DetectedLogin,
  externalIdFor,
  localDay,
  PROVIDERS,
  type ProviderEnv,
} from '@flama/usage-providers';
import { isActiveLogin } from './pointers';

/**
 * Reads every login on this machine, deciding per login whether to ask the
 * provider for limits (a login the provider is rate limiting is read from
 * disk only for a while). Same collapse rule as `collectAll`: two logins of
 * one account keep the default, then one the person set up.
 */

export interface LocalAccount {
  login: DetectedLogin;
  account: SyncAccount;
}

function preference(login: DetectedLogin): number {
  return (login.isDefault ? 0 : 2) + (login.managed ? 1 : 0);
}

export async function readLocalAccounts(
  env: ProviderEnv,
  opts: { sinceDay: string; fetchLimitsFor: (login: DetectedLogin) => boolean },
  providers: readonly CodingAgentProvider[] = PROVIDERS,
): Promise<LocalAccount[]> {
  const perProvider = await Promise.all(
    providers.map(async (provider) => {
      const logins = await provider.detect(env).catch(() => [] as DetectedLogin[]);
      return Promise.all(
        logins.map(async (login): Promise<LocalAccount> => {
          const fetchLimits = opts.fetchLimitsFor(login);
          try {
            return {
              login,
              account: await provider.read(login, env, { sinceDay: opts.sinceDay, fetchLimits }),
            };
          } catch (err) {
            return {
              login,
              account: {
                provider: provider.id,
                externalId: externalIdFor(null, null, login.home),
                email: null,
                organization: null,
                reportedPlan: null,
                location: login.home.slice(0, 300),
                snapshot: fetchLimits
                  ? {
                      capturedAt: env.now().toISOString(),
                      source: 'poll',
                      status: 'error',
                      message: (err instanceof Error ? err.message : String(err)).slice(0, 500),
                      windows: [],
                      extraUsage: null,
                    }
                  : null,
                dailyTokens: [],
              },
            };
          }
        }),
      );
    }),
  );
  const kept = new Map<string, LocalAccount>();
  for (const item of perProvider.flat()) {
    const key = `${item.account.provider}\u0000${item.account.externalId}`;
    const current = kept.get(key);
    if (!current || preference(item.login) < preference(current.login)) kept.set(key, item);
  }
  return [...kept.values()];
}

/** The local day `days` before `now`, `YYYY-MM-DD`. */
export function sinceDayFor(now: Date, days = 7): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return localDay(d);
}

export function buildSyncInput(
  accounts: readonly LocalAccount[],
  device: { name: string; platform: string },
): SyncAccountsInput {
  return {
    device: {
      name: (device.name.trim() || 'Unknown device').slice(0, 120),
      platform: (device.platform || 'unknown').slice(0, 40),
    },
    accounts: accounts.slice(0, 50).map((item) => item.account),
  };
}

/** The bridge's view of a login; `pointers` maps provider → pointer content. */
export function toLocalLogins(
  accounts: readonly LocalAccount[],
  pointers: Partial<Record<string, string>>,
): LocalLogin[] {
  return accounts.map(({ login, account }) => ({
    provider: account.provider,
    externalId: account.externalId,
    email: account.email,
    home: login.home,
    isDefault: login.isDefault,
    managed: login.managed,
    active: isActiveLogin(login, pointers[account.provider] ?? ''),
  }));
}
