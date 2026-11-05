import type { ReportUsageReadingInput } from '@flama/shared/schemas/accounts';
import type { ManualProviderId } from '@flama/shared/subscriptions';
import type { QuotaReading } from '@flama/usage-providers';
import { describe, expect, it } from 'vitest';
import type { ReadingResult } from '../api-client';
import type { Encryptor, TokenFs } from '../token-store';
import {
  createReaderKeyStore,
  READER_MIN_INTERVAL_MS,
  READER_RATE_LIMIT_PAUSE_MS,
  UsageReaders,
} from '../usage-readers';

const ACCOUNT = '0b7c8a5e-3f0a-4c1e-9d2b-6a1f2e3d4c5b';
const KEY = 'plan-key.secret-value';

/** A reversible "encryption" that still never leaves the key readable on disk. */
function encryptor(available = true): Encryptor {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (plain) => Buffer.from([...plain].reverse().join(''), 'utf8'),
    decryptString: (data) => [...data.toString('utf8')].reverse().join(''),
  };
}

function memoryFs() {
  const files = new Map<string, Buffer>();
  const fs: TokenFs = {
    readFile: async (path) => {
      const data = files.get(path);
      if (!data) throw new Error('ENOENT');
      return data;
    },
    writeFile: async (path, data) => {
      files.set(path, data);
    },
    rm: async (path) => {
      files.delete(path);
    },
  };
  return { fs, files };
}

const ok: QuotaReading = {
  status: 'ok',
  message: null,
  reportedPlan: 'pro',
  snapshot: {
    capturedAt: '2026-11-05T12:00:00.000Z',
    source: 'unofficial',
    status: 'ok',
    message: null,
    windows: [
      {
        key: 'weekly',
        kind: 'weekly',
        label: 'Weekly',
        utilization: 30,
        resetsAt: '2026-11-09T08:00:00.000Z',
        windowMinutes: 10080,
      },
    ],
    extraUsage: null,
  },
};

