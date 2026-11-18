import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { collectVersions, osLabel, parseCliVersion, readCliVersion } from '../versions';

/** A child process that prints `out` and exits with `code`, or never exits. */
function fakeSpawn(out: string, code: number | null, opts: { fail?: boolean } = {}) {
  return vi.fn(() => {
    if (opts.fail) throw new Error('spawn ENOENT');
    const child = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      kill: vi.fn(),
    });
    queueMicrotask(() => {
      child.stdout.emit('data', Buffer.from(out));
      if (code !== null) child.emit('close', code);
    });
    return child;
  }) as never;
}

describe('a CLI version', () => {
  it('is the dotted number each CLI prints, whatever surrounds it', () => {
    expect(parseCliVersion('2.1.0 (Claude Code)\n')).toBe('2.1.0');
    expect(parseCliVersion('codex-cli 0.46.0')).toBe('0.46.0');
    expect(parseCliVersion('\u001b[1mgrok\u001b[0m 1.4.0-beta.2')).toBe('1.4.0-beta.2');
    expect(parseCliVersion('command not found')).toBeNull();
  });

  it('is read with --version, outside any login, without inherited login selectors', async () => {
    const spawn = fakeSpawn('2.1.0 (Claude Code)', 0);
    const version = await readCliVersion('claude', {
      env: { PATH: '/bin', CLAUDE_CONFIG_DIR: '/x', ANTHROPIC_API_KEY: 'k' },
      spawn,
      platform: 'darwin',
    });
    expect(version).toBe('2.1.0');
    const [command, args, options] = (spawn as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(command).toBe('claude');
    expect(args).toEqual(['--version']);
    expect(options.env).toEqual({ PATH: '/bin' });
  });

  it('is null when the CLI is missing, fails or hangs', async () => {
    const env = { PATH: '/bin' };
    expect(await readCliVersion('codex', { env, spawn: fakeSpawn('', 0, { fail: true }) })).toBe(
      null,
    );
    expect(await readCliVersion('codex', { env, spawn: fakeSpawn('0.46.0', 1) })).toBeNull();
    expect(
      await readCliVersion('grok', { env, spawn: fakeSpawn('', null), timeoutMs: 5 }),
    ).toBeNull();
  });
});

describe('the versions list', () => {
  it('names the OS people know, with the CPU', () => {
    expect(osLabel('darwin', '15.1', 'arm64')).toBe('macOS 15.1 (arm64)');
    expect(osLabel('win32', '10.0.22631', 'x64')).toBe('Windows 10.0.22631 (x64)');
    expect(osLabel('freebsd', '14.0', 'x64')).toBe('freebsd 14.0 (x64)');
  });

  it('keeps every provider in order, a CLI that failed included', async () => {
    const versions = await collectVersions({
      app: '0.1.0',
      runtime: { electron: '38.0.0', chrome: '140.0.0.0', node: '22.19.0', v8: '14.0' },
      os: 'macOS 15.1 (arm64)',
      clis: [
        { provider: 'claude-code', command: 'claude' },
        { provider: 'codex', command: 'codex' },
      ],
      readVersion: async (command) => {
        if (command === 'codex') throw new Error('boom');
        return '2.1.0';
      },
    });
    expect(versions.app).toBe('0.1.0');
    expect(versions.electron).toBe('38.0.0');
    expect(versions.clis).toEqual([
      { provider: 'claude-code', command: 'claude', version: '2.1.0' },
      { provider: 'codex', command: 'codex', version: null },
    ]);
  });
});
