import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { expandPath, tildify } from "../../env.js";
import type { AccountConfig, AccountSnapshot, Env, Provider } from "../../types.js";
import {
  defaultConfigDir,
  isDefaultConfigDir,
  planLabel,
  readCredentials,
  readIdentity,
} from "./credentials.js";
import { SESSION_WINDOW_MS, scanLocalActivity } from "./local-logs.js";
import { UsageApiError, fetchUsage, parseUsage } from "./usage-api.js";

export function resolveConfigDir(account: Pick<AccountConfig, "configDir">, home: string): string {
  return account.configDir ? expandPath(account.configDir, home) : defaultConfigDir(home);
}

function claudeCommand(configDir: string, home: string): string {
  return isDefaultConfigDir(configDir, home) ? "claude" : `CLAUDE_CONFIG_DIR=${configDir} claude`;
}

async function snapshot(account: AccountConfig, env: Env): Promise<AccountSnapshot> {
  const now = env.now();
  const configDir = resolveConfigDir(account, env.home);
  const [identity, creds] = await Promise.all([
    readIdentity(configDir, env.home),
    readCredentials(configDir, env, account.keychainService),
  ]);

  const snap: AccountSnapshot = {
    accountId: account.id,
    label: account.label,
    provider: "claude-code",
    identity: { ...identity, plan: planLabel(creds) },
    status: "ok",
    limits: [],
    fetchedAt: now.toISOString(),
  };

  if (!creds) {
    snap.status = "no_credentials";
    snap.message = `No Claude Code login found in ${configDir}. Run \`${claudeCommand(configDir, env.home)}\` and log in.`;
  } else if (creds.expiresAt !== undefined && creds.expiresAt <= now.getTime()) {
    snap.status = "auth_expired";
    snap.message = `Login expired. Run \`${claudeCommand(configDir, env.home)}\` once to refresh it.`;
  } else {
    try {
      const parsed = parseUsage(await fetchUsage(creds.accessToken, env.fetch));
      snap.limits = parsed.windows;
      snap.extraUsage = parsed.extraUsage;
    } catch (err) {
      if (err instanceof UsageApiError && err.isAuthError) {
        snap.status = "auth_expired";
        snap.message = `Login rejected. Run \`${claudeCommand(configDir, env.home)}\` once to refresh it.`;
      } else {
        snap.status = "error";
        snap.message = err instanceof Error ? err.message : String(err);
      }
    }
  }

  // Align the local "session" tally with the server's 5h window when we know it.
  const fiveHourReset = snap.limits.find((w) => w.key === "five_hour")?.resetsAt;
  const windowStart = fiveHourReset
    ? new Date(Math.min(new Date(fiveHourReset).getTime() - SESSION_WINDOW_MS, now.getTime()))
    : new Date(now.getTime() - SESSION_WINDOW_MS);
  snap.local = (await scanLocalActivity(configDir, now, windowStart)) ?? undefined;

  return snap;
}

const MARKERS = [".credentials.json", ".claude.json", "projects", "settings.json"];

/** Look for ~/.claude and ~/.claude-* style config dirs (plus $CLAUDE_CONFIG_DIR). */
async function discover(env: Env): Promise<Array<Omit<AccountConfig, "id">>> {
  const candidates = new Set<string>();
  if (process.env.CLAUDE_CONFIG_DIR) candidates.add(expandPath(process.env.CLAUDE_CONFIG_DIR, env.home));
  try {
    for (const ent of await readdir(env.home, { withFileTypes: true })) {
      if (ent.isDirectory() && /^\.claude([-_.].+)?$/.test(ent.name)) candidates.add(join(env.home, ent.name));
    }
  } catch {
    // unreadable home — nothing to discover
  }

  const found: Array<Omit<AccountConfig, "id">> = [];
  for (const dir of [...candidates].sort()) {
    const checks = await Promise.all(MARKERS.map((m) => stat(join(dir, m)).then(() => true, () => false)));
    const hasMarker = checks.some(Boolean);
    // On macOS the default dir keeps its login in the Keychain, so any ~/.claude counts.
    if (!hasMarker && !isDefaultConfigDir(dir, env.home)) continue;
    const identity = await readIdentity(dir, env.home);
    const base = dir.split(/[\\/]/).pop() ?? dir;
    const suffix = base.replace(/^\.claude[-_.]?/, "");
    found.push({
      provider: "claude-code",
      label: identity.email ?? (suffix ? `Claude (${suffix})` : "Claude"),
      configDir: isDefaultConfigDir(dir, env.home) ? undefined : tildify(dir, env.home),
    });
  }
  return found;
}

export const claudeCode: Provider = {
  id: "claude-code",
  displayName: "Claude Code",
  snapshot,
  discover,
};
