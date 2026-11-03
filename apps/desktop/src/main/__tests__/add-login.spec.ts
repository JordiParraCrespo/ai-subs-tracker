import { EventEmitter } from 'node:events';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { addLogin, readProgress, startLogin } from '../add-login';
import { tempDir } from './helpers';

function fakeChild(
  script: (
    child: EventEmitter & { stdin: PassThrough; stdout: PassThrough; stderr: PassThrough },
  ) => void,
) {
  return (..._args: unknown[]) => {
    const child = Object.assign(new EventEmitter(), {
      stdin: new PassThrough(),
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: () => {
        setTimeout(() => child.emit('exit', null, 'SIGTERM'), 0);
        return true;
      },
    });
    setTimeout(() => script(child), 0);
    return child;
  };
}

const fakeSpawn = (...args: Parameters<typeof fakeChild>) => fakeChild(...args) as never;

describe('add login', () => {
  it('spawns the login command with the new home, reports the printed link, resolves ok on exit 0', async () => {
    const root = await tempDir();
    const links: (string | null)[] = [];
    let spawnedEnv: Record<string, string> = {};
    const result = await addLogin({
      managedRoot: root,
      provider: 'claude-code',
      command: (home) => ({
        command: 'claude',
        args: ['auth', 'login'],
        env: { CLAUDE_CONFIG_DIR: home },
      }),
      onProgress: (progress) => links.push(progress.link),
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
    // Reported, not opened: the CLI opens the browser itself, and this link
    // is the manual one that ends in a code to paste.
    expect(links).toEqual(['https://claude.ai/oauth?x=1']);
    expect(spawnedEnv.CLAUDE_CONFIG_DIR?.startsWith(join(root, 'claude-code'))).toBe(true);
    expect(await readdir(join(root, 'claude-code'))).toHaveLength(1);
  });

  it('reports a missing CLI and removes the empty home', async () => {
    const root = await tempDir();
    const result = await addLogin({
      managedRoot: root,
      provider: 'codex',
      command: (home) => ({ command: 'codex', args: ['login'], env: { CODEX_HOME: home } }),
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
      env: {},
    };
    const failed = await addLogin({ ...common, spawn: fakeSpawn((c) => c.emit('exit', 1, null)) });
    expect(failed).toMatchObject({ ok: false });
    const timedOut = await addLogin({
      ...common,
      timeoutMs: 20,
      spawn: fakeSpawn(() => undefined),
    });
    expect(timedOut.message).toContain('15 minutes');
    expect(await readdir(join(root, 'codex'))).toEqual([]);
  });

  it('types a pasted code into the CLI, and a cancel stops it and removes the folder', async () => {
    const root = await tempDir();
    const typed: string[] = [];
    const common = {
      managedRoot: root,
      provider: 'claude-code',
      command: (home: string) => ({
        command: 'claude',
        args: ['auth', 'login'],
        env: { CLAUDE_CONFIG_DIR: home },
      }),
      env: {},
    };
    const pasted = startLogin({
      ...common,
      spawn: fakeSpawn((child) => {
        child.stdin.on('data', (chunk: Buffer) => {
          typed.push(chunk.toString());
          child.emit('exit', 0, null);
        });
      }),
    });
    pasted.submitCode('  abc#def  ');
    expect(await pasted.result).toEqual({ ok: true, message: null });
    expect(typed).toEqual(['abc#def\n']);

    const stopped = startLogin({ ...common, spawn: fakeSpawn(() => undefined) });
    await new Promise((resolve) => setTimeout(resolve, 20));
    stopped.cancel();
    expect(await stopped.result).toEqual({ ok: false, message: 'Sign-in cancelled.' });
    expect(await readdir(join(root, 'claude-code'))).toHaveLength(1);
  });
});

describe('reading what a login printed', () => {
  it('takes Claude Code’s manual link out of its terminal hyperlink', () => {
    const url = 'https://claude.com/cai/oauth/authorize?code=true&state=abc';
    const printed = `Opening browser to sign in…\nIf the browser didn't open, visit: \u001b]8;;${url}\u0007${url}\u001b]8;;\u0007\nPaste code here if prompted > `;
    expect(readProgress(printed)).toEqual({ link: url, code: null });
  });

  it('takes Codex’s device page and the one-time code on the line after it is named', () => {
    const printed = [
      'Follow these steps to sign in with ChatGPT using device code authorization:',
      '',
      '1. Open this link in your browser and sign in to your account',
      '   \u001b[94mhttps://auth.openai.com/codex/device\u001b[0m',
      '',
      '2. Enter this one-time code \u001b[90m(expires in 15 minutes)\u001b[0m',
      '   \u001b[94mK7QF-2XMB9\u001b[0m',
    ].join('\n');
    expect(readProgress(printed)).toEqual({
      link: 'https://auth.openai.com/codex/device',
      code: 'K7QF-2XMB9',
    });
  });
});
