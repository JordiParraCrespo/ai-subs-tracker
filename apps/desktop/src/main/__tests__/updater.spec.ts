import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { UpdateState } from '@flama/shared/desktop';
import { describe, expect, it, vi } from 'vitest';
import {
  CHECK_INTERVAL_MS,
  compareVersions,
  createUpdatePrefsStore,
  FIRST_CHECK_DELAY_MS,
  type UpdateEngine,
  type UpdatePrefs,
  Updater,
} from '../updater';
import { tempDir } from './helpers';

function setup(opts: { supported?: boolean; prefs?: Partial<UpdatePrefs>; version?: string } = {}) {
  const timers: Array<{ fn: () => void; ms: number; id: number }> = [];
  let nextId = 0;
  let saved: UpdatePrefs | null = null;
  const states: UpdateState[] = [];
  const engine: UpdateEngine & { check: ReturnType<typeof vi.fn> } = {
    supported: opts.supported ?? true,
    check: vi.fn(async () => undefined),
    install: vi.fn(),
    setInstallOnQuit: vi.fn(),
  };
  const updater = new Updater({
    engine,
    prefs: {
      read: async () => ({ installOnQuit: true, lastVersion: '0.2.0', ...opts.prefs }),
      write: async (p) => {
        saved = p;
      },
    },
    currentVersion: opts.version ?? '0.2.0',
    timers: {
      set: (fn, ms) => {
        const id = ++nextId;
        timers.push({ fn, ms, id });
        return id;
      },
      clear: (handle) => {
        const i = timers.findIndex((t) => t.id === handle);
        if (i >= 0) timers.splice(i, 1);
      },
    },
    now: () => new Date('2026-11-18T10:00:00Z'),
    onState: (s) => states.push(s),
    log: () => undefined,
  });
  return { updater, engine, timers, states, saved: () => saved };
}

describe('compareVersions', () => {
  it('orders by major, minor and patch, numerically', () => {
    expect(compareVersions('0.10.0', '0.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.1.1', '0.2.0')).toBeLessThan(0);
    expect(compareVersions('0.2.0-beta.1', '0.2.0')).toBe(0);
  });
});

