import { resolve } from 'node:path';
import type { CollectorStatus } from '@flama/shared/desktop';
import type { LimitWindow, SyncAccountsInput } from '@flama/shared/schemas/accounts';
import type { ProviderId } from '@flama/shared/subscriptions';
import type { DetectedLogin } from '@flama/usage-providers';
import { NetworkError, type SyncedAccount, type SyncResult } from './api-client';
import { buildSyncInput, type LocalAccount, sinceDayFor, toLocalLogins } from './local-logins';
import type { TokenStore } from './token-store';

/**
 * The loop that reads local logins and syncs them: every 10 minutes, on
 * `refresh` (at most once a minute), and as soon as a token arrives. A 401
 * signs out; a network or server failure backs off 1m → 2m → … → 15m. A
 * login the provider rate limits is read from disk only for 15 minutes.
 * Everything with a side effect is injected, so the rules run in tests.
 */

export const SYNC_INTERVAL_MS = 10 * 60_000;
export const REFRESH_DEBOUNCE_MS = 60_000;
export const BACKOFF_MIN_MS = 60_000;
export const BACKOFF_MAX_MS = 15 * 60_000;
export const RATE_LIMIT_PAUSE_MS = 15 * 60_000;
export const LIVE_THROTTLE_MS = 60_000;

export function backoffDelay(failures: number): number {
  if (failures <= 0) return 0;
  return Math.min(BACKOFF_MIN_MS * 2 ** (failures - 1), BACKOFF_MAX_MS);
}

export interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export interface CollectorDeps {
  read(opts: {
    sinceDay: string;
    fetchLimitsFor: (login: DetectedLogin) => boolean;
  }): Promise<LocalAccount[]>;
  readPointers(): Promise<Partial<Record<ProviderId, string>>>;
  /** Points terminals at the logins the server marks active. */
  applyActive(server: readonly SyncedAccount[], local: readonly LocalAccount[]): Promise<void>;
  sync(input: SyncAccountsInput, token: string): Promise<SyncResult>;
  tokens: TokenStore;
  device: { name: string; platform: string };
  now(): Date;
  timers: Timers;
  onStatus(status: CollectorStatus): void;
  /** `partial`: a live-feed sync, whose answer may hold only the account it sent. */
  onSynced(accounts: readonly SyncedAccount[], partial: boolean): void;
  log(line: string): void;
}

export class Collector {
  private current: CollectorStatus = {
    phase: 'idle',
    lastRunAt: null,
    nextRunAt: null,
    lastError: null,
    logins: [],
  };
  private lastEmitted = '';
  private inFlight: Promise<CollectorStatus> | null = null;
  private timer: unknown = null;
  private lastStartedAt: number | null = null;
  private failures = 0;
  private readonly rateLimitedUntil = new Map<string, number>();
  private readonly liveSentAt = new Map<string, number>();
  private local: LocalAccount[] = [];
  private stopped = false;

  constructor(private readonly deps: CollectorDeps) {}

  status(): CollectorStatus {
    return this.current;
  }

  /** The accounts read last time, for the live feed and the tray. */
  localAccounts(): readonly LocalAccount[] {
    return this.local;
  }

  start(): Promise<CollectorStatus> {
    this.stopped = false;
    return this.run();
  }

  stop(): void {
    this.stopped = true;
    this.clearTimer();
  }

  /** Reads and syncs now, unless a run started less than a minute ago. */
  refresh(): Promise<CollectorStatus> {
    if (this.inFlight) return this.inFlight;
    const now = this.deps.now().getTime();
    if (this.lastStartedAt !== null && now - this.lastStartedAt < REFRESH_DEBOUNCE_MS) {
      return Promise.resolve(this.current);
    }
    return this.run();
  }

  /** Reads and syncs now, skipping the refresh debounce (a login was just added). */
  runNow(): Promise<CollectorStatus> {
    return this.inFlight ?? this.run();
  }

  /** A new token (sign-in) syncs at once; a cleared one signs out. */
  async tokenChanged(token: string | null): Promise<CollectorStatus> {
    if (token) {
      this.failures = 0;
      return this.inFlight ?? this.run();
    }
    this.clearTimer();
    this.update({ phase: 'signed_out', nextRunAt: null, lastError: null });
    return this.current;
  }

  /** Re-reads which login is active, after the pointer files changed. */
  async pointersChanged(): Promise<CollectorStatus> {
    this.update({ logins: toLocalLogins(this.local, await this.deps.readPointers()) });
    return this.current;
  }

