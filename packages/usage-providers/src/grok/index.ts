import { join, resolve, sep } from 'node:path';
import type { LimitWindow, SyncAccount, UsageSnapshot } from '@flama/shared/schemas/accounts';
import { errorMessage, exists, externalIdFor, snapshot, subdirectories } from '../lib/util';
import type {
  CodingAgentProvider,
  DetectedLogin,
  LoginCommand,
  LoginOptions,
  ProviderEnv,
  ReadOptions,
} from '../types';
import { type GrokAuth, isGrokSessionFresh, readGrokAuth } from './auth';
import {
  BILLING_CREDITS_URL,
  BILLING_DEFAULT_URL,
  billingConfig,
  billingTier,
  fetchGrokBilling,
  GrokHttpError,
  monthlyWindow,
  reportsAnyUsageScalar,
  weeklyWindow,
} from './billing';

/**
 * Grok Build, xAI's coding agent (`grok`), signed in with an X Subscription
 * or SuperGrok account. Its login is `<GROK_HOME>/auth.json` (`~/.grok` by
 * default); the plan's weekly pool comes from the CLI's billing view. Grok
 * Build's session logs carry no per-message token counts, so no tokens are
 * reported.
 */

function expandHome(path: string, home: string): string {
  if (path === '~') return home;
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(home, path.slice(2));
  return resolve(path);
}

/** The home a plain terminal uses: `$GROK_HOME`, else `~/.grok`. */
export function defaultGrokHome(env: ProviderEnv): string {
  const fromEnv = env.env.GROK_HOME;
  return fromEnv ? expandHome(fromEnv, env.home) : join(env.home, '.grok');
}

function grokCommand(login: DetectedLogin): string {
  return login.isDefault ? 'grok' : `GROK_HOME=${login.home} grok`;
}

async function hasGrokLogin(home: string): Promise<boolean> {
  return exists(join(home, 'auth.json'));
}

async function detect(env: ProviderEnv): Promise<DetectedLogin[]> {
  const found: DetectedLogin[] = [];
  const managedDir = resolve(env.managedRoot, 'grok');
  const defaultHome = resolve(defaultGrokHome(env));
  if (await hasGrokLogin(defaultHome)) {
    found.push({
      provider: 'grok',
      home: defaultHome,
      isDefault: true,
      managed: defaultHome.startsWith(managedDir + sep),
    });
  }
  for (const dir of await subdirectories(managedDir)) {
    const home = resolve(dir);
    if (home === defaultHome || !(await hasGrokLogin(home))) continue;
    found.push({ provider: 'grok', home, isDefault: false, managed: true });
  }
  return found;
}

/**
 * The plan's usage pool, read as Orca reads it: the credits view first, its
 * monthly budget when it has no weekly percentage, then the default view for
 * a unified-billing account's monthly budget. A rejected session is an error,
 * not a sign-out (only the CLI can say that), and a lapsed one is stale: the
 * CLI renews it the next time `grok` runs.
 */
