import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  installLiveFeed,
  liveFeedTarget,
  startLiveFeedServer,
  statuslineScript,
  uninstallLiveFeed,
} from '../live-feed';
import { tempDir } from './helpers';

const SCRIPT = '/data/Subtrack/statusline.sh';

async function settings(home: string) {
  return JSON.parse(await readFile(join(home, 'settings.json'), 'utf8'));
}

describe('live feed settings.json', () => {
  it('installs into a folder with no settings.json', async () => {
    const home = await tempDir();
    expect(await installLiveFeed(home, SCRIPT)).toEqual({ home, installed: true, available: true });
    expect(await settings(home)).toEqual({ statusLine: { type: 'command', command: SCRIPT } });
  });

  it('keeps every other setting when installing and uninstalling', async () => {
    const home = await tempDir();
    await writeFile(
      join(home, 'settings.json'),
      JSON.stringify({ model: 'opus', permissions: { allow: ['Bash(ls)'] } }, null, 4),
    );
    await installLiveFeed(home, SCRIPT);
    const raw = await readFile(join(home, 'settings.json'), 'utf8');
    expect(raw).toContain('\n    "model"'); // indentation kept
    expect(await settings(home)).toEqual({
      model: 'opus',
      permissions: { allow: ['Bash(ls)'] },
      statusLine: { type: 'command', command: SCRIPT },
    });
    expect(await uninstallLiveFeed(home, SCRIPT)).toEqual({
      home,
      installed: false,
      available: true,
    });
    expect(await settings(home)).toEqual({ model: 'opus', permissions: { allow: ['Bash(ls)'] } });
  });

  it("never replaces someone else's statusLine, and never removes it", async () => {
    const home = await tempDir();
    const theirs = { statusLine: { type: 'command', command: '~/bin/my-prompt.sh' } };
    await writeFile(join(home, 'settings.json'), JSON.stringify(theirs));
    expect(await liveFeedTarget(home, SCRIPT)).toEqual({
      home,
      installed: false,
      available: false,
    });
    expect(await installLiveFeed(home, SCRIPT)).toMatchObject({
      installed: false,
      available: false,
    });
    expect(await uninstallLiveFeed(home, SCRIPT)).toMatchObject({ installed: false });
    expect(await settings(home)).toEqual(theirs);
  });

  it('leaves a settings.json it cannot parse untouched', async () => {
    const home = await tempDir();
    await writeFile(join(home, 'settings.json'), '{ not json');
    expect(await installLiveFeed(home, SCRIPT)).toMatchObject({ available: false });
    expect(await readFile(join(home, 'settings.json'), 'utf8')).toBe('{ not json');
  });
});

describe('live feed server and script', () => {
  it('accepts the script post with the secret and the config dir, and prints an empty line', async () => {
    const received: Array<[string, string]> = [];
    const server = await startLiveFeedServer((dir, body) => received.push([dir, body]));
    try {
      const dir = await tempDir();
      const script = join(dir, 'statusline.sh');
      await writeFile(script, statuslineScript(server.port, server.secret), { mode: 0o700 });
      const payload = '{"rate_limits":{"five_hour":{"used_percentage":12}}}';
      const out = execFileSync('sh', [script], {
        input: payload,
        env: {
          PATH: process.env.PATH,
          HOME: '/home/maya',
          CLAUDE_CONFIG_DIR: '/home/maya/.claude-b',
        },
        encoding: 'utf8',
      });
      expect(out).toBe('\n');
      await new Promise((r) => setTimeout(r, 50));
      expect(received).toEqual([['/home/maya/.claude-b', payload]]);
    } finally {
      await server.close();
    }
  });

  it('rejects a request without the secret', async () => {
    const server = await startLiveFeedServer(() => {
      throw new Error('should not be called');
    });
    try {
      const res = await fetch(`http://127.0.0.1:${server.port}/statusline/claude`, {
        method: 'POST',
        headers: { authorization: 'Bearer wrong', 'x-claude-config-dir': '/x' },
        body: '{}',
      });
      expect(res.status).toBe(401);
      const other = await fetch(`http://127.0.0.1:${server.port}/other`, { method: 'POST' });
      expect(other.status).toBe(404);
    } finally {
      await server.close();
    }
  });
});