  /**
   * Sends limits a running Claude Code session reported for the login in
   * `home`, at most once a minute per login. False when nothing was sent.
   */
  async sendLive(home: string, windows: LimitWindow[]): Promise<boolean> {
    const target = resolve(home);
    const item = this.local.find(
      (l) => l.login.provider === 'claude-code' && resolve(l.login.home) === target,
    );
    if (!item || windows.length === 0) return false;
    const now = this.deps.now();
    const last = this.liveSentAt.get(target);
    if (last !== undefined && now.getTime() - last < LIVE_THROTTLE_MS) return false;
    const token = await this.deps.tokens.get();
    if (!token) return false;
    this.liveSentAt.set(target, now.getTime());
    const input: SyncAccountsInput = {
      device: buildSyncInput([], this.deps.device).device,
      accounts: [
        {
          ...item.account,
          snapshot: {
            capturedAt: now.toISOString(),
            source: 'live',
            status: 'ok',
            message: null,
            windows: windows.slice(0, 20),
            extraUsage: null,
          },
          dailyTokens: [],
        },
      ],
    };
    try {
      const result = await this.deps.sync(input, token);
      if (result.kind === 'unauthorized') await this.signOut();
      else if (result.kind === 'ok') this.deps.onSynced(result.accounts, true);
      return result.kind === 'ok';
    } catch (err) {
      this.deps.log(`live feed sync failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  private run(): Promise<CollectorStatus> {
    this.inFlight = this.collectAndSync().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async collectAndSync(): Promise<CollectorStatus> {
    this.clearTimer();
    const started = this.deps.now();
    this.lastStartedAt = started.getTime();
    const token = await this.deps.tokens.get();
    this.update({ phase: 'collecting' });

    let local: LocalAccount[];
    try {
      local = await this.deps.read({
        sinceDay: sinceDayFor(started),
        fetchLimitsFor: (login) =>
          token !== null && (this.rateLimitedUntil.get(login.home) ?? 0) <= started.getTime(),
      });
    } catch (err) {
      return this.fail(err);
    }
    for (const { login, account } of local) {
      if (account.snapshot?.status === 'rate_limited') {
        this.rateLimitedUntil.set(login.home, started.getTime() + RATE_LIMIT_PAUSE_MS);
      }
    }
    this.local = local;
    const logins = toLocalLogins(local, await this.deps.readPointers());

    if (!token) {
      this.update({
        phase: 'signed_out',
        logins,
        lastRunAt: started.toISOString(),
        nextRunAt: null,
        lastError: null,
      });
      return this.current;
    }

    this.update({ phase: 'syncing', logins });
    let result: SyncResult;
    try {
      result = await this.deps.sync(buildSyncInput(local, this.deps.device), token);
    } catch (err) {
      return this.fail(err);
    }

    if (result.kind === 'unauthorized') {
      await this.signOut();
      return this.current;
    }
    if (result.kind === 'http_error') return this.fail(new Error(result.message));

    this.failures = 0;
    try {
      await this.deps.applyActive(result.accounts, local);
    } catch (err) {
      this.deps.log(`could not update the active pointers: ${String(err)}`);
    }
    this.deps.onSynced(result.accounts, false);
    const activeLogins = toLocalLogins(local, await this.deps.readPointers());
    this.update({
      phase: 'idle',
      logins: activeLogins,
      lastRunAt: this.deps.now().toISOString(),
      nextRunAt: this.schedule(SYNC_INTERVAL_MS),
      lastError: null,
    });
    return this.current;
  }

  private async signOut(): Promise<void> {
    this.clearTimer();
    await this.deps.tokens.set(null);
    this.update({
      phase: 'signed_out',
      nextRunAt: null,
      lastError: 'The session expired. Sign in again.',
    });
  }

  private fail(err: unknown): CollectorStatus {
    this.failures += 1;
    const message =
      err instanceof NetworkError
        ? `Could not reach the Subtrack API: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
    this.update({
      phase: 'error',
      lastRunAt: this.deps.now().toISOString(),
      nextRunAt: this.schedule(backoffDelay(this.failures)),
      lastError: message.slice(0, 500),
    });
    return this.current;
  }

  /** Arms the timer; returns the `nextRunAt` to report (null once stopped). */
  private schedule(ms: number): string | null {
    this.clearTimer();
    if (this.stopped) return null;
    this.timer = this.deps.timers.set(() => {
      this.timer = null;
      void this.run();
    }, ms);
    return new Date(this.deps.now().getTime() + ms).toISOString();
  }

  private clearTimer(): void {
    if (this.timer !== null) this.deps.timers.clear(this.timer);
    this.timer = null;
  }

  private update(patch: Partial<CollectorStatus>): void {
    this.current = { ...this.current, ...patch };
    const serialized = JSON.stringify(this.current);
    if (serialized === this.lastEmitted) return;
    this.lastEmitted = serialized;
    this.deps.onStatus(this.current);
  }
}