async function readLimits(
  login: DetectedLogin,
  auth: GrokAuth | null,
  env: ProviderEnv,
): Promise<{ snapshot: UsageSnapshot; tier: string | null }> {
  const now = env.now();
  const run = grokCommand(login);
  if (!auth) {
    return {
      tier: null,
      snapshot: snapshot(now, 'no_credentials', `Not signed in to Grok — run \`${run} login\`.`),
    };
  }
  if (!isGrokSessionFresh(auth, now)) {
    return {
      tier: null,
      snapshot: snapshot(
        now,
        'auth_stale',
        `Grok sign-in expired — run \`${run}\` on this computer; sign in if prompted. No chat message is needed.`,
      ),
    };
  }
  try {
    const data = await fetchGrokBilling(BILLING_CREDITS_URL, auth, env.fetch);
    const config = billingConfig(data);
    if (!config) {
      return {
        tier: null,
        snapshot: snapshot(now, 'ok', 'Grok billing response did not include config.'),
      };
    }
    const tier = billingTier(config, data);
    const ok = (window: LimitWindow) => ({
      tier,
      snapshot: snapshot(now, 'ok', null, [window]),
    });
    const weekly = weeklyWindow(config);
    if (weekly) return ok(weekly);
    // A credits view may already carry the monthly budget; no second request then.
    const monthly = monthlyWindow(config);
    if (monthly) return ok(monthly);
    const fallbackData = await fetchGrokBilling(BILLING_DEFAULT_URL, auth, env.fetch);
    const fallback = billingConfig(fallbackData) ?? fallbackData;
    const fallbackMonthly = monthlyWindow(fallback);
    if (fallbackMonthly) return ok(fallbackMonthly);
    // Spend reported without a percentage is unknown usage, not zero.
    return {
      tier,
      snapshot: snapshot(
        now,
        'ok',
        reportsAnyUsageScalar(config) || reportsAnyUsageScalar(fallback)
          ? 'Grok did not report a usage percentage for this account.'
          : 'Grok billing response did not include credit usage.',
      ),
    };
  } catch (err) {
    if (err instanceof GrokHttpError && (err.status === 401 || err.status === 403)) {
      return {
        tier: null,
        snapshot: snapshot(now, 'error', `Grok usage request unauthorized (HTTP ${err.status}).`),
      };
    }
    if (err instanceof GrokHttpError && err.status === 429) {
      return {
        tier: null,
        snapshot: snapshot(
          now,
          'rate_limited',
          'xAI is rate limiting usage requests; try again in a few minutes.',
        ),
      };
    }
    if (err instanceof GrokHttpError) {
      return {
        tier: null,
        snapshot: snapshot(now, 'error', `Grok usage request failed (HTTP ${err.status}).`),
      };
    }
    return {
      tier: null,
      snapshot: snapshot(now, 'error', `Grok usage request failed: ${errorMessage(err)}`),
    };
  }
}

async function read(
  login: DetectedLogin,
  env: ProviderEnv,
  opts: ReadOptions,
): Promise<SyncAccount> {
  const auth = await readGrokAuth(login.home, env.now()).catch(() => null);
  let tier: string | null = null;
  let snap: UsageSnapshot | null = null;
  if (opts.fetchLimits) {
    const limits = await readLimits(login, auth, env).catch((err: unknown) => ({
      tier: null,
      snapshot: snapshot(env.now(), 'error', errorMessage(err)),
    }));
    tier = limits.tier;
    snap = limits.snapshot;
  }
  return {
    provider: 'grok',
    externalId: externalIdFor(auth?.userId ?? null, auth?.email ?? null, login.home),
    email: auth?.email ?? null,
    // `team_id` is an opaque id, not a name to show.
    organization: null,
    reportedPlan: tier?.slice(0, 80) ?? null,
    location: login.home.slice(0, 300),
    snapshot: snap,
    dailyTokens: [],
    reportedRenewal: null,
  };
}

/**
 * `grok login` signs in through the browser on this computer by default, as
 * Orca runs it; the device-code flow (RFC 8628, a page and a short code) is
 * for finishing the sign-in on another device.
 */
function loginCommand(home: string, opts: LoginOptions = {}): LoginCommand {
  return {
    command: 'grok',
    args: opts.deviceCode ? ['login', '--device-auth'] : ['login'],
    env: { GROK_HOME: home },
    linkHosts: ['accounts.x.ai', 'auth.x.ai'],
  };
}

/** Signed in once `auth.json` holds a session that names someone. */
async function signedInAs(home: string): Promise<string | null> {
  const auth = await readGrokAuth(home, new Date()).catch(() => null);
  if (!auth?.userId && !auth?.email) return null;
  return externalIdFor(auth.userId, auth.email, home);
}

function launchEnv(login: DetectedLogin): Record<string, string> {
  return login.isDefault ? {} : { GROK_HOME: login.home };
}

export const grokProvider: CodingAgentProvider = {
  id: 'grok',
  displayName: 'Grok Build',
  detect,
  read,
  loginCommand,
  supportsDeviceCode: true,
  signedInAs,
  launchEnv,
};
