import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LEGACY_BEGIN_MARKER,
  LEGACY_END_MARKER,
  legacyPointerPath,
  migratePointers,
  userDataDir,
} from '../legacy';
import { pointerPath, writePointer } from '../pointers';
import {
  BEGIN_MARKER,
  migrateShellIntegration,
  shellIntegration,
  upsertBlock,
} from '../shell-integration';
import { tempDir } from './helpers';

/**
 * Taking over an install from when the app was called Subtrack. What these
 * protect: a person who updates keeps their added logins signed in, their
 * terminals keep following the active account, and nothing of theirs moves.
 */

describe('the data folder', () => {
  const appData = '/Users/maya/Library/Application Support';
  const exists = (paths: string[]) => (p: string) => paths.includes(p);

  it('stays at Subtrack for an install that has only that folder', () => {
    // Regression: moving it changes the added logins' config paths, which
    // makes Claude Code read another Keychain item and signs them out.
    expect(userDataDir(appData, exists([join(appData, 'Subtrack')]))).toBe(
      join(appData, 'Subtrack'),
    );
  });

  it('is ResetOwl for a new install, and once ResetOwl exists', () => {
    expect(userDataDir(appData, exists([]))).toBe(join(appData, 'ResetOwl'));
    expect(
      userDataDir(appData, exists([join(appData, 'Subtrack'), join(appData, 'ResetOwl')])),
    ).toBe(join(appData, 'ResetOwl'));
  });
});

describe('the active pointers', () => {
  const work = '/Users/maya/Library/Application Support/Subtrack/accounts/claude-code/ab';

  it('are copied to ~/.resetowl with the same content', async () => {
    const home = await tempDir();
    await mkdir(join(home, '.subtrack', 'active'), { recursive: true });
    await writeFile(legacyPointerPath(home, 'claude-code'), work);
    await writeFile(legacyPointerPath(home, 'codex'), '');

    expect((await migratePointers(home)).sort()).toEqual(['claude-code', 'codex']);
    expect(await readFile(pointerPath(home, 'claude-code'), 'utf8')).toBe(work);
    // An empty pointer (the default login) stays empty: never a path.
    expect(await readFile(pointerPath(home, 'codex'), 'utf8')).toBe('');
  });

  it('keep answering old readers: open terminals and a pasted PowerShell profile', async () => {
    // Regression: deleting ~/.subtrack/active made those fall back to the
    // default account, silently, because their functions still read it.
    const home = await tempDir();
    await mkdir(join(home, '.subtrack', 'active'), { recursive: true });
    await writeFile(legacyPointerPath(home, 'claude-code'), work);
    await migratePointers(home);
    expect(await readFile(legacyPointerPath(home, 'claude-code'), 'utf8')).toBe(work);

    // Switching account later reaches the old path too.
    const other = join(home, 'accounts', 'claude-code', 'cd');
    await writePointer(home, { provider: 'claude-code', home: other, isDefault: false });
    expect(await readFile(legacyPointerPath(home, 'claude-code'), 'utf8')).toBe(other);
    await writePointer(home, {
      provider: 'claude-code',
      home: join(home, '.claude'),
      isDefault: true,
    });
    expect(await readFile(legacyPointerPath(home, 'claude-code'), 'utf8')).toBe('');
  });

  it('keep a pointer the new app already wrote', async () => {
    const home = await tempDir();
    await mkdir(join(home, '.subtrack', 'active'), { recursive: true });
    await writeFile(legacyPointerPath(home, 'codex'), '/old');
    await mkdir(join(home, '.resetowl', 'active'), { recursive: true });
    await writeFile(pointerPath(home, 'codex'), '/new');

    expect(await migratePointers(home)).toEqual([]);
    expect(await readFile(pointerPath(home, 'codex'), 'utf8')).toBe('/new');
  });

  it('never create ~/.subtrack on a machine that never had Subtrack', async () => {
    const home = await tempDir();
    expect(await migratePointers(home)).toEqual([]);
    await writePointer(home, { provider: 'codex', home: join(home, 'x'), isDefault: false });
    expect(await readdir(home)).not.toContain('.subtrack');
  });
});

describe('the shell block', () => {
  const oldBlock = [
    LEGACY_BEGIN_MARKER,
    'function claude { cat ~/.subtrack/active/claude-code; }',
    LEGACY_END_MARKER,
  ].join('\n');

  it('replaces the old block in place and keeps everything around it', async () => {
    const home = await tempDir();
    const rc = join(home, '.zshrc');
    await writeFile(rc, `export FOO=1\n\n${oldBlock}\nalias ll="ls -l"\n`);
    const env = { home, platform: 'darwin' as const, shell: '/bin/zsh' };

    expect(await migrateShellIntegration(env)).toBe(true);
    const after = await readFile(rc, 'utf8');
    expect(after.startsWith('export FOO=1\n\n# >>> resetowl >>>')).toBe(true);
    expect(after.endsWith('# <<< resetowl <<<\nalias ll="ls -l"\n')).toBe(true);
    expect(after).not.toContain('subtrack');
    expect(after).toContain(pointerPath(home, 'claude-code'));
  });

  it('never installs one the person did not have', async () => {
    // Regression: the migration must not turn the opt-in into a default.
    const home = await tempDir();
    const rc = join(home, '.zshrc');
    await writeFile(rc, 'export FOO=1\n');
    expect(await migrateShellIntegration({ home, platform: 'darwin', shell: '/bin/zsh' })).toBe(
      false,
    );
    expect(await readFile(rc, 'utf8')).toBe('export FOO=1\n');
  });

  it('brings an older ResetOwl block up to the current snippet, and leaves a current one alone', async () => {
    // Regression: a block installed before `grok` was added counted as
    // installed, so terminals never got the function and Settings offered no
    // way to add it.
    const home = await tempDir();
    const rc = join(home, '.bashrc');
    const env = { home, platform: 'linux' as const, shell: '/bin/bash' };
    const older = `${BEGIN_MARKER}\nfunction claude { command claude "$@"; }\n# <<< resetowl <<<`;
    await writeFile(rc, `export FOO=1\n${older}\nalias ll="ls -l"\n`);
    expect(await migrateShellIntegration(env)).toBe(true);
    const after = await readFile(rc, 'utf8');
    expect(after).toContain('function grok {');
    expect(after.startsWith('export FOO=1\n# >>> resetowl >>>')).toBe(true);
    expect(after.endsWith('# <<< resetowl <<<\nalias ll="ls -l"\n')).toBe(true);
    expect(await migrateShellIntegration(env)).toBe(false);
    expect(await readFile(rc, 'utf8')).toBe(after);
  });

  it('counts the old block as installed until it is rewritten', async () => {
    const home = await tempDir();
    await writeFile(join(home, '.bashrc'), `${oldBlock}\n`);
    const status = await shellIntegration({ home, platform: 'linux', shell: '/bin/bash' });
    expect(status.installed).toBe(true);
    expect(upsertBlock(`${oldBlock}\n`, `${BEGIN_MARKER}\nnew\n# <<< resetowl <<<`)).toBe(
      `${BEGIN_MARKER}\nnew\n# <<< resetowl <<<\n`,
    );
  });
});
