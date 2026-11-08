import en from '@flama/translations/en/index.json';
import es from '@flama/translations/es/index.json';
import { defaultLocale, type Locale, locales } from '@flama/translations/locales';

/**
 * The language of the desktop's own text (the tray), and the system's
 * languages the screens start from.
 *
 * The screens own the choice: they start from the system's preferred
 * languages (handed over in the bridge's static info), keep a language the
 * person picks, and report whichever they show (`setLocale`), so the tray
 * reads the same. Until they do, the tray follows the system.
 */

export type { Locale };

const catalogs: Record<Locale, typeof en.desktop> = { en: en.desktop, es: es.desktop };

/**
 * The first supported locale among `preferred` (BCP 47 tags, best first),
 * matched on the language part: `es-419` and `es_ES` are Spanish. English when
 * none matches.
 */
export function resolveLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const language = tag.trim().toLowerCase().split(/[-_]/)[0];
    const match = locales.find((l) => l === language);
    if (match) return match;
  }
  return defaultLocale;
}

/** `{{name}}` placeholders, filled from `values`. */
function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}

export type TrayKey = keyof typeof en.desktop.tray;

export type Translate = (key: TrayKey, values?: Record<string, string | number>) => string;

/** The tray's copy in `locale`. */
export function trayTranslator(locale: Locale): Translate {
  const tray = catalogs[locale].tray;
  return (key, values = {}) => fill(tray[key], values);
}
