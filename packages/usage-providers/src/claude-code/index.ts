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
  defaultConfigDir,
  isDefaultConfigDir,
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
  if (creds.expiresAt !== null && creds.expiresAt <= now.getTime()) {
    return {
      plan,
      snapshot: snapshot(
        now,
        'auth_expired',
        `The Claude Code login expired. Run \`${run}\` once to refresh it.`,
      ),
    };
  }
  try {
    const parsed = parseClaudeUsage(
      await fetchClaudeUsage(creds.accessToken, env.fetch, env.userAgent),
    );
    return { plan, snapshot: snapshot(now, 'ok', null, parsed.windows, parsed.extraUsage) };
  } catch (err) {
    if (err instanceof UsageHttpError) {
      if (err.status === 401 || err.status === 403) {
        return {
          plan,
          snapshot: snapshot(
            now,
            'auth_expired',
            `Anthropic rejected the login. Run \`${run}\` once to refresh it.`,
          ),
        };
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
    email: identity.email,
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

export const claudeCodeProvider: CodingAgentProvider = {
  id: 'claude-code',
  displayName: 'Claude Code',
  detect,
  read,
  loginCommand,
  signedInAs,
  launchEnv,
};
