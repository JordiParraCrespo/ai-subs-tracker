import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { PROVIDER_IDS } from '@flama/shared/subscriptions';
import { legacyPointerDir, pointerPath } from './pointers';

/**
 * The app was called Subtrack until November 2026. What an install of that
 * name left on the machine, and how ResetOwl takes it over without breaking it:
 *
 * - **The data folder stays where it is.** Logins added through the app live
 *   in `<appData>/Subtrack/accounts/…`, and Claude Code picks its macOS
 *   Keychain item from the config folder's path, so moving that folder would
 *   sign every added login out. An install that already has `Subtrack` keeps
 *   using it; a new install gets `ResetOwl`.
 * - **The pointers are copied** from `~/.subtrack/active/` to
 *   `~/.resetowl/active/`, content unchanged, and the old ones are kept in
 *   step for as long as that folder exists: terminals opened before the
 *   update and a pasted PowerShell profile still read them.
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
  return join(legacyPointerDir(home), provider);
}

/**
 * Copies each `~/.subtrack/active/<provider>` to the new pointer path. A
 * pointer already at the new path wins (the new app wrote it). The old files
 * stay: terminals opened before the update, and a PowerShell profile with the
 * pasted snippet, still read them, and `writePointer` keeps them in step.
 * Returns the providers whose pointer was copied.
 */
export async function migratePointers(home: string): Promise<string[]> {
  const copied: string[] = [];
  for (const provider of PROVIDER_IDS) {
    let content: string;
    try {
      content = await readFile(legacyPointerPath(home, provider), 'utf8');
    } catch {
      continue;
    }
    const next = pointerPath(home, provider);
    try {
      await readFile(next, 'utf8');
      continue;
    } catch {
      // Not there yet: copy it.
    }
    await mkdir(dirname(next), { recursive: true });
    await writeFile(next, content, { mode: 0o644 });
    copied.push(provider);
  }
  return copied;
}
