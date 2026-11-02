import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { AccountIdentity, Env } from "../../types.js";

/**
 * The OAuth login Claude Code stores after `claude /login`.
 *
 * - Linux / Windows: `<configDir>/.credentials.json`
 * - macOS: the login Keychain, service "Claude Code-credentials"
 *   (with a per-config-dir suffix when CLAUDE_CONFIG_DIR is set)
 *
 * We only ever READ this. We deliberately never refresh the token ourselves:
 * refresh tokens rotate, so refreshing here would silently log Claude Code
 * out. When the access token expires, using Claude Code once refreshes it.
 */
export interface ClaudeOAuth {
  accessToken: string;
  /** Epoch milliseconds. */
  expiresAt?: number;
  subscriptionType?: string;
  rateLimitTier?: string;
}

export const KEYCHAIN_BASE_SERVICE = "Claude Code-credentials";

export function defaultConfigDir(home: string): string {
  return join(home, ".claude");
}

export function isDefaultConfigDir(configDir: string, home: string): boolean {
  return resolve(configDir) === resolve(defaultConfigDir(home));
}

/**
 * Keychain service name Claude Code uses for a config dir. The default dir
 * uses the bare name; a custom CLAUDE_CONFIG_DIR gets an 8-hex-char suffix
 * derived from the dir path so several logins can coexist.
 */
export function keychainServiceFor(configDir: string, home: string): string {
  if (isDefaultConfigDir(configDir, home)) return KEYCHAIN_BASE_SERVICE;
  const suffix = createHash("sha256").update(configDir).digest("hex").slice(0, 8);
  return `${KEYCHAIN_BASE_SERVICE}-${suffix}`;
}

export function parseCredentials(raw: string): ClaudeOAuth | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const oauth = (data as { claudeAiOauth?: Record<string, unknown> } | null)?.claudeAiOauth;
  if (!oauth || typeof oauth.accessToken !== "string" || oauth.accessToken === "") return null;
  return {
    accessToken: oauth.accessToken,
    expiresAt: typeof oauth.expiresAt === "number" ? oauth.expiresAt : undefined,
    subscriptionType: typeof oauth.subscriptionType === "string" ? oauth.subscriptionType : undefined,
    rateLimitTier: typeof oauth.rateLimitTier === "string" ? oauth.rateLimitTier : undefined,
  };
}

export async function readCredentials(
  configDir: string,
  env: Env,
  keychainService?: string,
): Promise<ClaudeOAuth | null> {
  try {
    const fromFile = parseCredentials(await readFile(join(configDir, ".credentials.json"), "utf8"));
    if (fromFile) return fromFile;
  } catch {
    // fall through to the Keychain
  }

  if (env.platform === "darwin") {
    const service = keychainService ?? keychainServiceFor(configDir, env.home);
    const out = await env.exec("security", ["find-generic-password", "-s", service, "-w"]);
    if (out) return parseCredentials(out.trim());
  }
  return null;
}

/** Turn subscriptionType/rateLimitTier into something readable, e.g. "Max 20x". */
export function planLabel(creds: Pick<ClaudeOAuth, "subscriptionType" | "rateLimitTier"> | null): string | undefined {
  if (!creds) return undefined;
  const tier = creds.rateLimitTier?.toLowerCase() ?? "";
  const multiplier = /max_(\d+)x/.exec(tier)?.[1];
  const sub = creds.subscriptionType?.toLowerCase();
  if (sub === "max" || tier.includes("max")) return multiplier ? `Max ${multiplier}x` : "Max";
  if (!sub) return undefined;
  return sub.charAt(0).toUpperCase() + sub.slice(1);
}

/**
 * Email / org of the logged-in account, from Claude Code's state file. For a
 * custom config dir it lives inside the dir; for the default it's ~/.claude.json.
 */
export async function readIdentity(configDir: string, home: string): Promise<AccountIdentity> {
  const candidates = [join(configDir, ".claude.json")];
  if (isDefaultConfigDir(configDir, home)) candidates.push(join(home, ".claude.json"));

  for (const file of candidates) {
    try {
      const data = JSON.parse(await readFile(file, "utf8")) as {
        oauthAccount?: { emailAddress?: unknown; organizationName?: unknown };
      };
      const acct = data.oauthAccount;
      if (!acct) continue;
      return {
        email: typeof acct.emailAddress === "string" ? acct.emailAddress : undefined,
        organization: typeof acct.organizationName === "string" ? acct.organizationName : undefined,
      };
    } catch {
      // missing or unreadable — try the next candidate
    }
  }
  return {};
}
