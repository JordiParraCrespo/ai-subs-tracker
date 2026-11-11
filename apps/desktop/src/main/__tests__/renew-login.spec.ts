import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { LoginCommand } from '@flama/usage-providers';
import { describe, expect, it } from 'vitest';
import { runRefresh } from '../renew-login';

type FakeChild = EventEmitter & { stdout: PassThrough; stderr: PassThrough; kill: () => boolean };

function fakeChild(script: (child: FakeChild) => void) {
  return (..._args: unknown[]) => {
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      killed: false,
      kill() {
        child.killed = true;
        return true;
      },
    }) as FakeChild & { killed: boolean };
    setTimeout(() => script(child), 0);
    return child;
  };
}

const fakeSpawn = (...args: Parameters<typeof fakeChild>) => fakeChild(...args) as never;

const CMD: LoginCommand = {
  command: 'claude',
  args: ['auth', 'status'],
  env: { CLAUDE_CONFIG_DIR: '/h/.claude-work' },
};

describe('runRefresh', () => {
  it('renews a login and passes base env plus the command env, with stdin closed', async () => {
    let spawned: { cmd: string; args: string[]; env: Record<string, string>; stdin: unknown } = {
      cmd: '',
      args: [],
      env: {},
      stdin: undefined,
    };
    const outcome = await runRefresh(CMD, {
      env: { PATH: '/usr/bin', HOME: '/h' },
      spawn: ((
        cmd: string,
        args: string[],
        opts: { env: Record<string, string>; stdio: unknown[] },
      ) => {
        spawned = { cmd, args, env: opts.env, stdin: opts.stdio[0] };
        return fakeChild((child) => {
          child.stdout.write('{"loggedIn":true,"email":"me@work.dev"}\n');
          child.emit('exit', 0, null);
        })(cmd, args, opts);
      }) as never,
    });
    expect(outcome).toBe('renewed');
    expect(spawned.cmd).toBe('claude');
    expect(spawned.args).toEqual(['auth', 'status']);
    expect(spawned.env).toMatchObject({ PATH: '/usr/bin', CLAUDE_CONFIG_DIR: '/h/.claude-work' });
    expect(spawned.stdin).toBe('ignore');
  });

  it('drops an inherited CLAUDE_CONFIG_DIR for the default login, keeping ~/.claude', async () => {
    // The default login's command carries no CLAUDE_CONFIG_DIR, so an inherited
    // one must not leak through and point the CLI at another folder.
    const defaultCmd: LoginCommand = { command: 'claude', args: ['auth', 'status'], env: {} };
    let spawnedEnv: Record<string, string | undefined> = {};
    await runRefresh(defaultCmd, {
      env: { PATH: '/usr/bin', CLAUDE_CONFIG_DIR: '/h/.claude-other', CODEX_HOME: '/h/.codex-x' },
      spawn: ((cmd: string, args: string[], opts: { env: Record<string, string | undefined> }) => {
        spawnedEnv = opts.env;
        return fakeChild((child) => {
          child.stdout.write('{"loggedIn":true}\n');
          child.emit('exit', 0, null);
        })(cmd, args, opts);
      }) as never,
    });
    expect(spawnedEnv.PATH).toBe('/usr/bin');
    expect(spawnedEnv.CLAUDE_CONFIG_DIR).toBeUndefined();
    expect(spawnedEnv.CODEX_HOME).toBeUndefined();
  });

  it("drops an inherited token and another Claude session's identity, as Orca does", async () => {
    let spawnedEnv: Record<string, string | undefined> = {};
    await runRefresh(CMD, {
      env: {
        PATH: '/usr/bin',
        CLAUDE_CODE_OAUTH_TOKEN: 'someone-else',
        ANTHROPIC_API_KEY: 'sk-ant',
        CLAUDECODE: '1',
        CLAUDE_CODE_SESSION_ID: 'parent',
      },
      spawn: ((cmd: string, args: string[], opts: { env: Record<string, string | undefined> }) => {
        spawnedEnv = opts.env;
        return fakeChild((child) => child.emit('exit', 0, null))(cmd, args, opts);
      }) as never,
    });
    expect(spawnedEnv).toEqual({ PATH: '/usr/bin', CLAUDE_CONFIG_DIR: '/h/.claude-work' });
  });

  it('lets a non-default login override an inherited CLAUDE_CONFIG_DIR with its own', async () => {
    let spawnedEnv: Record<string, string | undefined> = {};
    await runRefresh(CMD, {
      env: { PATH: '/usr/bin', CLAUDE_CONFIG_DIR: '/h/.claude-other' },
      spawn: ((cmd: string, args: string[], opts: { env: Record<string, string | undefined> }) => {
        spawnedEnv = opts.env;
        return fakeChild((child) => child.emit('exit', 0, null))(cmd, args, opts);
      }) as never,
    });
    expect(spawnedEnv.CLAUDE_CONFIG_DIR).toBe('/h/.claude-work');
  });

  it('treats a clean exit as renewed even when the output is not parseable', async () => {
    const outcome = await runRefresh(CMD, {
      env: {},
      spawn: fakeSpawn((child) => {
        child.stdout.write('Logged in as me@work.dev\n');
        child.emit('exit', 0, null);
      }),
    });
    expect(outcome).toBe('renewed');
  });

  it('reports a login the CLI says is signed out, whatever the exit code', async () => {
    for (const code of [0, 1]) {
      const outcome = await runRefresh(CMD, {
        env: {},
        spawn: fakeSpawn((child) => {
          child.stdout.write('{"loggedIn":false}\n');
          child.emit('exit', code, null);
        }),
      });
      expect(outcome).toBe('signed_out');
    }
  });

  it('is unavailable when the CLI is not installed', async () => {
    const outcome = await runRefresh(CMD, {
      env: {},
      spawn: fakeSpawn((child) =>
        child.emit('error', Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' })),
      ),
    });
    expect(outcome).toBe('unavailable');
  });

  it('is unavailable on an unclear non-zero exit, so a stale reading is kept', async () => {
    const outcome = await runRefresh(CMD, {
      env: {},
      spawn: fakeSpawn((child) => {
        child.stderr.write('could not reach the refresh endpoint\n');
        child.emit('exit', 1, null);
      }),
    });
    expect(outcome).toBe('unavailable');
  });

  it('is unavailable when the CLI does not finish in time, and kills it', async () => {
    let killed = false;
    const outcome = await runRefresh(CMD, {
      env: {},
      timeoutMs: 10,
      spawn: ((cmd: string, args: string[], opts: unknown) => {
        const child = fakeChild(() => {
          /* never exits */
        })(cmd, args, opts) as FakeChild & { killed: boolean };
        const originalKill = child.kill.bind(child);
        child.kill = () => {
          killed = true;
          return originalKill();
        };
        return child;
      }) as never,
    });
    expect(outcome).toBe('unavailable');
    expect(killed).toBe(true);
  });
});
