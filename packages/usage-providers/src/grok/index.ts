import { join, resolve, sep } from 'node:path';
import type { SyncAccount, UsageSnapshot } from '@flama/shared/schemas/accounts';
import { errorMessage, exists, externalIdFor, snapshot, subdirectories } from '../lib/util';
import type {
  CodingAgentProvider,
  DetectedLogin,
  LoginCommand,
  ProviderEnv,
  ReadOptions,
} from '../types';
import { type GrokAuth, readGrokAuth } from './auth';
import { fetchGrokBilling, GrokHttpError, parseGrokBilling } from './billing';

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
      snapshot: snapshot(
        now,
        'no_credentials',
        `No Grok login found in ${login.home}. Run \`${run} login\` and sign in.`,
      ),
    };
  }
  // Grok Build renews its own 7-day session when it runs; ResetOwl does not.
  if (auth.expiresAt && auth.expiresAt.getTime() <= now.getTime()) {
    return {
      tier: null,
      snapshot: snapshot(
        now,
        'auth_expired',
        `The Grok sign-in has lapsed. Run \`${run}\` once to renew it, or \`${run} login\`.`,
      ),
    };
  }
  try {
    const billing = parseGrokBilling(
      await fetchGrokBilling(auth.accessToken, env.fetch, env.userAgent),
    );
    return {
      tier: billing.tier,
      snapshot: snapshot(
        now,
        'ok',
        billing.windows.length === 0 ? 'Grok reported no usage pool for this account.' : null,
        billing.windows,
      ),
    };
  } catch (err) {
    if (err instanceof GrokHttpError && (err.status === 401 || err.status === 403)) {
      return {
        tier: null,
        snapshot: snapshot(
          now,
          'auth_expired',
          `xAI rejected the Grok login. Run \`${run}\` once to renew it, or \`${run} login\`.`,
        ),
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
    return {
      tier: null,
      snapshot: snapshot(now, 'error', `Could not reach xAI (${errorMessage(err)}).`),
    };
  }
}

async function read(
  login: DetectedLogin,
  env: ProviderEnv,
  opts: ReadOptions,
): Promise<SyncAccount> {
  const auth = await readGrokAuth(login.home).catch(() => null);
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

function loginCommand(home: string): LoginCommand {
  // The device-code flow (RFC 8628): a page and a short code the screens can
  // show, rather than a callback on a localhost port.
  return {
    command: 'grok',
    args: ['login', '--device-auth'],
    env: { GROK_HOME: home },
    linkHosts: ['accounts.x.ai', 'auth.x.ai'],
  };
}

/** Signed in once `auth.json` holds a session that names someone. */
async function signedInAs(home: string): Promise<string | null> {
  const auth = await readGrokAuth(home).catch(() => null);
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
  signedInAs,
  launchEnv,
};
