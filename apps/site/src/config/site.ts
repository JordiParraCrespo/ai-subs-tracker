/**
 * Site-wide configuration (astro-ignite's `siteConfig`). Values cascade
 * through SEO, JSON-LD, the sitemap, hreflang and the locale switcher.
 *
 * Add a locale: add it to `locales` and `hreflang`, add an entry to every
 * locale-keyed record below, add `src/i18n/<locale>.json` (the English file
 * is the key type) and `src/content/legal/<locale>/`.
 */

export interface SiteConfig {
  /** Canonical site URL, no trailing slash. */
  url: string;
  defaultLocale: string;
  /** Every locale, the default first. */
  locales: string[];
  hreflang: Record<string, string>;
  /** The language's own name, for the switcher. */
  localeNames: Record<string, string>;
  name: Record<string, string>;
  description: Record<string, string>;
  organization: Record<string, { name: string; legalName?: string }>;
  social: { github?: string };
  logo: string;
  /** The social card image, 1200×630. */
  defaultOgImage?: string;
  twitterHandle?: string;
  themeColor: string;
}

const REPOSITORY = 'https://github.com/JordiParraCrespo/ai-subs-tracker';

export const siteConfig: SiteConfig = {
  url: 'https://tokenaitor.com',
  defaultLocale: 'en',
  locales: ['en', 'es'],
  hreflang: { en: 'en-US', es: 'es-ES' },
  localeNames: { en: 'English', es: 'Español' },
  name: { en: 'Tokenaitor', es: 'Tokenaitor' },
  description: {
    en: 'Tokenaitor shows what every Claude Code and Codex plan on your computer has left, tells you which account to use next, and prices your usage at API rates.',
    es: 'Tokenaitor muestra lo que le queda a cada plan de Claude Code y Codex de tu ordenador, te dice qué cuenta usar ahora y valora tu uso a precios de API.',
  },
  organization: { en: { name: 'Tokenaitor' }, es: { name: 'Tokenaitor' } },
  social: { github: REPOSITORY },
  logo: '/favicon.svg',
  defaultOgImage: '/og.png',
  themeColor: '#171717',
};

/**
 * Where the page's links go. "Sign in" is the web app, which a deployment
 * names in `VITE_SITE_APP_URL` (root `.env.example`); it is read at build time.
 */
export const links = {
  download: `${REPOSITORY}/releases`,
  source: REPOSITORY,
  signIn: import.meta.env.VITE_SITE_APP_URL || 'http://localhost:3000',
} as const;
