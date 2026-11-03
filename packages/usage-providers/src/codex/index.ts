import { join, resolve, sep } from 'node:path';
import type { LimitWindow, SyncAccount, UsageSnapshot } from '@flama/shared/schemas/accounts';
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
import { type CodexAuth, readCodexAuth } from './auth';
import { type SessionRateLimits, scanCodexSessions } from './sessions';
import { CodexHttpError, fetchCodexUsage, parseCodexUsage } from './usage-api';

function expandHome(path: string, home: string): string {
  if (path === '~') return home;
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(home, path.slice(2));
  return resolve(path);
}

/** The home a plain terminal uses: `$CODEX_HOME`, else `~/.codex`. */
export function defaultCodexHome(env: ProviderEnv): string {
  const fromEnv = env.env.CODEX_HOME;
  return fromEnv ? expandHome(fromEnv, env.home) : join(env.home, '.codex');
}

function codexCommand(login: DetectedLogin): string {
  return login.isDefault ? 'codex' : `CODEX_HOME=${login.home} codex`;
}

async function detect(env: ProviderEnv): Promise<DetectedLogin[]> {
  const found: DetectedLogin[] = [];
  const managedDir = resolve(env.managedRoot, 'codex');
  const defaultHome = resolve(defaultCodexHome(env));
  if (
    (await exists(join(defaultHome, 'auth.json'))) ||
    (await isDirectory(join(defaultHome, 'sessions')))
  ) {
    found.push({
      provider: 'codex',
      home: defaultHome,
      isDefault: true,
      managed: defaultHome.startsWith(managedDir + sep),
    });
  }
  for (const dir of await subdirectories(managedDir)) {
    const home = resolve(dir);
    if (home === defaultHome) continue;
    found.push({ provider: 'codex', home, isDefault: false, managed: true });
  }
  return found;
}

/** Limits from the newest session log, for when the server cannot be asked. */
function offlineSnapshot(
  now: Date,
  status: UsageSnapshot['status'],
  reason: string,
  fromLogs: SessionRateLimits | null,
): UsageSnapshot {
  if (!fromLogs) return snapshot(now, status, reason);
  const windows: LimitWindow[] = fromLogs.windows.map((w) =>
    // A window that has reset since the session saw it is empty now.
    w.resetsAt && new Date(w.resetsAt).getTime() <= now.getTime() ? { ...w, utilization: 0 } : w,
  );
  return snapshot(
    now,
    status,
    `${reason} Showing the limits your last Codex session saw at ${fromLogs.observedAt}; they may be stale.`,
    windows,
    null,
    fromLogs.observedAt,
  );
}

async function readLimits(
  login: DetectedLogin,
  auth: CodexAuth | null,
  env: ProviderEnv,
  fromLogs: SessionRateLimits | null,
): Promise<{ snapshot: UsageSnapshot; planType: string | null }> {
  const now = env.now();
  const run = codexCommand(login);
  if (!auth) {
    return {
      planType: null,
      snapshot: snapshot(
        now,
        'no_credentials',
        `No Codex login found in ${login.home}. Run \`${run} login\` and sign in with ChatGPT.`,
      ),
    };
  }
  if (auth.mode === 'api_key' || !auth.accessToken) {
    return {
      planType: null,
      snapshot: snapshot(
        now,
        'no_credentials',
        `This Codex home uses an API key. Only a ChatGPT sign-in has plan limits: run \`${run} login\`.`,
      ),
    };
  }
  try {
    const parsed = parseCodexUsage(
      await fetchCodexUsage(auth.accessToken, auth.accountId, env.fetch, env.userAgent),
      now,
    );
    return {
      planType: parsed.planType,
      snapshot: snapshot(now, 'ok', null, parsed.windows, parsed.extraUsage),
    };
  } catch (err) {
    if (err instanceof CodexHttpError && (err.status === 401 || err.status === 403)) {
      return {
        planType: null,
        snapshot: snapshot(
          now,
          'auth_expired',
          `OpenAI rejected the Codex login. Run \`${run}\` once to refresh it.`,
        ),
      };
    }
    if (err instanceof CodexHttpError && err.status === 429) {
      return {
        planType: fromLogs?.planType ?? null,
        snapshot: offlineSnapshot(
          now,
          'rate_limited',
          'OpenAI is rate limiting usage requests; try again in a few minutes.',
          fromLogs,
        ),
      };
    }
    const reason = `Could not reach OpenAI (${errorMessage(err)}).`;
    return {
      planType: fromLogs?.planType ?? null,
      snapshot: offlineSnapshot(now, fromLogs ? 'ok' : 'error', reason, fromLogs),
    };
  }
}

async function read(
  login: DetectedLogin,
  env: ProviderEnv,
  opts: ReadOptions,
): Promise<SyncAccount> {
  const [auth, sessions] = await Promise.all([
    readCodexAuth(login.home).catch(() => null),
    scanCodexSessions(login.home, opts.sinceDay).catch(() => ({
      dailyTokens: [],
      rateLimits: null,
    })),
  ]);
  let plan = auth?.planType ?? null;
  let snap: UsageSnapshot | null = null;
  if (opts.fetchLimits) {
    const limits = await readLimits(login, auth, env, sessions.rateLimits).catch(
      (err: unknown) => ({
        planType: null,
        snapshot: snapshot(env.now(), 'error', errorMessage(err)),
      }),
    );
    plan = limits.planType ?? plan;
    snap = limits.snapshot;
  }
  return {
    provider: 'codex',
    externalId: externalIdFor(auth?.accountId ?? null, auth?.email ?? null, login.home),
    email: auth?.email ?? null,
    organization: auth?.organization?.slice(0, 200) ?? null,
    reportedPlan: plan?.slice(0, 80) ?? null,
    location: login.home.slice(0, 300),
    snapshot: snap,
    dailyTokens: sessions.dailyTokens,
  };
}

function loginCommand(home: string): LoginCommand {
  return { command: 'codex', args: ['login'], env: { CODEX_HOME: home } };
}

function launchEnv(login: DetectedLogin): Record<string, string> {
  return login.isDefault ? {} : { CODEX_HOME: login.home };
}

export const codexProvider: CodingAgentProvider = {
  id: 'codex',
  displayName: 'Codex',
  detect,
  read,
  loginCommand,
  launchEnv,
};
