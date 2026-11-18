import type { UpdateState } from '@flama/shared/desktop';
import type { Timers } from './collector';

/**
 * The app replacing itself with a newer release. `electron-updater` does the
 * work (index.ts adapts it to `UpdateEngine`); this module holds the rules:
 * when to look, what the screens are told, and what the person chose.
 *
 * - It looks shortly after launch and every six hours, and downloads what it
 *   finds in the background. A background check that finds nothing, or fails
 *   once, shows nothing; a check the person asked for shows every step.
 * - A downloaded version installs when ResetOwl quits (`installOnQuit`, on by
 *   default) or at once with `install()`.
 * - The first launch after an update reports the version it replaced, once.
 *
 * The update comes from the app's own release feed (`publish` in
 * electron-builder.json); nothing about the person or their accounts is sent.
 */

/** The part of `electron-updater` the rules need. */
export interface UpdateEngine {
  /** False for a build that cannot replace itself (unpackaged, a non-AppImage Linux install). */
  readonly supported: boolean;
  /** Looks for a newer release; progress arrives through `Updater.handle`. */
  check(): Promise<void>;
  /** Quits and starts the downloaded version. */
  install(): void;
  setInstallOnQuit(on: boolean): void;
}

/** What `electron-updater` reports, as `index.ts` relays it. */
export type UpdateEvent =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'not-available' }
  | { type: 'progress'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string };

export interface UpdatePrefs {
  installOnQuit: boolean;
  /** The version that last ran, to tell the first launch after an update. */
  lastVersion: string | null;
}

export interface UpdatePrefsStore {
  read(): Promise<UpdatePrefs>;
  write(prefs: UpdatePrefs): Promise<void>;
}

/** The first check waits for the window and the first sync to settle. */
export const FIRST_CHECK_DELAY_MS = 20_000;
export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

const DEFAULT_PREFS: UpdatePrefs = { installOnQuit: true, lastVersion: null };

