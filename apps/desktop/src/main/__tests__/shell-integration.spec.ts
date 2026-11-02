import { execFileSync } from 'node:child_process';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pointerPath, writePointer } from '../pointers';
import {
  BEGIN_MARKER,
  END_MARKER,
  installShellIntegration,
  posixSnippet,
  rcFileFor,
  shellIntegration,
  upsertBlock,
} from '../shell-integration';
import { tempDir } from './helpers';

describe('shell snippet', () => {
  it('defines claude and codex that read the pointer and set the env only when it names a home', () => {
    const snippet = posixSnippet('/Users/maya');
    expect(snippet.startsWith(BEGIN_MARKER)).toBe(true);
    expect(snippet.endsWith(END_MARKER)).toBe(true);
    expect(snippet).toContain(`'${pointerPath('/Users/maya', 'claude-code')}'`);
    expect(snippet).toContain('CLAUDE_CONFIG_DIR="$_subtrack_home" command claude "$@"');
    expect(snippet).toContain('CODEX_HOME="$_subtrack_home" command codex "$@"');
    expect(snippet).toContain('    command claude "$@"');
  });

  it('runs: an empty pointer leaves CLAUDE_CONFIG_DIR unset, a path sets it', async () => {
    const home = await tempDir();
    const bin = join(home, 'bin');
    await mkdir(bin);
    // A fake `claude` that prints what it was given.
    await writeFile(
      join(bin, 'claude'),
      // biome-ignore lint/suspicious/noTemplateCurlyInString: shell expansion, not a template
      '#!/bin/sh\necho "dir=${CLAUDE_CONFIG_DIR:-unset} args=$*"\n',
    );
    await chmod(join(bin, 'claude'), 0o755);
    const run = () =>
      execFileSync('bash', ['-c', `${posixSnippet(home)}\nclaude --version`], {
        env: { PATH: `${bin}:/usr/bin:/bin`, HOME: home },
        encoding: 'utf8',
      }).trim();

    expect(run()).toBe('dir=unset args=--version');
    await writePointer(home, {
      provider: 'claude-code',
      home: join(home, '.claude'),
      isDefault: true,
    });
    expect(run()).toBe('dir=unset args=--version');
    await writePointer(home, { provider: 'claude-code', home: '/srv/work', isDefault: false });
    expect(run()).toBe('dir=/srv/work args=--version');
  });

  it('chooses the rc file from $SHELL', () => {
    expect(rcFileFor('/h', '/bin/zsh', 'darwin')).toBe('/h/.zshrc');
    expect(rcFileFor('/h', '/bin/zsh', 'darwin', '/h/.config/zsh')).toBe('/h/.config/zsh/.zshrc');
    expect(rcFileFor('/h', '/usr/bin/bash', 'linux')).toBe('/h/.bashrc');
    expect(rcFileFor('/h', '/usr/bin/fish', 'linux')).toBeNull();
    expect(rcFileFor('C:\\Users\\m', undefined, 'win32')).toBeNull();
  });
});

describe('rc install', () => {
  it('appends once and replaces the block on a second install (idempotent)', async () => {
    const home = await tempDir();
    const rc = join(home, '.zshrc');
    await writeFile(rc, 'export FOO=1\nalias ll="ls -l"');
    const env = { home, platform: 'linux' as const, shell: '/bin/zsh' };

    expect((await shellIntegration(env)).installed).toBe(false);
    const first = await installShellIntegration(env);
    expect(first).toMatchObject({ rcFile: rc, installed: true });
    const once = await readFile(rc, 'utf8');
    expect(once.startsWith('export FOO=1\nalias ll="ls -l"\n\n# >>> subtrack >>>')).toBe(true);

    await installShellIntegration(env);
    expect(await readFile(rc, 'utf8')).toBe(once);
    expect(once.split(BEGIN_MARKER)).toHaveLength(2);
  });

  it('replaces an older block in place and keeps what is around it', () => {
    const old = `a\n${BEGIN_MARKER}\nold body\n${END_MARKER}\nb\n`;
    expect(upsertBlock(old, `${BEGIN_MARKER}\nnew\n${END_MARKER}`)).toBe(
      `a\n${BEGIN_MARKER}\nnew\n${END_MARKER}\nb\n`,
    );
  });

  it('creates the rc file when it does not exist, and never writes without an rc file', async () => {
    const home = await tempDir();
    await installShellIntegration({ home, platform: 'linux', shell: '/bin/bash' });
    expect(await readFile(join(home, '.bashrc'), 'utf8')).toContain(BEGIN_MARKER);
    const win = await installShellIntegration({ home, platform: 'win32', shell: undefined });
    expect(win).toMatchObject({ rcFile: null, installed: false });
    expect(win.snippet).toContain('function claude');
  });
});
