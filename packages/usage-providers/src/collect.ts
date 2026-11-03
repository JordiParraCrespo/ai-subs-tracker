import type { SyncAccount } from '@flama/shared/schemas/accounts';
import { errorMessage, externalIdFor, snapshot } from './lib/util';
import { PROVIDERS } from './registry';
import type { CodingAgentProvider, DetectedLogin, ProviderEnv, ReadOptions } from './types';

export interface CollectedAccount {
  login: DetectedLogin;
  account: SyncAccount;
}

/** Ranks two logins of one account: the default first, then one the person set up themselves. */
function preference(login: DetectedLogin): number {
  return (login.isDefault ? 0 : 2) + (login.managed ? 1 : 0);
}

async function readSafely(
  provider: CodingAgentProvider,
  login: DetectedLogin,
  env: ProviderEnv,
  opts: ReadOptions,
): Promise<SyncAccount> {
  try {
    return await provider.read(login, env, opts);
  } catch (err) {
    return {
      provider: provider.id,
      externalId: externalIdFor(null, null, login.home),
      email: null,
      organization: null,
      reportedPlan: null,
      location: login.home.slice(0, 300),
      snapshot: opts.fetchLimits ? snapshot(env.now(), 'error', errorMessage(err)) : null,
      dailyTokens: [],
    };
  }
}

/**
 * Detects and reads every login of every provider. Two logins of one account
 * (same provider and externalId) collapse into one, keeping the default.
 */
export async function collectAll(
  env: ProviderEnv,
  opts: ReadOptions,
  providers: readonly CodingAgentProvider[] = PROVIDERS,
): Promise<CollectedAccount[]> {
  const perProvider = await Promise.all(
    providers.map(async (provider) => {
      const logins = await provider.detect(env).catch(() => []);
      return Promise.all(
        logins.map(async (login) => ({
          login,
          account: await readSafely(provider, login, env, opts),
        })),
      );
    }),
  );

  const kept = new Map<string, CollectedAccount>();
  for (const item of perProvider.flat()) {
    const key = `${item.account.provider}\u0000${item.account.externalId}`;
    const current = kept.get(key);
    if (!current || preference(item.login) < preference(current.login)) kept.set(key, item);
  }
  return [...kept.values()];
}
