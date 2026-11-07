import type { DesktopBridge } from '@flama/shared/desktop';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The language the screens start in, through i18next's real detection. In the
 * desktop app the system's languages come before the browser's; a regional tag
 * there (`es-ES`) must not lose to an exact `en` further down the detectors
 * (`<html lang="en">`), which is how i18next ranks a mixed list.
 */

function desktop(systemLocales: string[]) {
  const setLocale = vi.fn(async () => undefined);
  window.resetowl = { systemLocales, setLocale } as unknown as DesktopBridge;
  return setLocale;
}

async function startLanguage(): Promise<string | undefined> {
  vi.resetModules();
  const { default: i18n, i18nReady } = await import('./i18n');
  await i18nReady;
  return i18n.resolvedLanguage;
}

describe('starting language', () => {
  beforeEach(() => {
    document.documentElement.lang = 'en';
    localStorage.clear();
  });
  afterEach(() => {
    delete window.resetowl;
  });

  it("takes the system's first supported language in the desktop app, region or not", async () => {
    const setLocale = desktop(['ca-ES', 'es-ES', 'en-US']);
    expect(await startLanguage()).toBe('es');
    expect(setLocale).toHaveBeenLastCalledWith('es');
  });

  it('keeps a language picked on this device over the system', async () => {
    localStorage.setItem('flama-locale', 'en');
    desktop(['es-ES']);
    expect(await startLanguage()).toBe('en');
  });

  it('falls back to English when the system has no supported language', async () => {
    desktop(['fr-FR', 'de-DE']);
    expect(await startLanguage()).toBe('en');
  });
});
