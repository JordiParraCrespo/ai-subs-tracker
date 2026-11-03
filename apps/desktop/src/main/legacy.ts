import { mkdir, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { PROVIDER_IDS } from '@flama/shared/subscriptions';
import { pointerPath } from './pointers';

/**
 * The app was called Subtrack until November 2026. What an install of that
 * name left on the machine, and how ResetOwl takes it over without breaking it:
 *
 * - **The data folder stays where it is.** Logins added through the app live
 *   in `<appData>/Subtrack/accounts/…`, and Claude Code picks its macOS
 *   Keychain item from the config folder's path, so moving that folder would
 *   sign every added login out. An install that already has `Subtrack` keeps
 *   using it; a new install gets `ResetOwl`.
 * - **The pointers move** from `~/.subtrack/active/` to `~/.resetowl/active/`.
 *   Their content (the absolute home of the active login) does not change.
 * - **The shell block is rewritten in place** when the rc file still has the
 *   old one: it is ours, the person opted into it, and only the text between
 *   its markers changes (`upsertBlock` in `shell-integration.ts`).
 *
 * Only the encrypted session needs the person: `safeStorage` keys it by the
 * app's name, so they sign in once after the rename.
 */

export const LEGACY_APP_NAME = 'Subtrack';
export const APP_NAME = 'ResetOwl';
export const LEGACY_BEGIN_MARKER = '# >>> subtrack >>>';
export const LEGACY_END_MARKER = '# <<< subtrack <<<';

/** `<appData>/Subtrack` when only it exists, otherwise `<appData>/ResetOwl`. */
export function userDataDir(appData: string, exists: (path: string) => boolean): string {
  const current = join(appData, APP_NAME);
  const legacy = join(appData, LEGACY_APP_NAME);
  return !exists(current) && exists(legacy) ? legacy : current;
}

export function legacyPointerPath(home: string, provider: string): string {
  return join(home, '.subtrack', 'active', provider);
}

/**
 * Moves each `~/.subtrack/active/<provider>` to the new pointer path. A
 * pointer already at the new path wins (the new app wrote it), and the old
 * one is dropped. Returns the providers whose pointer was moved.
 */
export async function migratePointers(home: string): Promise<string[]> {
  const moved: string[] = [];
  for (const provider of PROVIDER_IDS) {
    const old = legacyPointerPath(home, provider);
    let content: string;
    try {
      content = await readFile(old, 'utf8');
    } catch {
      continue;
    }
    const next = pointerPath(home, provider);
    let present = true;
    try {
      await readFile(next, 'utf8');
    } catch {
      present = false;
    }
    if (!present) {
      await mkdir(dirname(next), { recursive: true });
      await writeFile(next, content, { mode: 0o644 });
      moved.push(provider);
    }
    await rm(old, { force: true });
  }
  // Only empty directories go: anything else in them is not ours to remove.
  for (const dir of [join(home, '.subtrack', 'active'), join(home, '.subtrack')]) {
    await rmdir(dir).catch(() => undefined);
  }
  return moved;
}
