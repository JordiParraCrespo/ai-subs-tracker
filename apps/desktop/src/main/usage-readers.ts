import type { ConnectUsageReaderResult, UsageReaderState } from '@flama/shared/desktop';
import type { ReportUsageReadingInput } from '@flama/shared/schemas/accounts';
import type { ManualProviderId } from '@flama/shared/subscriptions';
import type { QuotaReading } from '@flama/usage-providers';
import type { ReadingResult } from './api-client';
import type { Encryptor, TokenFs } from './token-store';

/**
 * The opt-in unofficial usage readers: for a hand-tracked GLM Coding Plan
 * (Z.AI, BigModel) whose owner pasted their plan key, read the vendor's
 * undocumented quota endpoint on each collector run and send the windows to
 * ResetOwl. Recording by hand stays the fallback.
 *
 * The key:
 * - is kept only on this machine, encrypted with the OS keystore (Electron's
 *   `safeStorage`), one per account, in `userData/usage-readers.json`;
 *   without a keystore it is not kept at all;
 * - is sent only to the provider's own site (`readZaiQuota`), never to the
 *   ResetOwl API, never to the screens, never to a log;
 * - goes when the person turns the reader off, and when ResetOwl answers that
 *   the account is gone.
 */

/** At most one read per account in this long, however often the person presses refresh. */
export const READER_MIN_INTERVAL_MS = 5 * 60_000;
/** A rate limited reader waits this long, like a rate limited login. */
export const READER_RATE_LIMIT_PAUSE_MS = 15 * 60_000;

interface StoredKey {
  provider: ManualProviderId;
  /** The key, encrypted with `safeStorage`, base64. */
  key: string;
}

interface KeyFile {
  version: 1;
  keys: Record<string, StoredKey>;
}

export interface ReaderKeyStore {
  list(): Promise<Array<{ accountId: string; provider: ManualProviderId; apiKey: string }>>;
  put(accountId: string, provider: ManualProviderId, apiKey: string): Promise<void>;
  remove(accountId: string): Promise<void>;
  /** False when there is no keystore to encrypt with, so nothing may be kept. */
  available(): boolean;
}

export function createReaderKeyStore(deps: {
  file: string;
  encryptor: Encryptor;
  fs: TokenFs;
  log: (line: string) => void;
}): ReaderKeyStore {
  const { file, encryptor, fs, log } = deps;

  async function load(): Promise<KeyFile> {
    try {
      const parsed = JSON.parse((await fs.readFile(file)).toString('utf8')) as Partial<KeyFile>;
      if (parsed.version === 1 && parsed.keys && typeof parsed.keys === 'object') {
        return { version: 1, keys: parsed.keys };
      }
    } catch {
      // absent or unreadable: nothing kept
    }
    return { version: 1, keys: {} };
  }

  async function write(data: KeyFile): Promise<void> {
    if (Object.keys(data.keys).length === 0) {
      await fs.rm(file, { force: true }).catch(() => undefined);
      return;
    }
    await fs.writeFile(file, Buffer.from(JSON.stringify(data)), { mode: 0o600 });
  }

  return {
    available: () => encryptor.isEncryptionAvailable(),
    async list() {
      if (!encryptor.isEncryptionAvailable()) return [];
      const data = await load();
      const out: Array<{ accountId: string; provider: ManualProviderId; apiKey: string }> = [];
      for (const [accountId, stored] of Object.entries(data.keys)) {
        try {
          const apiKey = encryptor.decryptString(Buffer.from(stored.key, 'base64'));
          if (apiKey) out.push({ accountId, provider: stored.provider, apiKey });
        } catch {
          log(`a usage reader key could not be decrypted; skipping account ${accountId}`);
        }
      }
      return out;
    },
    async put(accountId, provider, apiKey) {
      if (!encryptor.isEncryptionAvailable()) throw new Error('No keystore to encrypt the key.');
      const data = await load();
      data.keys[accountId] = {
        provider,
        key: encryptor.encryptString(apiKey).toString('base64'),
      };
      await write(data);
    },
    async remove(accountId) {
      const data = await load();
      if (!(accountId in data.keys)) return;
      delete data.keys[accountId];
      await write(data);
    },
  };
}

export interface UsageReadersDeps {
  store: ReaderKeyStore;
  read(provider: ManualProviderId, apiKey: string): Promise<QuotaReading>;
  post(accountId: string, input: ReportUsageReadingInput, token: string): Promise<ReadingResult>;
  now(): Date;
  log(line: string): void;
}

