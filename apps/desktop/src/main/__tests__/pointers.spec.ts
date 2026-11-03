import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isActiveLogin, pointerPath, pointerTargets, readPointer, writePointer } from '../pointers';
import { tempDir } from './helpers';

describe('active pointers', () => {
  it('writes an EMPTY file for the default login, never its path', async () => {
    // Regression: writing ~/.claude would set CLAUDE_CONFIG_DIR and switch the macOS Keychain item.
    const home = await tempDir();
    await writePointer(home, {
      provider: 'claude-code',
      home: join(home, '.claude'),
      isDefault: true,
    });
    expect(await readFile(pointerPath(home, 'claude-code'), 'utf8')).toBe('');
  });

  it('writes the absolute home of a non-default login', async () => {
    const home = await tempDir();
    const other = join(home, '.claude-work');
    await writePointer(home, { provider: 'claude-code', home: other, isDefault: false });
    expect(await readFile(join(home, '.resetowl', 'active', 'claude-code'), 'utf8')).toBe(other);
    expect(await readPointer(home, 'claude-code')).toBe(other);
  });

  it('reports whether the file changed, so an unchanged pointer is not rewritten', async () => {
    const home = await tempDir();
    const login = { provider: 'codex' as const, home: join(home, 'x'), isDefault: false };
    expect(await writePointer(home, login)).toBe(true);
    expect(await writePointer(home, login)).toBe(false);
  });

  it('treats a missing or empty pointer as the default login being active', async () => {
    const home = await tempDir();
    expect(await readPointer(home, 'codex')).toBe('');
    expect(isActiveLogin({ provider: 'codex', home: '/h/.codex', isDefault: true }, '')).toBe(true);
    expect(isActiveLogin({ provider: 'codex', home: '/h/other', isDefault: false }, '')).toBe(
      false,
    );
    expect(
      isActiveLogin({ provider: 'codex', home: '/h/other', isDefault: false }, '/h/other'),
    ).toBe(true);
  });

  it('picks the local login of the account the server marks active, per provider', () => {
    const local = [
      { provider: 'claude-code' as const, externalId: 'a', home: '/h/.claude', isDefault: true },
      { provider: 'claude-code' as const, externalId: 'b', home: '/h/.claude-b', isDefault: false },
      { provider: 'codex' as const, externalId: 'c', home: '/h/.codex', isDefault: true },
    ];
    const targets = pointerTargets(
      [
        { provider: 'claude-code', externalId: 'b', isActive: true },
        { provider: 'claude-code', externalId: 'a', isActive: false },
        // Active on the server but not on this machine: the codex pointer is left alone.
        { provider: 'codex', externalId: 'elsewhere', isActive: true },
      ],
      local,
    );
    expect(targets.map((t) => t.externalId)).toEqual(['b']);
  });
});
