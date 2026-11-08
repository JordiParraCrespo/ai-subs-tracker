import en from '@flama/translations/en/index.json';
import { loadLocaleMessages } from '@flama/translations/lazy';
import { defaultLocale, defaultNS, locales } from '@flama/translations/locales';
import i18n, { type BackendModule } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { desktopBridge } from '../../platform';

/** localStorage key used to persist the user's language choice. */
export const LOCALE_STORAGE_KEY = 'flama-locale';

/**
 * Serves a catalog per locale, on demand, from its own chunk.
 *
 * Only the default locale is bundled (below): it is the fallback every other
 * locale resolves missing keys against, and it is what most readers get, so
 * making it a request would cost every first visit. Every other catalog is
 * fetched when it is actually the reader's — which is also what keeps the entry
 * chunk flat as locales are added, instead of ~14KB gzipped heavier each time.
 */
const lazyCatalogs: BackendModule = {
  type: 'backend',
  init: () => {},
  read: (language, _namespace, callback) => {
    loadLocaleMessages(language)
      .then((messages) => callback(null, messages))
      // `false` is i18next's "do not retry": an unknown or unsupported tag is
      // not a transient failure, and `fallbackLng` already covers the reader.
      .catch((error: Error) => callback(error, false));
  },
};

/**
 * Inside the desktop app, the operating system's preferred languages, best
 * first. Electron's `navigator` carries the one locale Chromium settled on,
 * which can miss a supported language further down the system's list (set to
 * Catalan, then Spanish, it reads as English); the app hands over the whole
 * list instead. Absent in a browser.
 *
 * Each tag is reduced to the supported language it names (`es-ES` → `es`),
 * in the system's order: i18next ranks a mixed list by exact matches first,
 * so a bare regional tag here would lose to the `en` of `<html lang>`.
 */
function systemLanguages(): string[] | undefined {
  const supported: readonly string[] = locales;
  const languages = (desktopBridge?.systemLocales ?? [])
    .map((tag) => tag.trim().toLowerCase().split(/[-_]/)[0] ?? '')
    .filter((language) => supported.includes(language));
  return languages.length > 0 ? [...new Set(languages)] : undefined;
}

const languageDetector = new LanguageDetector();
languageDetector.addDetector({ name: 'desktop', lookup: systemLanguages });

// The desktop app's own text (the tray) follows whatever the screens show.
i18n.on('languageChanged', () => {
  const shown = i18n.resolvedLanguage;
  if (desktopBridge && shown) void desktopBridge.setLocale(shown).catch(() => {});
});

/**
 * Resolves once the reader's own catalog is in memory.
 *
 * `main.tsx` renders behind it. For the default locale it settles without a
 * request; for any other it is one small fetch, and awaiting it is what stops
 * a Spanish reader seeing a frame of English before the catalog lands.
 */
export const i18nReady = i18n
  .use(languageDetector)
  .use(lazyCatalogs)
  .use(initReactI18next)
  .init({
    // The fallback locale, bundled. `partialBundledLanguages` tells i18next
    // that what it has here is not the whole set, so it still asks the backend
    // for anything else.
    resources: { [defaultLocale]: { [defaultNS]: en } },
    partialBundledLanguages: true,
    defaultNS,
    fallbackLng: defaultLocale,
    supportedLngs: [...locales],
    interpolation: {
      // React already escapes values, so i18next must not double-escape.
      escapeValue: false,
    },
    // Read the device's own choice first, then (in the desktop app) the
    // system's languages, but never write what was merely
    // detected: a cached browser language looked like a choice, so the
    // account's saved language never applied on a new device
    // (`useApplyUserSettings`). A choice is stored by `chooseLocale`.
    detection: {
      order: ['localStorage', 'desktop', 'navigator', 'htmlTag'],
      caches: [],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
    },
  });

/**
 * The reader picked a language on this device: show it, and keep it as the
 * device's own choice, which wins over the account's saved default.
 */
export async function chooseLocale(locale: string): Promise<void> {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // No storage: the choice lasts for this page.
  }
  await i18n.changeLanguage(locale);
}

export default i18n;
