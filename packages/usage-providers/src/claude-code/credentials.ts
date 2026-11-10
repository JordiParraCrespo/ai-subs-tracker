import { readFile, realpath } from 'node:fs/promises';
import { userInfo } from 'node:os';
import { join, resolve } from 'node:path';
import { resolvePlan } from '@flama/shared/subscriptions';
import { isRecord, num, readJson, sha256Hex, str } from '../lib/util';
import type { ProviderEnv } from '../types';

/**
 * The OAuth login Claude Code stores after `claude /login`:
 *
 * - Linux / Windows: `<configDir>/.credentials.json`
 * - macOS: the login Keychain, service `Claude Code-credentials`, with an
 *   8-hex suffix for any config dir other than `~/.claude`, under the
 *   account `$USER` (Claude 2.1+). Read first, as Orca does: Claude Code
 *   refreshes the Keychain item, so a `.credentials.json` left behind in the
 *   folder is older and must not hide it.
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

/** The account Claude Code 2.1+ files its Keychain item under. */
export const KEYCHAIN_FALLBACK_ACCOUNT = 'claude-code-user';
const KEYCHAIN_ACCOUNT_PATTERN = /^[a-zA-Z0-9._-]+$/;

/**
 * The Keychain account Claude Code uses: the login name, or
 * `claude-code-user` for a name it would not use (an SSO email, say).
 */
export function keychainAccount(env: Record<string, string | undefined>): string {
  let user: string | undefined;
  try {
    user = env.USER || env.USERNAME || userInfo().username;
  } catch {
    return KEYCHAIN_FALLBACK_ACCOUNT;
  }
  return user && KEYCHAIN_ACCOUNT_PATTERN.test(user) ? user : KEYCHAIN_FALLBACK_ACCOUNT;
}

/**
 * The Keychain service Claude Code uses for a config dir: the bare name for
 * `~/.claude`, else suffixed with the first 8 hex of sha256 of the dir in
 * Unicode NFC.
 */
export function keychainServiceFor(configDir: string, home: string): string {
  if (isDefaultConfigDir(configDir, home)) return KEYCHAIN_BASE_SERVICE;
  return `${KEYCHAIN_BASE_SERVICE}-${sha256Hex(configDir.normalize('NFC')).slice(0, 8)}`;
}

/**
 * The spellings of a config dir Claude may have hashed into its Keychain
 * item: as given, and through its symlinks. A non-default dir never falls
 * back to the bare service, which is the default login's.
 */
async function keychainServices(configDir: string, home: string): Promise<string[]> {
  if (isDefaultConfigDir(configDir, home)) return [KEYCHAIN_BASE_SERVICE];
  const services = [keychainServiceFor(configDir, home)];
  const canonical = await realpath(configDir).catch(() => null);
  if (canonical && canonical !== configDir) services.push(keychainServiceFor(canonical, home));
  return services;
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

async function readKeychainCredentials(
  configDir: string,
  env: ProviderEnv,
): Promise<ClaudeOAuth | null> {
  const account = keychainAccount(env.env);
  for (const service of await keychainServices(configDir, env.home)) {
    const raw = await env.readKeychain(service, account).catch(() => null);
    const creds = raw ? parseCredentials(raw.trim()) : null;
    if (creds) return creds;
  }
  return null;
}

/** On macOS the Keychain first, then the file; elsewhere the file. */
export async function readCredentials(
  configDir: string,
  env: ProviderEnv,
): Promise<ClaudeOAuth | null> {
  if (env.platform === 'darwin') {
    const fromKeychain = await readKeychainCredentials(configDir, env);
    if (fromKeychain) return fromKeychain;
  }
  const file = await readFile(join(configDir, '.credentials.json'), 'utf8').catch(() => null);
  return file ? parseCredentials(file) : null;
}

/**
 * The plan as Claude Code reports it.
 *
 * A seat in a Team or Enterprise organization is that plan, whatever its
 * `rateLimitTier` says: a Team Premium seat carries a Max-sized tier
 * (`default_claude_max_5x`, sometimes `_20x`), which read alone would call it
 * a personal Max or Ultra subscription with the wrong price and windows. So
 * `subscriptionType` decides for an organization seat, and the tier only says
 * which seat (a Max-sized or premium tier is a Premium seat). For a personal
 * plan, `rateLimitTier` wins when it names a plan the catalog knows
 * (`default_claude_max_20x` is Ultra), else `subscriptionType`.
 */
export function reportedPlan(
  creds: Pick<ClaudeOAuth, 'subscriptionType' | 'rateLimitTier'> | null,
): string | null {
  if (!creds) return null;
  const subscription = creds.subscriptionType?.trim().toLowerCase() ?? null;
  if (subscription === 'team') {
    return isPremiumSeatTier(creds.rateLimitTier) ? 'team_premium' : 'team';
  }
  if (subscription === 'enterprise') return 'enterprise';
  if (creds.rateLimitTier && resolvePlan('claude-code', creds.rateLimitTier)) {
    return creds.rateLimitTier;
  }
  return creds.subscriptionType ?? creds.rateLimitTier;
}

/** Whether an organization seat's tier is a Premium seat: Max-sized, or named premium. */
function isPremiumSeatTier(tier: string | null): boolean {
  if (!tier) return false;
  if (/premium/i.test(tier)) return true;
  const plan = resolvePlan('claude-code', tier);
  return plan?.id === 'claude-max' || plan?.id === 'claude-ultra';
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