export class UsageReaders {
  private readonly state = new Map<string, UsageReaderState>();
  private readonly lastAttempt = new Map<string, number>();
  private readonly pausedUntil = new Map<string, number>();
  private loaded = false;

  constructor(private readonly deps: UsageReadersDeps) {}

  /** What the screens see: one row per account with a key, never the key. */
  states(): UsageReaderState[] {
    return [...this.state.values()].sort((a, b) => a.accountId.localeCompare(b.accountId));
  }

  /**
   * Reads once with the pasted key and keeps it only when the vendor answered
   * with limits and ResetOwl took the reading.
   */
  async connect(
    accountId: string,
    provider: ManualProviderId,
    apiKey: string,
    token: string | null,
  ): Promise<ConnectUsageReaderResult> {
    if (!token) return { ok: false, message: 'Sign in to ResetOwl first.', reader: null };
    if (!this.deps.store.available()) {
      return {
        ok: false,
        message:
          'This computer has no keystore ResetOwl can encrypt the key with, so it will not keep it.',
        reader: null,
      };
    }
    await this.ensureLoaded();
    const outcome = await this.readAndSend(accountId, provider, apiKey, token);
    if (outcome.status !== 'ok') return { ok: false, message: outcome.message, reader: null };
    await this.deps.store.put(accountId, provider, apiKey);
    this.state.set(accountId, outcome);
    return { ok: true, message: null, reader: outcome };
  }

  /** Forgets the key; the account goes back to readings recorded by hand. */
  async disconnect(accountId: string): Promise<void> {
    await this.deps.store.remove(accountId);
    this.state.delete(accountId);
    this.lastAttempt.delete(accountId);
    this.pausedUntil.delete(accountId);
  }

  /** One collector run: each kept key is read, unless it was read moments ago or is paused. */
  async runAll(token: string): Promise<void> {
    await this.ensureLoaded();
    const now = this.deps.now().getTime();
    for (const { accountId, provider, apiKey } of await this.deps.store.list()) {
      const last = this.lastAttempt.get(accountId);
      if (last !== undefined && now - last < READER_MIN_INTERVAL_MS) continue;
      if ((this.pausedUntil.get(accountId) ?? 0) > now) continue;
      // A refused key is not tried again until the person pastes a new one.
      if (this.state.get(accountId)?.status === 'auth_expired') continue;
      const outcome = await this.readAndSend(accountId, provider, apiKey, token);
      if (outcome.status === 'gone') {
        this.deps.log(`account ${accountId} is no longer tracked; its usage reader key is removed`);
        await this.disconnect(accountId);
        continue;
      }
      this.state.set(accountId, outcome);
    }
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    for (const { accountId, provider } of await this.deps.store.list()) {
      if (!this.state.has(accountId)) {
        this.state.set(accountId, {
          accountId,
          provider,
          lastReadAt: null,
          status: null,
          message: null,
        });
      }
    }
  }

  private async readAndSend(
    accountId: string,
    provider: ManualProviderId,
    apiKey: string,
    token: string,
  ): Promise<UsageReaderState | (Omit<UsageReaderState, 'status'> & { status: 'gone' })> {
    const at = this.deps.now();
    this.lastAttempt.set(accountId, at.getTime());
    const previous = this.state.get(accountId);
    const base = { accountId, provider, lastReadAt: previous?.lastReadAt ?? null };
    const reading = await this.deps.read(provider, apiKey);
    if (reading.status !== 'ok' || !reading.snapshot) {
      if (reading.status === 'rate_limited') {
        this.pausedUntil.set(accountId, at.getTime() + READER_RATE_LIMIT_PAUSE_MS);
      }
      return { ...base, status: reading.status, message: reading.message };
    }
    let sent: ReadingResult;
    try {
      sent = await this.deps.post(
        accountId,
        {
          reportedPlan: reading.reportedPlan,
          snapshot: { ...reading.snapshot, source: 'unofficial', status: 'ok' },
        },
        token,
      );
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err);
      return {
        ...base,
        status: 'error',
        message: `Could not reach ResetOwl: ${why}`.slice(0, 500),
      };
    }
    if (sent.kind === 'not_found') return { ...base, status: 'gone', message: null };
    if (sent.kind !== 'ok') {
      const why = sent.kind === 'unauthorized' ? 'the session expired' : sent.message;
      return { ...base, status: 'error', message: `ResetOwl did not take the reading: ${why}` };
    }
    return { ...base, lastReadAt: at.toISOString(), status: 'ok', message: null };
  }
}
