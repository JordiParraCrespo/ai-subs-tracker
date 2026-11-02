import { EventEmitter } from 'node:events';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { addLogin } from '../add-login';
import { tempDir } from './helpers';

function fakeChild(
  script: (child: EventEmitter & { stdout: PassThrough; stderr: PassThrough }) => void,
) {
  return (..._args: unknown[]) => {
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: () => true,
    });
    setTimeout(() => script(child), 0);
    return child;
  };
}

const fakeSpawn = (...args: Parameters<typeof fakeChild>) => fakeChild(...args) as never;

describe('add login', () => {
  it('spawns the login command with the new home, opens the printed URL, resolves ok on exit 0', async () => {
    const root = await tempDir();
    const opened: string[] = [];
    let spawnedEnv: Record<string, string> = {};
    const result = await addLogin({
      managedRoot: root,
      provider: 'claude-code',
      command: (home) => ({
        command: 'claude',
        args: ['auth', 'login'],
        env: { CLAUDE_CONFIG_DIR: home },
      }),
      openUrl: (u) => opened.push(u),
      env: { PATH: '/usr/bin' },
      spawn: ((cmd: string, args: string[], opts: { env: Record<string, string> }) => {
        spawnedEnv = opts.env;
        return fakeChild((child) => {
          child.stdout.write('Visit https://claude.ai/oauth?x=1 to sign in\n');
          setTimeout(() => child.emit('exit', 0, null), 5);
        })(cmd, args, opts);
      }) as never,
    });
    expect(result).toEqual({ ok: true, message: null });
    expect(opened).toEqual(['https://claude.ai/oauth?x=1']);
    expect(spawnedEnv.CLAUDE_CONFIG_DIR?.startsWith(join(root, 'claude-code'))).toBe(true);
    expect(await readdir(join(root, 'claude-code'))).toHaveLength(1);
  });

  it('reports a missing CLI and removes the empty home', async () => {
    const root = await tempDir();
    const result = await addLogin({
      managedRoot: root,
      provider: 'codex',
      command: (home) => ({ command: 'codex', args: ['login'], env: { CODEX_HOME: home } }),
      openUrl: () => undefined,
      env: {},
      spawn: fakeSpawn((child) =>
        child.emit('error', Object.assign(new Error('spawn codex ENOENT'), { code: 'ENOENT' })),
      ),
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('not installed');
    expect(await readdir(join(root, 'codex'))).toEqual([]);
  });

  it('fails on a non-zero exit and on timeout', async () => {
    const root = await tempDir();
    const common = {
      managedRoot: root,
      provider: 'codex',
      command: (home: string) => ({ command: 'codex', args: ['login'], env: { CODEX_HOME: home } }),
      openUrl: () => undefined,
      env: {},
    };
    const failed = await addLogin({ ...common, spawn: fakeSpawn((c) => c.emit('exit', 1, null)) });
    expect(failed).toMatchObject({ ok: false });
    const timedOut = await addLogin({
      ...common,
      timeoutMs: 20,
      spawn: fakeSpawn(() => undefined),
    });
    expect(timedOut.message).toContain('10 minutes');
    expect(await readdir(join(root, 'codex'))).toEqual([]);
  });
});
