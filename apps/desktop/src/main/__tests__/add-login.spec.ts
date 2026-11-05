import { execFileSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import type { LoginProgress } from '@flama/shared/desktop';
import { describe, expect, it } from 'vitest';
import { acceptBrowserLink, addLogin, readFailure, readProgress, startLogin } from '../add-login';
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
    let detached: boolean | undefined;
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
      spawn: ((
        cmd: string,
        args: string[],
        opts: { env: Record<string, string>; detached?: boolean },
      ) => {
        spawnedEnv = opts.env;
        detached = opts.detached;
        return fakeChild((child) => {
          child.stdout.write('Visit https://claude.ai/oauth?x=1 to sign in\n');
          setTimeout(() => child.emit('exit', 0, null), 5);
        })(cmd, args, opts);
      }) as never,
    });
    expect(result).toEqual({ ok: true, message: null });
    // Reported, not opened: without `capturesBrowser` the printed link is the one.
    expect(links).toEqual([null, 'https://claude.ai/oauth?x=1']);
    expect(spawnedEnv.CLAUDE_CONFIG_DIR?.startsWith(join(root, 'claude-code'))).toBe(true);
    expect(spawnedEnv.BROWSER).toBeUndefined();
    // Its own process group off Windows, so a stop takes the whole CLI down.
    expect(detached).toBe(process.platform !== 'win32');
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

const AUTO =
  'https://claude.com/cai/oauth/authorize?code=false&redirect_uri=http%3A%2F%2Flocalhost%3A42347%2Fcallback&state=s';
const MANUAL =
  'https://claude.com/cai/oauth/authorize?code=true&redirect_uri=https%3A%2F%2Fplatform.claude.com%2Foauth%2Fcode%2Fcallback&state=s';

describe('a Claude sign-in that finishes in a private window', () => {
  const claude = (home: string) => ({
    command: 'claude',
    args: ['auth', 'login', '--claudeai'],
    env: { CLAUDE_CONFIG_DIR: home },
    capturesBrowser: true,
  });

  it.skipIf(process.platform === 'win32')(
    'catches the link handed to $BROWSER as the one to open, keeps the printed one for a code, and removes the script',
    async () => {
      const root = await tempDir();
      const tmpRoot = await tempDir();
      const seen: LoginProgress[] = [];
      let browser = '';
      const result = await addLogin({
        managedRoot: root,
        provider: 'claude-code',
        command: claude,
        tmpRoot,
        onProgress: (progress) => seen.push(progress),
        env: {},
        spawn: ((cmd: string, args: string[], opts: { env: Record<string, string> }) => {
          browser = opts.env.BROWSER ?? '';
          return fakeChild((child) => {
            child.stdout.write(`If the browser didn't open, visit: ${MANUAL}\n`);
            // What the CLI does to "open the browser": run $BROWSER with the link.
            execFileSync(browser, [AUTO]);
            setTimeout(() => child.emit('exit', 0, null), 400);
          })(cmd, args, opts);
        }) as never,
      });
      expect(result).toEqual({ ok: true, message: null });
      expect((await stat(browser).catch(() => null))?.isFile()).toBeFalsy();
      expect(await readdir(tmpRoot)).toEqual([]);
      const final = seen.at(-1);
      expect(final).toMatchObject({ link: AUTO, codeLink: MANUAL, code: null });
      expect(Date.parse(final?.deadline ?? '')).toBeGreaterThan(Date.now() + 14 * 60_000);
    },
  );

  it('takes only a link whose callback is on this computer from $BROWSER', () => {
    expect(acceptBrowserLink(`${AUTO}\n`)).toBe(AUTO);
    expect(acceptBrowserLink(AUTO.replace('localhost', '127.0.0.1'))).not.toBeNull();
    expect(acceptBrowserLink(MANUAL)).toBeNull();
    expect(acceptBrowserLink(AUTO.replace('localhost', 'evil.example'))).toBeNull();
    expect(acceptBrowserLink(AUTO.replace('https:', 'http:'))).toBeNull();
    expect(acceptBrowserLink('not a url')).toBeNull();
  });

  it('fails an exit 0 the check rejects, such as an account already added, and removes its folder', async () => {
    const root = await tempDir();
    const result = await addLogin({
      managedRoot: root,
      provider: 'claude-code',
      command: (home) => ({ command: 'claude', args: [], env: { CLAUDE_CONFIG_DIR: home } }),
      check: async () => 'This Claude Code account is already added.',
      env: {},
      spawn: fakeSpawn((c) => c.emit('exit', 0, null)),
    });
    expect(result).toEqual({ ok: false, message: 'This Claude Code account is already added.' });
    expect(await readdir(join(root, 'claude-code'))).toEqual([]);
  });

  it('stops at a denied authorization instead of waiting out the timer', async () => {
    const root = await tempDir();
    let killed = false;
    const started = Date.now();
    const result = await addLogin({
      managedRoot: root,
      provider: 'claude-code',
      command: (home) => ({ command: 'claude', args: [], env: { CLAUDE_CONFIG_DIR: home } }),
      env: {},
      spawn: ((...args: unknown[]) => {
        const child = fakeChild((c) =>
          c.stderr.write('OAuth error: access_denied (the user denied the request)\n'),
        )(...args);
        const kill = child.kill;
        child.kill = () => {
          killed = true;
          return kill();
        };
        return child;
      }) as never,
    });
    expect(result).toEqual({
      ok: false,
      message: 'OAuth error: access_denied (the user denied the request)',
    });
    expect(killed).toBe(true);
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});

describe('reading what a login printed', () => {
  it('finds a line that says the sign-in failed, and nothing in a normal run', () => {
    expect(readFailure('Paste code here if prompted > ')).toBeNull();
    expect(readFailure(`visit: ${MANUAL}\n`)).toBeNull();
    expect(
      readFailure("\u001b[31mLogin failed: That code wasn't accepted.\u001b[0m\nTry again"),
    ).toBe("Login failed: That code wasn't accepted.");
    expect(readFailure('error=access_denied&state=x')).toBe('error=access_denied&state=x');
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
    ].join('\n');
    expect(readProgress(printed)).toEqual({
      link: 'https://auth.openai.com/codex/device',
      code: 'K7QF-2XMB9',
    });
  });
});