function harness(
  opts: { readings?: QuotaReading[]; posts?: ReadingResult[]; keystore?: boolean } = {},
) {
  let now = new Date('2026-11-05T12:00:00Z').getTime();
  const { fs, files } = memoryFs();
  const store = createReaderKeyStore({
    file: '/data/usage-readers.json',
    encryptor: encryptor(opts.keystore ?? true),
    fs,
    log: () => undefined,
  });
  const readings = [...(opts.readings ?? [])];
  const posts = [...(opts.posts ?? [])];
  const reads: Array<{ provider: ManualProviderId; apiKey: string }> = [];
  const sent: Array<{ accountId: string; input: ReportUsageReadingInput; token: string }> = [];
  const readers = new UsageReaders({
    store,
    async read(provider, apiKey) {
      reads.push({ provider, apiKey });
      return readings.shift() ?? ok;
    },
    async post(accountId, input, token) {
      sent.push({ accountId, input, token });
      return posts.shift() ?? { kind: 'ok' };
    },
    now: () => new Date(now),
    log: () => undefined,
  });
  return {
    readers,
    store,
    files,
    reads,
    sent,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('UsageReaders', () => {
  it('keeps a key only after a reading worked, encrypted, and sends ResetOwl the windows, never the key', async () => {
    const h = harness();

    const result = await h.readers.connect(ACCOUNT, 'zai', KEY, 'session');

    expect(result).toMatchObject({ ok: true, reader: { accountId: ACCOUNT, status: 'ok' } });
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]?.input.snapshot.source).toBe('unofficial');
    expect(h.sent[0]?.input.reportedPlan).toBe('pro');
    expect(JSON.stringify(h.sent)).not.toContain(KEY);
    const onDisk = h.files.get('/data/usage-readers.json')?.toString('utf8') ?? '';
    expect(onDisk).not.toContain(KEY);
    expect(await h.store.list()).toEqual([{ accountId: ACCOUNT, provider: 'zai', apiKey: KEY }]);
    expect(JSON.stringify(h.readers.states())).not.toContain(KEY);
  });

  it('does not keep a key the vendor refused', async () => {
    const h = harness({
      readings: [
        { status: 'auth_expired', message: 'refused', reportedPlan: null, snapshot: null },
      ],
    });
    const result = await h.readers.connect(ACCOUNT, 'zai', KEY, 'session');
    expect(result).toMatchObject({ ok: false, message: 'refused' });
    expect(h.sent).toHaveLength(0);
    expect(await h.store.list()).toEqual([]);
  });

  it('refuses to keep a key without a keystore, and reads nothing', async () => {
    const h = harness({ keystore: false });
    const result = await h.readers.connect(ACCOUNT, 'zai', KEY, 'session');
    expect(result.ok).toBe(false);
    expect(h.reads).toHaveLength(0);
    expect(h.files.size).toBe(0);
  });

  it('reads each kept key at most once per interval, however often the collector runs', async () => {
    const h = harness();
    await h.readers.connect(ACCOUNT, 'bigmodel', KEY, 'session');
    await h.readers.runAll('session');
    expect(h.reads).toHaveLength(1);
    h.advance(READER_MIN_INTERVAL_MS);
    await h.readers.runAll('session');
    expect(h.reads).toEqual([
      { provider: 'bigmodel', apiKey: KEY },
      { provider: 'bigmodel', apiKey: KEY },
    ]);
  });

  it('pauses a rate limited reader, and stops trying a refused key until a new one', async () => {
    const h = harness({
      readings: [
        ok,
        { status: 'rate_limited', message: 'slow down', reportedPlan: null, snapshot: null },
        { status: 'auth_expired', message: 'refused', reportedPlan: null, snapshot: null },
      ],
    });
    await h.readers.connect(ACCOUNT, 'zai', KEY, 'session');
    h.advance(READER_MIN_INTERVAL_MS);
    await h.readers.runAll('session');
    h.advance(READER_MIN_INTERVAL_MS);
    await h.readers.runAll('session');
    expect(h.reads).toHaveLength(2);
    h.advance(READER_RATE_LIMIT_PAUSE_MS);
    await h.readers.runAll('session');
    expect(h.readers.states()[0]).toMatchObject({ status: 'auth_expired', message: 'refused' });
    h.advance(READER_RATE_LIMIT_PAUSE_MS);
    await h.readers.runAll('session');
    expect(h.reads).toHaveLength(3);
  });

  it('does not call the vendor again on a new Turn on while it is rate limited', async () => {
    const h = harness({
      readings: [
        { status: 'rate_limited', message: 'slow down', reportedPlan: null, snapshot: null },
      ],
    });
    expect((await h.readers.connect(ACCOUNT, 'zai', KEY, 'session')).ok).toBe(false);
    expect((await h.readers.connect(ACCOUNT, 'zai', KEY, 'session')).ok).toBe(false);
    expect(h.reads).toHaveLength(1);
    h.advance(READER_RATE_LIMIT_PAUSE_MS);
    expect((await h.readers.connect(ACCOUNT, 'zai', KEY, 'session')).ok).toBe(true);
    expect(h.reads).toHaveLength(2);
  });

  // A Turn off while a replacement key is still being checked must win: the
  // key it would have kept is never stored.
  it('keeps no key from a connect that was still in flight when the reader was turned off', async () => {
    const h = harness();
    let release: (value: QuotaReading) => void = () => undefined;
    const pending = new Promise<QuotaReading>((resolve) => {
      release = resolve;
    });
    const readers = new UsageReaders({
      store: h.store,
      read: () => pending,
      post: async () => ({ kind: 'ok' }),
      now: () => new Date('2026-11-05T12:00:00Z'),
      log: () => undefined,
    });
    const connecting = readers.connect(ACCOUNT, 'zai', KEY, 'session');
    await readers.disconnect(ACCOUNT);
    release(ok);
    expect((await connecting).ok).toBe(false);
    expect(await h.store.list()).toEqual([]);
    expect(readers.states()).toEqual([]);
  });

  it('forgets the key when ResetOwl says the account is gone', async () => {
    const h = harness({ posts: [{ kind: 'ok' }, { kind: 'not_found' }] });
    await h.readers.connect(ACCOUNT, 'zai', KEY, 'session');
    h.advance(READER_MIN_INTERVAL_MS);
    await h.readers.runAll('session');
    expect(await h.store.list()).toEqual([]);
    expect(h.readers.states()).toEqual([]);
    expect(h.files.size).toBe(0);
  });

  it('forgets the key when the person turns the reader off', async () => {
    const h = harness();
    await h.readers.connect(ACCOUNT, 'zai', KEY, 'session');
    await h.readers.disconnect(ACCOUNT);
    expect(await h.store.list()).toEqual([]);
    expect(h.readers.states()).toEqual([]);
  });
});
