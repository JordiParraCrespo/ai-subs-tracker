import { DESKTOP_CHANNELS } from '@flama/shared/desktop';
import { describe, expect, it, vi } from 'vitest';
import { type DesktopServices, ipcHandlers, registerIpc } from '../ipc';
import {
  IpcArgumentError,
  isTrustedSender,
  parseAccountId,
  parseApiKey,
  parseExternalUrl,
  parseHome,
  parseLocale,
  parseLoginCode,
  parseProvider,
  parseReaderProvider,
  parseToken,
} from '../ipc-validation';

function services(): DesktopServices {
  return {
    getToken: vi.fn(async () => null),
    setToken: vi.fn(async () => undefined),
    collectorStatus: vi.fn(() => ({
      phase: 'idle' as const,
      lastRunAt: null,
      nextRunAt: null,
      lastError: null,
      logins: [],
      readers: [],
    })),
    collectorRefresh: vi.fn(),
    addLogin: vi.fn(async () => ({ ok: true, message: null })),
    submitLoginCode: vi.fn(),
    cancelLogin: vi.fn(),
    activate: vi.fn(async () => undefined),
    usageReaderConnect: vi.fn(async () => ({ ok: true, message: null, reader: null })),
    usageReaderDisconnect: vi.fn(async () => undefined),
    shellIntegration: vi.fn(),
    shellInstall: vi.fn(),
    liveFeedTargets: vi.fn(async () => []),
    liveFeedInstall: vi.fn(async () => []),
    liveFeedUninstall: vi.fn(async () => []),
    openExternal: vi.fn(async () => undefined),
    setLocale: vi.fn(),
  };
}

describe('IPC argument validation', () => {
  it('accepts only known providers', () => {
    expect(parseProvider('claude-code')).toBe('claude-code');
    expect(parseProvider('codex')).toBe('codex');
    for (const bad of ['gemini', '', null, 1, { id: 'codex' }]) {
      expect(() => parseProvider(bad)).toThrow(IpcArgumentError);
    }
  });

  it('takes a usage reader only for a provider that has one, never a local login', () => {
    expect(parseReaderProvider('zai')).toBe('zai');
    expect(parseReaderProvider('bigmodel')).toBe('bigmodel');
    for (const bad of ['codex', 'claude-code', 'toString', '__proto__', '', null]) {
      expect(() => parseReaderProvider(bad)).toThrow(IpcArgumentError);
    }
  });

  it('files a key only under an account UUID', () => {
    const id = '0b7c8a5e-3f0a-4c1e-9d2b-6a1f2e3d4c5b';
    expect(parseAccountId(id.toUpperCase())).toBe(id);
    for (const bad of ['../../etc', `${id}x`, '', 7]) {
      expect(() => parseAccountId(bad)).toThrow(IpcArgumentError);
    }
  });

  // The key becomes an HTTP header value: a line break would add a header.
  it('takes a pasted API key as one printable line', () => {
    expect(parseApiKey('  abcd1234.efgh  ')).toBe('abcd1234.efgh');
    for (const bad of ['short', 'abcd1234\r\nX-Evil: 1', 'abcd 1234 efgh', 'x'.repeat(600), null]) {
      expect(() => parseApiKey(bad)).toThrow(IpcArgumentError);
    }
  });

  it('bounds tokens and treats empty as sign-out', () => {
    expect(parseToken(null)).toBeNull();
    expect(parseToken('')).toBeNull();
    expect(parseToken('abc.def')).toBe('abc.def');
    expect(() => parseToken('x'.repeat(5000))).toThrow(IpcArgumentError);
    expect(() => parseToken('a b')).toThrow(IpcArgumentError);
    expect(() => parseToken(42)).toThrow(IpcArgumentError);
  });

  it('requires absolute folders', () => {
    expect(parseHome('/Users/maya/.claude')).toBe('/Users/maya/.claude');
    expect(() => parseHome('.claude')).toThrow(IpcArgumentError);
    expect(() => parseHome(`/${'a'.repeat(2000)}`)).toThrow(IpcArgumentError);
  });

  it('opens only http(s) URLs', () => {
    expect(parseExternalUrl('https://claude.ai/x')).toBe('https://claude.ai/x');
    for (const bad of ['file:///etc/passwd', 'javascript:alert(1)', 'app://resetowl/', 'nope']) {
      expect(() => parseExternalUrl(bad)).toThrow(IpcArgumentError);
    }
  });

  it('takes a pasted sign-in code as one printable line, never a second one', () => {
    expect(parseLoginCode('  abc#DEF_123  ')).toBe('abc#DEF_123');
    for (const bad of ['', '   ', 'abc\ndef', 'a b', 'x'.repeat(600), 7]) {
      expect(() => parseLoginCode(bad)).toThrow(IpcArgumentError);
    }
  });

  it('trusts only frames from the renderer origin', () => {
    expect(isTrustedSender('app://resetowl/accounts', 'app://resetowl')).toBe(true);
    expect(isTrustedSender('http://localhost:3000/x', 'http://localhost:3000')).toBe(true);
    expect(isTrustedSender('https://evil.example/', 'app://resetowl')).toBe(false);
    expect(isTrustedSender('app://other/', 'app://resetowl')).toBe(false);
    expect(isTrustedSender(undefined, 'app://resetowl')).toBe(false);
  });
});

