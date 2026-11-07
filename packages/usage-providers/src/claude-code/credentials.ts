import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { resolvePlan } from '@flama/shared/subscriptions';
import { isRecord, num, readJson, sha256Hex, str } from '../lib/util';
import type { ProviderEnv } from '../types';

/**
 * The OAuth login Claude Code stores after `claude /login`:
 *
 * - Linux / Windows: `<configDir>/.credentials.json`
 * - macOS: the login Keychain, service `Claude Code-credentials`, with an
 *   8-hex suffix for any config dir other than `~/.claude`
 *
 * Read only. The token is never refreshed here: refresh tokens rotate, so a
 * refresh would silently sign Claude Code out. Using Claude Code once
 * refreshes an expired token.
 */
export interface ClaudeOAuth {
  accessToken: string;
  /** Epoch milliseconds. */
  expiresAt: number | null;
  /** Present once the login can be renewed without signing in again. */
  refreshToken: string | null;
  /**
   * Epoch milliseconds the refresh token itself expires (Claude Code 2.1.x
   * stores it beside the refresh token); null when the file does not say, in
   * which case the refresh token is treated as still good.
   */
  refreshTokenExpiresAt: number | null;
  subscriptionType: string | null;
  rateLimitTier: string | null;
}

export interface ClaudeIdentity {
  accountUuid: string | null;
  email: string | null;
  organization: string | null;
}

export const KEYCHAIN_BASE_SERVICE = 'Claude Code-credentials';

export function defaultConfigDir(home: string): string {
  return join(home, '.claude');
}

export function isDefaultConfigDir(configDir: string, home: string): boolean {
  return resolve(configDir) === resolve(defaultConfigDir(home));
}

/**
 * The Keychain service Claude Code uses for a config dir: the bare name for
 * `~/.claude`, else suffixed with the first 8 hex of sha256(configDir).
 */
export function keychainServiceFor(configDir: string, home: string): string {
  if (isDefaultConfigDir(configDir, home)) return KEYCHAIN_BASE_SERVICE;
  return `${KEYCHAIN_BASE_SERVICE}-${sha256Hex(configDir).slice(0, 8)}`;
}

export function parseCredentials(raw: string): ClaudeOAuth | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const oauth = isRecord(data) ? data.claudeAiOauth : null;
  if (!isRecord(oauth)) return null;
  const accessToken = str(oauth.accessToken);
  if (!accessToken) return null;
  return {
    accessToken,
    expiresAt: num(oauth.expiresAt),
    refreshToken: str(oauth.refreshToken),
    refreshTokenExpiresAt: num(oauth.refreshTokenExpiresAt),
    subscriptionType: str(oauth.subscriptionType),
    rateLimitTier: str(oauth.rateLimitTier),
  };
}

/**
 * Whether Claude Code could renew this login itself: it holds a refresh token
 * and that token has not expired. The access token lapsing is normal for an
 * account nobody runs Claude in; what makes the login *renewable* is the
 * refresh token behind it. Revocation cannot be seen from the file — only
 * running the CLI (`claude auth status`) can tell that apart, so a login that
 * looks renewable here may still turn out signed out when the CLI is asked.
 */
export function isRenewable(
  creds: Pick<ClaudeOAuth, 'refreshToken' | 'refreshTokenExpiresAt'>,
  now: Date,
): boolean {
  if (!creds.refreshToken) return false;
  return creds.refreshTokenExpiresAt === null || creds.refreshTokenExpiresAt > now.getTime();
}

export async function readCredentials(
  configDir: string,
  env: ProviderEnv,
): Promise<ClaudeOAuth | null> {
  const file = await readFile(join(configDir, '.credentials.json'), 'utf8').catch(() => null);
  const fromFile = file ? parseCredentials(file) : null;
  if (fromFile) return fromFile;
  if (env.platform !== 'darwin') return null;
  try {
    const raw = await env.readKeychain(keychainServiceFor(configDir, env.home));
    return raw ? parseCredentials(raw.trim()) : null;
  } catch {
    return null;
  }
}

/**
 * The plan as Claude Code reports it: `rateLimitTier` when it names a plan
 * the catalog knows (`default_claude_max_20x`), else `subscriptionType`.
 */
export function reportedPlan(
  creds: Pick<ClaudeOAuth, 'subscriptionType' | 'rateLimitTier'> | null,
): string | null {
  if (!creds) return null;
  if (creds.rateLimitTier && resolvePlan('claude-code', creds.rateLimitTier)) {
    return creds.rateLimitTier;
  }
  return creds.subscriptionType ?? creds.rateLimitTier;
}

/**
 * Who is signed in, from Claude Code's state file: `<configDir>/.claude.json`,
 * or `~/.claude.json` for the default dir.
 */
export async function readIdentity(configDir: string, home: string): Promise<ClaudeIdentity> {
  const candidates = [join(configDir, '.claude.json')];
  if (isDefaultConfigDir(configDir, home)) candidates.push(join(home, '.claude.json'));
  for (const file of candidates) {
    const account = (await readJson(file))?.oauthAccount;
    if (!isRecord(account)) continue;
    return {
      accountUuid: str(account.accountUuid),
      email: str(account.emailAddress),
      organization: str(account.organizationName),
    };
  }
  return { accountUuid: null, email: null, organization: null };
}
