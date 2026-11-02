import { configPath, loadConfig, makeId } from "./config.js";
import { PROVIDERS, getProvider } from "./providers/index.js";
import type { AccountConfig, AccountSnapshot, Env } from "./types.js";

export interface ResolvedAccounts {
  accounts: AccountConfig[];
  /** True when nothing is configured and we fell back to auto-discovery. */
  discovered: boolean;
  configPath: string;
}

export async function discoverAccounts(env: Env, existingIds: string[] = []): Promise<AccountConfig[]> {
  const ids = [...existingIds];
  const out: AccountConfig[] = [];
  for (const provider of Object.values(PROVIDERS)) {
    for (const found of (await provider.discover?.(env)) ?? []) {
      const id = makeId(found.label, ids);
      ids.push(id);
      out.push({ ...found, id });
    }
  }
  return out;
}

/** Configured accounts, or auto-discovered ones if no config file exists yet. */
export async function resolveAccounts(env: Env): Promise<ResolvedAccounts> {
  const path = configPath(env);
  const config = await loadConfig(path);
  if (config) return { accounts: config.accounts, discovered: false, configPath: path };
  return { accounts: await discoverAccounts(env), discovered: true, configPath: path };
}

export async function collectSnapshots(accounts: AccountConfig[], env: Env): Promise<AccountSnapshot[]> {
  return Promise.all(
    accounts.map(async (account): Promise<AccountSnapshot> => {
      const provider = getProvider(account.provider);
      try {
        if (!provider) throw new Error(`Unknown provider "${account.provider}"`);
        return await provider.snapshot(account, env);
      } catch (err) {
        return {
          accountId: account.id,
          label: account.label,
          provider: account.provider,
          identity: {},
          status: "error",
          message: err instanceof Error ? err.message : String(err),
          limits: [],
          fetchedAt: env.now().toISOString(),
        };
      }
    }),
  );
}
