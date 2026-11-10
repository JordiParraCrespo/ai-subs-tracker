import { join, resolve, sep } from 'node:path';
import type {
  LimitWindow,
  ReportedRenewal,
  SyncAccount,
  UsageSnapshot,
} from '@flama/shared/schemas/accounts';
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
  LoginOptions,
  ProviderEnv,
  ReadOptions,
} from '../types';
import { CODEX_SIGNED_OUT_MESSAGE, readCodexRateLimitsViaRpc } from './app-server';
import { type CodexAuth, readCodexAuth, readCodexAuthWithGrace } from './auth';
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

/** A Codex home holds a login or the sessions of one; an empty folder is neither. */
async function hasCodexData(home: string): Promise<boolean> {
  return (await exists(join(home, 'auth.json'))) || (await isDirectory(join(home, 'sessions')));
}

async function detect(env: ProviderEnv): Promise<DetectedLogin[]> {
  const found: DetectedLogin[] = [];
  const managedDir = resolve(env.managedRoot, 'codex');
  const defaultHome = resolve(defaultCodexHome(env));
  if (await hasCodexData(defaultHome)) {
    found.push({
      provider: 'codex',
      home: defaultHome,
      isDefault: true,
      managed: defaultHome.startsWith(managedDir + sep),
    });
  }
  for (const dir of await subdirectories(managedDir)) {
    const home = resolve(dir);
    // A folder a sign-in left behind without a login is not an account.
    if (home === defaultHome || !(await hasCodexData(home))) continue;
    found.push({ provider: 'codex', home, isDefault: false, managed: true });
  }
  return found;
}

/**
 * The day the plan bills, from the end of the paid period in the login's
 * token, in this machine's local time. Only the day: the token is reissued
 * when Codex refreshes, so the date itself may be a period or more behind.
 */
export function reportedRenewal(auth: CodexAuth | null): ReportedRenewal | null {
  const until = auth?.subscriptionActiveUntil;
  if (!until) return null;
  return {
    day: until.getDate(),
    checkedAt: auth.subscriptionLastChecked?.toISOString() ?? null,
  };
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

/** What wham/usage gave, or why it did not. */
type BackendRead =
  | {
      ok: true;
      planType: string | null;
      windows: LimitWindow[];
      extraUsage: UsageSnapshot['extraUsage'];
    }
  | { ok: false; status: number | null; message: string };

async function readBackend(auth: CodexAuth, env: ProviderEnv): Promise<BackendRead> {
  if (!auth.accessToken) return { ok: false, status: null, message: 'No ChatGPT token.' };
  try {
    const parsed = parseCodexUsage(
      await fetchCodexUsage(auth.accessToken, auth.accountId, env.fetch),
      env.now(),
    );
    return { ok: true, ...parsed };
  } catch (err) {
    return {
      ok: false,
      status: err instanceof CodexHttpError ? err.status : null,
      message: errorMessage(err),
    };
  }
}

/**
 * The plan's limits, read as Orca reads them. Codex's own CLI is asked first
 * (`codex app-server`, `account/rateLimits/read`), which also renews a lapsed
 * login: the CLI refreshes its own token to answer. wham/usage fills in a
 * session window the CLI left out, and stands in when the CLI cannot run or
 * failed. Only the CLI's own words make a login signed out; an HTTP 401 or
 * 403 from wham/usage never does.
 */
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
        `Codex not signed in. Run \`${run} login\` and sign in with ChatGPT.`,
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

  const rpc = await readCodexRateLimitsViaRpc(login.home, env);
  if (rpc.kind === 'ok') {
    let { windows, planType } = rpc;
    if (!windows.some((w) => w.kind === 'session') && windows.some((w) => w.kind === 'weekly')) {
      const backend = await readBackend(auth, env);
      if (backend.ok && backend.windows.some((w) => w.kind === 'session')) {
        windows = backend.windows;
        planType = backend.planType ?? planType;
      }
    }
    return { planType, snapshot: snapshot(now, 'ok', null, windows, rpc.extraUsage) };
  }
  if (rpc.kind === 'signed_out') {
    return { planType: null, snapshot: snapshot(now, 'auth_expired', CODEX_SIGNED_OUT_MESSAGE) };
  }

  // The CLI could not answer: wham/usage stands in, with the token as it is.
  const backend = await readBackend(auth, env);
  if (backend.ok) {
    return {
      planType: backend.planType,
      snapshot: snapshot(now, 'ok', null, backend.windows, backend.extraUsage),
    };
  }
  if (backend.status === 429) {
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
  const reason =
    rpc.kind === 'unavailable'
      ? `Could not read Codex usage (${rpc.message} wham/usage: ${backend.message}).`
      : `Could not read Codex usage (${rpc.message})`;
  return {
    planType: fromLogs?.planType ?? null,
    snapshot: offlineSnapshot(now, fromLogs ? 'ok' : 'error', reason, fromLogs),
  };
}

async function read(
  login: DetectedLogin,
  env: ProviderEnv,
  opts: ReadOptions,
): Promise<SyncAccount> {
  const [auth, sessions] = await Promise.all([
    readCodexAuthWithGrace(login.home),
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
    reportedRenewal: reportedRenewal(auth),
  };
}

/**
 * `codex login` signs in through the browser on this computer by default (its
 * callback is on localhost), as Orca runs it; the device-code flow, a page
 * and a one-time code, is for finishing the sign-in on another device.
 */
function loginCommand(home: string, opts: LoginOptions = {}): LoginCommand {
  return {
    command: 'codex',
    args: opts.deviceCode ? ['login', '--device-auth'] : ['login'],
    env: { CODEX_HOME: home },
    linkHosts: ['auth.openai.com'],
  };
}

/** Signed in once `auth.json` names an account or an email. */
async function signedInAs(home: string): Promise<string | null> {
  const auth = await readCodexAuth(home).catch(() => null);
  if (!auth?.accountId && !auth?.email) return null;
  return externalIdFor(auth.accountId, auth.email, home);
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
  supportsDeviceCode: true,
  signedInAs,
  launchEnv,
};