describe('language from the screens', () => {
  it('names a supported locale, region or not, and falls back to English for the rest', () => {
    expect(parseLocale('es')).toBe('es');
    expect(parseLocale('es-ES')).toBe('es');
    expect(parseLocale('en-GB')).toBe('en');
    expect(parseLocale('fr')).toBe('en');
  });

  it('refuses anything that is not a language tag', () => {
    for (const bad of ['', 'e', 'es ES', '../es', 'x'.repeat(40), null, 1, ['es']]) {
      expect(() => parseLocale(bad)).toThrow(IpcArgumentError);
    }
  });

  it('hands the tray the locale, not the raw tag', () => {
    const s = services();
    ipcHandlers(s)[DESKTOP_CHANNELS.setLocale]?.('es-419');
    expect(s.setLocale).toHaveBeenCalledWith('es');
  });
});

describe('IPC handlers', () => {
  it('has a handler for every invoke channel (all but the two change events)', () => {
    const channels = Object.values(DESKTOP_CHANNELS).filter(
      (c) =>
        c !== DESKTOP_CHANNELS.collectorChanged && c !== DESKTOP_CHANNELS.accountsLoginProgress,
    );
    expect(Object.keys(ipcHandlers(services())).sort()).toEqual([...channels].sort());
  });

  it('validates before calling a service', async () => {
    const s = services();
    const h = ipcHandlers(s);
    expect(() => h[DESKTOP_CHANNELS.accountsAddLogin]?.('rm -rf')).toThrow(IpcArgumentError);
    expect(s.addLogin).not.toHaveBeenCalled();
    expect(() => h[DESKTOP_CHANNELS.accountsActivate]?.('codex', 'x'.repeat(201))).toThrow();
    await h[DESKTOP_CHANNELS.accountsActivate]?.('codex', 'acc-1');
    expect(s.activate).toHaveBeenCalledWith('codex', 'acc-1');
    expect(() => h[DESKTOP_CHANNELS.openExternal]?.('file:///etc/passwd')).toThrow();
    expect(s.openExternal).not.toHaveBeenCalled();
  });

  it('refuses a sender that is not the app window or not the renderer origin', async () => {
    const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();
    const s = services();
    registerIpc({ handle: (channel, fn) => handlers.set(channel, fn as never) }, s, {
      rendererOrigin: 'app://resetowl',
      isAppWebContents: (id) => id === 1,
    });
    const getToken = handlers.get(DESKTOP_CHANNELS.authGetToken);
    if (!getToken) throw new Error('missing handler');
    expect(() => getToken({ sender: { id: 2 }, senderFrame: { url: 'app://resetowl/' } })).toThrow(
      /Refused/,
    );
    expect(() =>
      getToken({ sender: { id: 1 }, senderFrame: { url: 'https://evil.example/' } }),
    ).toThrow(/Refused/);
    await getToken({ sender: { id: 1 }, senderFrame: { url: 'app://resetowl/dashboard' } });
    expect(s.getToken).toHaveBeenCalledTimes(1);
  });
});
