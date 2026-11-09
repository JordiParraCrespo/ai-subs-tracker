import { join, resolve, sep } from 'node:path';
import type { SyncAccount, UsageSnapshot } from '@flama/shared/schemas/accounts';
import {
  errorMessage,
  exists,
  externalIdFor,
  isDirectory,
  snapshot,
  subdirectories,
} from '../lib/util';
import type {
  CodingAgentProvider,
  DetectedLogin,
  LoginCommand,
  ProviderEnv,
  ReadOptions,
} from '../types';
import {
  type ClaudeOAuth,
  defaultConfigDir,
  isDefaultConfigDir,
  isRenewable,
  readCredentials,
  readIdentity,
  reportedPlan,
} from './credentials';
import { scanClaudeTokens } from './local-logs';
import { fetchClaudeUsage, parseClaudeUsage, UsageHttpError } from './usage-api';

/** Files or folders that show a directory is a Claude Code config dir. */
const MARKERS = ['.credentials.json', '.claude.json', 'projects', 'settings.json'];

function expandHome(path: string, home: string): string {
  if (path === '~') return home;
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(home, path.slice(2));
  return resolve(path);
}

async function hasMarker(dir: string): Promise<boolean> {
  const checks = await Promise.all(MARKERS.map((marker) => exists(join(dir, marker))));
  return checks.some(Boolean);
}

function claudeCommand(login: DetectedLogin): string {
  return login.isDefault ? 'claude' : `CLAUDE_CONFIG_DIR=${login.home} claude`;
}

async function detect(env: ProviderEnv): Promise<DetectedLogin[]> {
  const found = new Map<string, DetectedLogin>();
  const managedDir = resolve(env.managedRoot, 'claude-code');
  const add = (dir: string, managed: boolean) => {
    const home = resolve(dir);
    if (found.has(home)) return;
    found.set(home, {
      provider: 'claude-code',
      home,
      isDefault: isDefaultConfigDir(home, env.home),
      managed,
    });
  };

  // ~/.claude: on macOS its login is in the Keychain, so the dir (or ~/.claude.json) is enough.
  const defaultDir = defaultConfigDir(env.home);
  if ((await isDirectory(defaultDir)) || (await exists(join(env.home, '.claude.json')))) {
    add(defaultDir, false);
  }

  const fromEnv = env.env.CLAUDE_CONFIG_DIR;
  if (fromEnv) {
    const dir = expandHome(fromEnv, env.home);
    if (await isDirectory(dir)) add(dir, dir.startsWith(managedDir + sep));
  }

  for (const dir of await subdirectories(env.home)) {
    const name = dir.slice(env.home.length + 1);
    if (!/^\.claude[-_.].+$/.test(name)) continue;
    if (await hasMarker(dir)) add(dir, false);
  }

  for (const dir of await subdirectories(managedDir)) add(dir, true);

  return [...found.values()];
}

/**
 * The login's access token lapsed, or Anthropic rejected it. Whether that is
 * "signed out" or "just stale" is not this read's to decide from the token
 * alone: a refresh token that has not itself expired means the vendor's own
 * CLI can renew the login, so the desktop collector runs it and reads again.
 * Only a login that cannot be renewed is `auth_expired` ("sign in again"); a
 * renewable one is `auth_stale`, and the last good reading stays on screen.
 */
function lapsedSnapshot(now: Date, creds: ClaudeOAuth, run: string): UsageSnapshot {
  if (isRenewable(creds, now)) {
    return snapshot(
      now,
      'auth_stale',
      "Claude Code's access token has expired; it refreshes the next time Claude runs.",
    );
  }
  return snapshot(now, 'auth_expired', `The Claude Code login expired. Run \`${run}\` to sign in.`);
}

