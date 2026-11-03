import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { ProviderId } from '@flama/shared/subscriptions';

/**
 * Which login a terminal uses, per provider: `~/.resetowl/active/<provider>`
 * holds the absolute home of the active login, or nothing at all when the
 * default login is active. The default is never written as a path: setting
 * `CLAUDE_CONFIG_DIR` even to `~/.claude` changes the macOS Keychain item
 * Claude Code reads, which would sign the person out of their own terminal.
 * The shell integration (`shell-integration.ts`) reads these files.
 */

export interface PointerLogin {
  provider: ProviderId;
  home: string;
  isDefault: boolean;
}

export function pointerDir(home: string): string {
  return join(home, '.resetowl', 'active');
}

export function pointerPath(home: string, provider: ProviderId): string {
  return join(pointerDir(home), provider);
}

/**
 * Where a Subtrack install kept the pointers. Shell functions already loaded
 * in an open terminal, and a PowerShell profile someone pasted the snippet
 * into, still read here; `writePointer` keeps it in step while it exists.
 */
export function legacyPointerDir(home: string): string {
  return join(home, '.subtrack', 'active');
}

/** What the pointer file holds for this login: '' for the default. */
export function pointerContent(login: PointerLogin): string {
  return login.isDefault ? '' : resolve(login.home);
}

/** The home the pointer names; '' (the default) when the file is missing or empty. */
export async function readPointer(home: string, provider: ProviderId): Promise<string> {
  try {
    return (await readFile(pointerPath(home, provider), 'utf8')).trim();
  } catch {
    return '';
  }
}

/** Writes the pointer for `login`; returns true when the file changed. */
export async function writePointer(home: string, login: PointerLogin): Promise<boolean> {
  const path = pointerPath(home, login.provider);
  const next = pointerContent(login);
  let current: string | null = null;
  try {
    current = (await readFile(path, 'utf8')).trim();
  } catch {
    current = null;
  }
  await mirrorLegacy(home, login.provider, next);
  if (current === next) return false;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, next, { mode: 0o644 });
  return true;
}

/** Writes `content` to the Subtrack-era pointer too, only when that folder still exists. */
async function mirrorLegacy(home: string, provider: ProviderId, content: string): Promise<void> {
  const dir = legacyPointerDir(home);
  try {
    if (!(await stat(dir)).isDirectory()) return;
  } catch {
    return;
  }
  const path = join(dir, provider);
  let current: string | null = null;
  try {
    current = (await readFile(path, 'utf8')).trim();
  } catch {
    current = null;
  }
  if (current !== content) await writeFile(path, content, { mode: 0o644 });
}

/** True when terminals use this login, given the pointer's content. */
export function isActiveLogin(login: PointerLogin, pointer: string): boolean {
  if (pointer === '') return login.isDefault;
  return resolve(pointer) === resolve(login.home);
}

export interface ServerActiveFlag {
  provider: ProviderId;
  externalId: string;
  isActive: boolean;
}

/**
 * The login each provider's pointer should name after a sync: the local login
 * of the account the server marks active. Providers whose active account is
 * not on this machine are left out (their pointer is left alone).
 */
export function pointerTargets<L extends PointerLogin & { externalId: string }>(
  server: readonly ServerActiveFlag[],
  local: readonly L[],
): L[] {
  const out: L[] = [];
  for (const account of server) {
    if (!account.isActive) continue;
    const login = local.find(
      (l) => l.provider === account.provider && l.externalId === account.externalId,
    );
    if (login && !out.some((l) => l.provider === login.provider)) out.push(login);
  }
  return out;
}