/**
 * Compares two `major.minor.patch` versions, ignoring any pre-release part:
 * negative when `a` is older, positive when newer, 0 when equal.
 */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) =>
    v
      .split('-')[0]
      .split('.')
      .map((n) => Number.parseInt(n, 10) || 0);
  const [pa, pb] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export class Updater {
  private state: UpdateState;
  private prefs: UpdatePrefs = { ...DEFAULT_PREFS };
  private timer: unknown = null;
  private started = false;

  constructor(
    private readonly deps: {
      engine: UpdateEngine;
      prefs: UpdatePrefsStore;
      currentVersion: string;
      timers: Timers;
      now(): Date;
      onState(state: UpdateState): void;
      log(line: string): void;
    },
  ) {
    this.state = {
      phase: deps.engine.supported ? 'idle' : 'unsupported',
      currentVersion: deps.currentVersion,
      version: null,
      percent: null,
      checkedAt: null,
      failures: 0,
      manual: false,
      installOnQuit: DEFAULT_PREFS.installOnQuit,
      dismissed: false,
      updatedFrom: null,
    };
  }

  /** Reads what the person chose, notes an update that just happened, and schedules the checks. */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    const { prefs, currentVersion, engine } = this.deps;
    try {
      this.prefs = { ...DEFAULT_PREFS, ...(await prefs.read()) };
    } catch {
      this.prefs = { ...DEFAULT_PREFS };
    }
    const previous = this.prefs.lastVersion;
    const updatedFrom = previous && compareVersions(currentVersion, previous) > 0 ? previous : null;
    if (previous !== currentVersion) {
      this.prefs = { ...this.prefs, lastVersion: currentVersion };
      await this.save();
    }
    engine.setInstallOnQuit(this.prefs.installOnQuit);
    this.set({ installOnQuit: this.prefs.installOnQuit, updatedFrom });
    if (engine.supported) this.schedule(FIRST_CHECK_DELAY_MS);
  }

  stop(): void {
    if (this.timer !== null) this.deps.timers.clear(this.timer);
    this.timer = null;
  }

  current(): UpdateState {
    return this.state;
  }

  /** A check the person asked for: the screens follow it step by step. */
  async check(): Promise<UpdateState> {
    if (!this.deps.engine.supported) return this.state;
    const { phase } = this.state;
    if (phase === 'checking' || phase === 'downloading' || phase === 'ready') {
      // Already under way or done; the person is now following it.
      this.set({ manual: true, dismissed: false });
      return this.state;
    }
    await this.run(true);
    return this.state;
  }

  /** Quits into the downloaded version; false when none is ready. */
  install(): boolean {
    if (this.state.phase !== 'ready') return false;
    this.deps.log(`restarting into ${this.state.version}`);
    this.deps.engine.install();
    return true;
  }

  async setInstallOnQuit(on: boolean): Promise<UpdateState> {
    this.prefs = { ...this.prefs, installOnQuit: on };
    this.deps.engine.setInstallOnQuit(on);
    this.set({ installOnQuit: on });
    await this.save();
    return this.state;
  }

  /** Closes the card, and the "updated" note with it, until something new happens. */
  dismiss(): UpdateState {
    this.set({ dismissed: true, updatedFrom: null });
    return this.state;
  }

  /** One event from `electron-updater`. */
  handle(event: UpdateEvent): void {
    switch (event.type) {
      case 'checking':
        this.set({ phase: 'checking' });
        return;
      case 'not-available':
        this.set({
          phase: 'up_to_date',
          version: null,
          percent: null,
          failures: 0,
          checkedAt: this.deps.now().toISOString(),
        });
        return;
      case 'available': {
        const newer = event.version !== this.state.version;
        this.set({
          phase: 'downloading',
          version: event.version,
          percent: 0,
          checkedAt: this.deps.now().toISOString(),
          ...(newer ? { dismissed: false } : {}),
        });
        return;
      }
      case 'progress':
        if (this.state.phase !== 'downloading') return;
        this.set({ percent: Math.max(0, Math.min(100, Math.round(event.percent))) });
        return;
      case 'downloaded': {
        const newer = event.version !== this.state.version;
        this.set({
          phase: 'ready',
          version: event.version,
          percent: null,
          failures: 0,
          ...(newer ? { dismissed: false } : {}),
        });
        return;
      }
      case 'error':
        this.deps.log(`update failed: ${event.message}`);
        // A download that failed keeps its version, so the screens can offer it again.
        this.set({
          phase: this.state.phase === 'ready' ? 'ready' : 'error',
          percent: null,
          failures: this.state.failures + 1,
          checkedAt: this.deps.now().toISOString(),
        });
        return;
    }
  }

  private async run(manual: boolean): Promise<void> {
    this.set({ manual, ...(manual ? { dismissed: false } : {}) });
    try {
      await this.deps.engine.check();
    } catch (err) {
      // electron-updater also emits `error`; count the failure only once.
      if (this.state.phase === 'checking' || this.state.phase === 'downloading') {
        this.handle({ type: 'error', message: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  private schedule(ms: number): void {
    this.stop();
    this.timer = this.deps.timers.set(() => {
      this.timer = null;
      // A downloaded update has nothing left to look for until it installs.
      const next =
        this.state.phase === 'ready' || this.state.phase === 'downloading'
          ? Promise.resolve()
          : this.run(false);
      void next.finally(() => this.schedule(CHECK_INTERVAL_MS));
    }, ms);
  }

  private set(patch: Partial<UpdateState>): void {
    this.state = { ...this.state, ...patch };
    this.deps.onState(this.state);
  }

  private async save(): Promise<void> {
    try {
      await this.deps.prefs.write(this.prefs);
    } catch (err) {
      this.deps.log(`could not save the update settings: ${String(err)}`);
    }
  }
}

/** The prefs as a small JSON file in the app's folder. */
export function createUpdatePrefsStore(deps: {
  file: string;
  fs: {
    readFile(path: string, encoding: 'utf8'): Promise<string>;
    writeFile(path: string, data: string, opts: { mode: number }): Promise<void>;
  };
}): UpdatePrefsStore {
  return {
    async read() {
      let raw: unknown;
      try {
        raw = JSON.parse(await deps.fs.readFile(deps.file, 'utf8'));
      } catch {
        return { ...DEFAULT_PREFS };
      }
      const value = (raw ?? {}) as Record<string, unknown>;
      return {
        installOnQuit:
          typeof value.installOnQuit === 'boolean'
            ? value.installOnQuit
            : DEFAULT_PREFS.installOnQuit,
        lastVersion: typeof value.lastVersion === 'string' ? value.lastVersion : null,
      };
    },
    write: (prefs) => deps.fs.writeFile(deps.file, `${JSON.stringify(prefs)}\n`, { mode: 0o600 }),
  };
}