async function readLimits(
  login: DetectedLogin,
  env: ProviderEnv,
): Promise<{ snapshot: UsageSnapshot; plan: string | null }> {
  const now = env.now();
  const creds = await readCredentials(login.home, env);
  const plan = reportedPlan(creds);
  const run = claudeCommand(login);
  if (!creds) {
    return {
      plan,
      snapshot: snapshot(
        now,
        'no_credentials',
        `No Claude Code login found in ${login.home}. Run \`${run}\` and sign in.`,
      ),
    };
  }
  // A lapsed access token is not asked about: the request would only be
  // rejected. The stored refresh token decides stale-vs-signed-out, and the
  // collector renews a renewable one through the CLI before the next read.
  if (creds.expiresAt !== null && creds.expiresAt <= now.getTime()) {
    return { plan, snapshot: lapsedSnapshot(now, creds, run) };
  }
  try {
    const parsed = parseClaudeUsage(
      await fetchClaudeUsage(creds.accessToken, env.fetch, env.userAgent),
    );
    return { plan, snapshot: snapshot(now, 'ok', null, parsed.windows, parsed.extraUsage) };
  } catch (err) {
    if (err instanceof UsageHttpError) {
      if (err.status === 401 || err.status === 403) {
        return { plan, snapshot: lapsedSnapshot(now, creds, run) };
      }
      if (err.status === 429) {
        return {
          plan,
          snapshot: snapshot(
            now,
            'rate_limited',
            'Anthropic is rate limiting usage requests; try again in a few minutes.',
          ),
        };
      }
    }
    return {
      plan,
      snapshot: snapshot(now, 'error', `Could not read Claude limits: ${errorMessage(err)}`),
    };
  }
}

async function read(
  login: DetectedLogin,
  env: ProviderEnv,
  opts: ReadOptions,
): Promise<SyncAccount> {
  const identity = await readIdentity(login.home, env.home).catch(() => ({
    accountUuid: null,
    email: null,
    organization: null,
  }));
  const [limits, dailyTokens] = await Promise.all([
    opts.fetchLimits
      ? readLimits(login, env).catch((err: unknown) => ({
          plan: null,
          snapshot: snapshot(env.now(), 'error', errorMessage(err)),
        }))
      : readCredentials(login.home, env)
          .catch(() => null)
          .then((creds) => ({ plan: reportedPlan(creds), snapshot: null })),
    scanClaudeTokens(login.home, opts.sinceDay).catch(() => []),
  ]);
  return {
    provider: 'claude-code',
    externalId: externalIdFor(identity.accountUuid, identity.email, login.home),
    email: identity.email?.slice(0, 320) ?? null,
    organization: identity.organization?.slice(0, 200) ?? null,
    reportedPlan: limits.plan?.slice(0, 80) ?? null,
    location: login.home.slice(0, 300),
    snapshot: limits.snapshot,
    dailyTokens,
  };
}

function loginCommand(home: string): LoginCommand {
  return {
    command: 'claude',
    args: ['auth', 'login', '--claudeai'],
    env: { CLAUDE_CONFIG_DIR: home },
    // The link it prints ends in a code to paste; the one it gives `$BROWSER`
    // calls back to localhost and finishes in a private window by itself.
    capturesBrowser: true,
  };
}

/** Signed in once `.claude.json` names an account with an email. */
async function signedInAs(home: string): Promise<string | null> {
  // `home` is a folder of ResetOwl's own, never `~/.claude`: passing it as
  // the user's home too keeps `~/.claude.json` out of the candidates.
  const identity = await readIdentity(home, home).catch(() => null);
  if (!identity?.email) return null;
  return externalIdFor(identity.accountUuid, identity.email, home);
}

/**
 * `{}` for the default login: setting CLAUDE_CONFIG_DIR even to `~/.claude`
 * would change the Keychain item Claude Code reads on macOS.
 */
function launchEnv(login: DetectedLogin): Record<string, string> {
  return login.isDefault ? {} : { CLAUDE_CONFIG_DIR: login.home };
}

/**
 * The command the desktop collector runs to let Claude Code renew a lapsed
 * login of its own: `claude auth status` reports the login as JSON and, as a
 * side effect, refreshes the short-lived access token and rewrites the
 * credential file — no prompt, no model call, no usage spent. ResetOwl itself
 * still never calls `oauth/token` and never writes a credential; Claude Code
 * does. The env is `launchEnv`, so the default `~/.claude` is run with no
 * `CLAUDE_CONFIG_DIR` (which would change the macOS Keychain item it reads).
 */
function refreshCommand(login: DetectedLogin): LoginCommand {
  return {
    command: loginCommand(login.home).command,
    args: ['auth', 'status'],
    env: launchEnv(login),
  };
}

export const claudeCodeProvider: CodingAgentProvider = {
  id: 'claude-code',
  displayName: 'Claude Code',
  detect,
  read,
  loginCommand,
  signedInAs,
  launchEnv,
  refreshCommand,
};