describe('Updater', () => {
  it('never checks a build that cannot replace itself', async () => {
    const { updater, engine, timers } = setup({ supported: false });
    await updater.start();
    expect(updater.current().phase).toBe('unsupported');
    expect(timers).toHaveLength(0);
    await updater.check();
    expect(engine.check).not.toHaveBeenCalled();
  });

  it('checks shortly after launch, then every six hours, quietly', async () => {
    const { updater, engine, timers } = setup();
    await updater.start();
    expect(timers.map((t) => t.ms)).toEqual([FIRST_CHECK_DELAY_MS]);
    timers.shift()?.fn();
    await vi.waitFor(() => expect(timers.map((t) => t.ms)).toEqual([CHECK_INTERVAL_MS]));
    expect(engine.check).toHaveBeenCalledTimes(1);
    expect(updater.current().manual).toBe(false);
  });

  it('follows a background download to ready without asking for attention until then', async () => {
    const { updater } = setup();
    await updater.start();
    updater.handle({ type: 'checking' });
    updater.handle({ type: 'available', version: '0.3.0' });
    updater.handle({ type: 'progress', percent: 41.6 });
    expect(updater.current()).toMatchObject({
      phase: 'downloading',
      version: '0.3.0',
      percent: 42,
    });
    expect(updater.current().manual).toBe(false);
    updater.handle({ type: 'downloaded', version: '0.3.0' });
    expect(updater.current()).toMatchObject({ phase: 'ready', version: '0.3.0', percent: null });
  });

  it('marks a check the person asked for as manual, and reopens a closed card', async () => {
    const { updater, engine } = setup();
    await updater.start();
    updater.dismiss();
    await updater.check();
    expect(engine.check).toHaveBeenCalledTimes(1);
    expect(updater.current()).toMatchObject({ manual: true, dismissed: false });
  });

  it('does not start a second check while one is downloading', async () => {
    const { updater, engine } = setup();
    await updater.start();
    updater.handle({ type: 'available', version: '0.3.0' });
    await updater.check();
    expect(engine.check).not.toHaveBeenCalled();
    expect(updater.current().manual).toBe(true);
  });

  it('counts failures in a row and keeps the version a failed download was for', async () => {
    const { updater } = setup();
    await updater.start();
    updater.handle({ type: 'available', version: '0.3.0' });
    updater.handle({ type: 'error', message: 'net::ERR_CONNECTION_RESET' });
    updater.handle({ type: 'error', message: 'net::ERR_CONNECTION_RESET' });
    expect(updater.current()).toMatchObject({ phase: 'error', version: '0.3.0', failures: 2 });
    updater.handle({ type: 'not-available' });
    expect(updater.current()).toMatchObject({ phase: 'up_to_date', failures: 0, version: null });
  });

  it('counts a check that throws once, even when the engine also reports it', async () => {
    const { updater, engine } = setup();
    await updater.start();
    engine.check.mockImplementationOnce(async () => {
      updater.handle({ type: 'checking' });
      updater.handle({ type: 'error', message: 'offline' });
      throw new Error('offline');
    });
    await updater.check();
    expect(updater.current().failures).toBe(1);
  });

  it('installs only a downloaded update', async () => {
    const { updater, engine } = setup();
    await updater.start();
    expect(updater.install()).toBe(false);
    updater.handle({ type: 'downloaded', version: '0.3.0' });
    expect(updater.install()).toBe(true);
    expect(engine.install).toHaveBeenCalledTimes(1);
  });

  it('keeps the choice to install on quit, and hands it to the engine', async () => {
    const { updater, engine, saved } = setup({ prefs: { installOnQuit: false } });
    await updater.start();
    expect(engine.setInstallOnQuit).toHaveBeenLastCalledWith(false);
    expect(updater.current().installOnQuit).toBe(false);
    await updater.setInstallOnQuit(true);
    expect(engine.setInstallOnQuit).toHaveBeenLastCalledWith(true);
    expect(saved()).toEqual({ installOnQuit: true, lastVersion: '0.2.0' });
  });

  it('reports the version it replaced on the first launch after an update, until dismissed', async () => {
    const { updater, saved } = setup({ prefs: { lastVersion: '0.1.1' } });
    await updater.start();
    expect(updater.current().updatedFrom).toBe('0.1.1');
    expect(saved()?.lastVersion).toBe('0.2.0');
    updater.dismiss();
    expect(updater.current()).toMatchObject({ updatedFrom: null, dismissed: true });
  });

  it('says nothing on a first install or after a downgrade', async () => {
    for (const lastVersion of [null, '0.3.0']) {
      const { updater } = setup({ prefs: { lastVersion } });
      await updater.start();
      expect(updater.current().updatedFrom).toBeNull();
    }
  });

  it('shows a closed card again when a newer version is found', async () => {
    const { updater } = setup();
    await updater.start();
    updater.handle({ type: 'downloaded', version: '0.3.0' });
    updater.dismiss();
    updater.handle({ type: 'downloaded', version: '0.3.0' });
    expect(updater.current().dismissed).toBe(true);
    updater.handle({ type: 'available', version: '0.3.1' });
    expect(updater.current().dismissed).toBe(false);
  });
});

describe('createUpdatePrefsStore', () => {
  it('round-trips the file and falls back to the defaults on anything unreadable', async () => {
    const dir = await tempDir();
    const file = join(dir, 'updates.json');
    const store = createUpdatePrefsStore({ file, fs: { readFile, writeFile } });
    expect(await store.read()).toEqual({ installOnQuit: true, lastVersion: null });
    await store.write({ installOnQuit: false, lastVersion: '0.2.0' });
    expect(await store.read()).toEqual({ installOnQuit: false, lastVersion: '0.2.0' });
    await writeFile(file, '{"installOnQuit":"no","lastVersion":7}');
    expect(await store.read()).toEqual({ installOnQuit: true, lastVersion: null });
    await writeFile(file, 'not json');
    expect(await store.read()).toEqual({ installOnQuit: true, lastVersion: null });
  });
});
