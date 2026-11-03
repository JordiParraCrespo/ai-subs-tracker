import { describe, expect, it, vi } from 'vitest';
import { extractUrls } from '../add-login';
import { contentSecurityPolicy, resolveConfig } from '../config';
import { resolveRendererFile } from '../renderer-files';
import { createTokenStore } from '../token-store';
import { trayModel } from '../tray-model';

const base = {
  env: {},
  argv: [],
  isPackaged: false,
  version: '0.1.0',
  platform: 'darwin' as const,
};

describe('config', () => {
  it('defaults the API to local unpackaged and to production packaged', () => {
    expect(resolveConfig(base).apiUrl).toBe('http://127.0.0.1:3001');
    expect(resolveConfig({ ...base, isPackaged: true }).apiUrl).toBe('https://api.resetowl.com');
    expect(resolveConfig({ ...base, env: { RESETOWL_API_URL: 'https://x.dev/' } }).apiUrl).toBe(
      'https://x.dev',
    );
  });

  it('has an honest user agent', () => {
    const ua = resolveConfig(base).userAgent;
    expect(ua).toBe('resetowl-desktop/0.1.0 (darwin)');
    expect(ua).not.toMatch(/claude|codex/i);
  });

  it('loads a dev server only when asked', () => {
    expect(resolveConfig(base).rendererUrl).toBeNull();
    expect(resolveConfig(base).rendererOrigin).toBe('app://resetowl');
    expect(resolveConfig({ ...base, argv: ['--dev'] }).rendererUrl).toBe('http://localhost:3000');
    expect(resolveConfig({ ...base, isPackaged: true, argv: ['--dev'] }).rendererUrl).toBeNull();
    const env = { RESETOWL_RENDERER_URL: 'http://localhost:5173' };
    expect(resolveConfig({ ...base, env }).rendererOrigin).toBe('http://localhost:5173');
  });

  it('reads the diagnostic flags', () => {
    expect(resolveConfig({ ...base, argv: ['--collect-once'] }).mode).toBe('collect-once');
    expect(resolveConfig({ ...base, argv: ['--smoke'] }).mode).toBe('smoke');
  });

  it('builds the CSP around the API origin', () => {
    expect(contentSecurityPolicy('http://127.0.0.1:3001')).toBe(
      "default-src 'self'; connect-src 'self' http://127.0.0.1:3001; img-src 'self' data: http://127.0.0.1:3001; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:",
    );
  });
});

describe('renderer files', () => {
  const files = new Set(['/r/index.html', '/r/assets/app.js']);
  const exists = (f: string) => files.has(f);

  it('serves files, falls back to index.html for routes, 404s missing assets', () => {
    expect(resolveRendererFile('/r', '/assets/app.js', exists)).toMatchObject({
      file: '/r/assets/app.js',
      isHtml: false,
    });
    expect(resolveRendererFile('/r', '/', exists)).toMatchObject({
      file: '/r/index.html',
      isHtml: true,
    });
    expect(resolveRendererFile('/r', '/accounts/123', exists)).toMatchObject({
      file: '/r/index.html',
      fallback: true,
    });
    expect(resolveRendererFile('/r', '/assets/missing.js', exists)).toBeNull();
  });

  it('never leaves the root', () => {
    const anything = () => true;
    for (const p of ['/../etc/passwd', '/%2e%2e/%2e%2e/etc/passwd', '/assets/../../x.js']) {
      const resolved = resolveRendererFile('/r', p, anything);
      expect(resolved === null || resolved.file.startsWith('/r/')).toBe(true);
    }
  });
});

describe('tray model', () => {
  it('names the account to use next and its weekly headroom', () => {
    const now = new Date('2026-11-02T12:00:00Z');
    const weekly = (utilization: number, hours: number) => ({
      key: 'seven_day',
      kind: 'weekly' as const,
      label: 'Week',
      utilization,
      resetsAt: new Date(now.getTime() + hours * 3_600_000).toISOString(),
      windowMinutes: 10080,
    });
    const model = trayModel(
      [
        {
          id: 'a',
          provider: 'claude-code',
          externalId: 'a',
          displayName: 'Work',
          isActive: false,
          latest: { status: 'ok', windows: [weekly(80, 100)] },
        },
        {
          id: 'b',
          provider: 'codex',
          externalId: 'b',
          displayName: 'Home',
          isActive: true,
          latest: { status: 'ok', windows: [weekly(38, 20)] },
        },
      ],
      now,
    );
    expect(model).toMatchObject({ headline: 'Use next: Home — 62% left', title: '62%' });
    expect(trayModel(null, now).title).toBe('');
    expect(trayModel([], now).headline).toBe('No account has room right now');
  });
});

describe('token store', () => {
  const encryptor = (available: boolean) => ({
    isEncryptionAvailable: () => available,
    encryptString: (s: string) => Buffer.from(`enc:${s}`),
    decryptString: (b: Buffer) => b.toString().replace(/^enc:/, ''),
  });

  it('encrypts to disk and reads it back', async () => {
    const disk = new Map<string, Buffer>();
    const fs = {
      readFile: async (p: string) => {
        const v = disk.get(p);
        if (!v) throw new Error('ENOENT');
        return v;
      },
      writeFile: async (p: string, d: Buffer) => {
        disk.set(p, d);
      },
      rm: async (p: string) => {
        disk.delete(p);
      },
    };
    const store = createTokenStore({
      file: '/s',
      encryptor: encryptor(true),
      fs,
      log: () => undefined,
    });
    await store.set('secret-token');
    expect(disk.get('/s')?.toString()).toBe('enc:secret-token');
    const again = createTokenStore({
      file: '/s',
      encryptor: encryptor(true),
      fs,
      log: () => undefined,
    });
    expect(await again.get()).toBe('secret-token');
    await again.set(null);
    expect(disk.has('/s')).toBe(false);
  });

  it('keeps the token in memory only without a keystore, and never logs it', async () => {
    const log = vi.fn();
    const fs = { readFile: vi.fn(), writeFile: vi.fn(), rm: vi.fn(async () => undefined) };
    const store = createTokenStore({ file: '/s', encryptor: encryptor(false), fs, log });
    await store.set('secret-token');
    expect(await store.get()).toBe('secret-token');
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('memory only'));
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret-token');
  });
});

describe('add login', () => {
  it('finds the sign-in URL in CLI output', () => {
    expect(
      extractUrls(
        'Opening browser…\nIf it does not open, visit: https://claude.ai/oauth/authorize?code=1&x=2.\n',
      ),
    ).toEqual(['https://claude.ai/oauth/authorize?code=1&x=2']);
    expect(extractUrls('no links, http://insecure.example only')).toEqual([]);
  });
});
