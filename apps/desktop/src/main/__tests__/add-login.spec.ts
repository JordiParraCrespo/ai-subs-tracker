import { EventEmitter } from 'node:events';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { addLogin, outputTail, readProgress, startLogin } from '../add-login';
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
    const failed = await addLogin({
      ...common,
      spawn: fakeSpawn((c) => {
        c.stderr.write('Error: device code login is not enabled for this workspace\n');
        setTimeout(() => c.emit('exit', 1, null), 5);
      }),
    });
    // The CLI's reason goes with the failure, not just its exit code.
    expect(failed).toEqual({
      ok: false,
      message:
        '`codex login` exited with 1:\nError: device code login is not enabled for this workspace',
    });
    const silent = await addLogin({ ...common, spawn: fakeSpawn((c) => c.emit('exit', 1, null)) });
    expect(silent.message).toBe('`codex login` exited with 1.');
    const timedOut = await addLogin({
      ...common,
      timeoutMs: 20,
      spawn: fakeSpawn(() => undefined),
    });
    expect(timedOut.message).toContain('15 minutes');
    expect(await readdir(join(root, 'codex'))).toEqual([]);
  });

  it('removes the folder and fails when the check of what was signed in refuses it', async () => {
    const root = await tempDir();
    const checked: string[] = [];
    const common = {
      managedRoot: root,
      provider: 'codex',
      command: (home: string) => ({ command: 'codex', args: ['login'], env: { CODEX_HOME: home } }),
      env: {},
      spawn: fakeSpawn((c) => c.emit('exit', 0, null)),
    };
    const refused = await addLogin({
      ...common,
      verify: async (home) => {
        checked.push(home);
        return 'That is dev@example.com, already added.';
      },
    });
    expect(refused).toEqual({ ok: false, message: 'That is dev@example.com, already added.' });
    expect(checked[0]?.startsWith(join(root, 'codex'))).toBe(true);
    expect(await readdir(join(root, 'codex'))).toEqual([]);

    const kept = await addLogin({ ...common, verify: async () => null });
    expect(kept).toEqual({ ok: true, message: null });
    expect(await readdir(join(root, 'codex'))).toHaveLength(1);
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
  it('waits for a link and a code to finish printing', () => {
    expect(readProgress('visit https://auth.openai.com/codex/dev')).toEqual({
      link: null,
      code: null,
    });
    expect(readProgress('Enter this one-time code\n   K7QF-2X')).toEqual({
      link: null,
      code: null,
    });
  });

  it('shows only a link on the hosts the provider names', () => {
    const printed =
      'See https://github.com/openai/codex for help\nOpen https://auth.openai.com/codex/device\n';
    expect(readProgress(printed, ['auth.openai.com']).link).toBe(
      'https://auth.openai.com/codex/device',
    );
    expect(
      readProgress('See https://evil.example/auth.openai.com\n', ['auth.openai.com']).link,
    ).toBeNull();
  });

  it('keeps the readable end of a failed CLI’s output', () => {
    const noise = Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n');
    const tail = outputTail(
      `${noise}\n\u001b[31mError:\u001b[0m device code sign-in is disabled\r\n\n`,
    );
    expect(tail.split('\n')).toHaveLength(20);
    expect(tail.endsWith('Error: device code sign-in is disabled')).toBe(true);
    expect(outputTail('Working ⠋\rWorking ⠙\rDone\n')).toBe('Done');
  });

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
      '',
    ].join('\n');
    expect(readProgress(printed)).toEqual({
      link: 'https://auth.openai.com/codex/device',
      code: 'K7QF-2XMB9',
    });
  });
});
